// -----------------------------------------------------------------------------
// Dashboard widgets of the Marées France integration.
//
//   - `tide_today`    the tide of the day at a harbor: water height now,
//                     rising or falling, next tide, coefficient, and the
//                     curve of the water height over the local day with its
//                     high and low tides marked;
//   - `tide_list`     the next eight high and low tides (card list), with
//                     their coefficient;
//   - `coefficients`  the coefficients of the coming two weeks (bar chart),
//                     with the next spring tide.
//
// Each widget has a `port` setting (one of the harbor devices created in
// Gladys); left empty, it shows the first harbor of the configuration, so a
// widget works before any device is added. The contents come from the data
// downloaded once a day: a widget never costs a SHOM request. Every text
// exists in the four languages (the content is cached per language). Budget
// of a card: 8 components, 1 main one (chart or card-list), 6 tiles, 2
// texts, 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { t, formatNumber } from './i18n.js';
import { displayName } from './ports.js';
import { formatTime, localDay } from './time.js';
import {
  TIDE_TYPES,
  heightAt,
  nextTide,
  trendAt,
  tidesOfDay,
  levelsOfDay,
  maxCoefficient,
} from './tides.js';

const WIDGETS = { TODAY: 'tide_today', LIST: 'tide_list', COEFFICIENTS: 'coefficients' };
const LIST_ITEMS = 8;
const COEFFICIENT_DAYS = 14;
// The spring tide threshold the widgets highlight (the usual "grande marée").
const SPRING_COEFFICIENT = 95;
const TTL = { message: 60, today: 300, list: 600, coefficients: 3600 };

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The color of a coefficient: spring tides stand out.
 * @param {number|null} coefficient - The coefficient.
 * @returns {string} A semantic color.
 */
function coefficientColor(coefficient) {
  if (typeof coefficient !== 'number') {
    return 'neutral';
  }
  if (coefficient >= 100) {
    return 'danger';
  }
  if (coefficient >= SPRING_COEFFICIENT) {
    return 'warning';
  }
  return coefficient >= 70 ? 'primary' : 'neutral';
}

const heading = (port) => ({ type: 'text', variant: 'heading', text: clip(displayName(port), 40) });
const caption = (language) => ({ type: 'text', variant: 'caption', text: t('caption', language) });

/**
 * @description The tide of the day at a harbor.
 * @param {object} options - Options.
 * @param {object} options.port - The harbor.
 * @param {object} options.data - Its tide data `{ tides, levels }`.
 * @param {number} options.now - Now (ms).
 * @param {string} options.timezone - Timezone of Gladys.
 * @param {string} options.language - The user language.
 * @returns {object} The content.
 */
function buildTodayWidget({ port, data, now, timezone, language }) {
  const day = localDay(new Date(now), timezone);
  const height = heightAt(data.levels, now);
  const trend = trendAt(data.tides, now);
  const next = nextTide(data.tides, now);
  const coefficient = nextTide(data.tides, now, TIDE_TYPES.HIGH)?.coefficient ?? null;
  const tiles = [];
  if (height !== null) {
    tiles.push({
      type: 'value',
      value: height,
      unit: 'm',
      label: t('tileHeight', language),
      icon: 'droplet',
    });
  }
  if (trend) {
    tiles.push({
      type: 'value',
      value: t(`trendShort_${trend}`, language),
      label: t('tileTrend', language),
      icon: trend === 'rising' ? 'trending-up' : 'trending-down',
      color: trend === 'rising' ? 'info' : 'neutral',
    });
  }
  if (next) {
    tiles.push({
      type: 'value',
      value: formatTime(new Date(next.at), timezone),
      label: t(`tileNext_${next.type}`, language),
      icon: 'clock',
    });
  }
  if (coefficient !== null) {
    tiles.push({
      type: 'value',
      value: coefficient,
      label: t('tileCoefficient', language),
      icon: 'activity',
      color: coefficientColor(coefficient),
    });
  }
  const points = levelsOfDay(data.levels, day, timezone);
  const components = [heading(port), ...tiles];
  if (points.length > 0) {
    components.push({
      type: 'chart',
      chart_type: 'area',
      unit: 'm',
      series: [
        {
          name: t('seriesHeight', language),
          points: points.map((point) => ({
            t: new Date(point.at).toISOString(),
            v: point.height,
          })),
        },
      ],
      annotations: tidesOfDay(data.tides, day, timezone)
        .slice(0, 8)
        .map((tide) => ({
          t: new Date(tide.at).toISOString(),
          value: tide.height,
          label: clip(
            t(`mark_${tide.type}`, language, { time: formatTime(new Date(tide.at), timezone) }),
            16,
          ),
          color: tide.type === TIDE_TYPES.HIGH ? 'primary' : 'info',
        })),
      now_marker: true,
    });
  }
  components.push(caption(language));
  return { ttl_seconds: TTL.today, components };
}

/**
 * @description The next high and low tides of a harbor.
 * @param {object} options - Options (see buildTodayWidget).
 * @returns {object} The content.
 */
function buildListWidget({ port, data, now, language }) {
  const items = data.tides
    .filter((tide) => tide.at > now)
    .slice(0, LIST_ITEMS)
    .map((tide) => ({
      title: clip(
        t(`card_${tide.type}`, language, {
          height: formatNumber(tide.height, language, 2),
        }),
        60,
      ),
      date: new Date(tide.at).toISOString(),
      ...(tide.coefficient !== null
        ? {
            badge: {
              text: clip(t('badgeCoefficient', language, { n: tide.coefficient }), 16),
              color: tide.type === TIDE_TYPES.HIGH ? coefficientColor(tide.coefficient) : 'neutral',
            },
          }
        : {}),
    }));
  if (items.length === 0) {
    return messageContent(t('noData', language));
  }
  return {
    ttl_seconds: TTL.list,
    components: [heading(port), { type: 'card-list', display: 'list', items }, caption(language)],
  };
}

/**
 * @description The coefficients of the coming days.
 * @param {object} options - Options (see buildTodayWidget).
 * @returns {object} The content.
 */
function buildCoefficientsWidget({ port, data, now, timezone, language }) {
  const today = localDay(new Date(now), timezone);
  const days = (data.coefficients ?? [])
    .filter((entry) => entry.day >= today)
    .slice(0, COEFFICIENT_DAYS);
  if (days.length === 0) {
    return messageContent(t('noCoefficients', language), TTL.coefficients);
  }
  const todayMax = maxCoefficient(data.tides, today, timezone) ?? days[0].max;
  const spring = days.find((entry) => entry.max >= SPRING_COEFFICIENT);
  const peak = days.reduce((best, entry) => (entry.max > best.max ? entry : best));
  // A day at noon UTC stays on the same calendar day in every timezone of France.
  const noon = (day) => `${day}T12:00:00.000Z`;
  const shortDate = (day) =>
    clip(
      new Date(noon(day)).toLocaleDateString(language, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
      12,
    );
  const tiles = [
    {
      type: 'value',
      value: todayMax,
      label: t('tileToday', language),
      icon: 'activity',
      color: coefficientColor(todayMax),
    },
    {
      type: 'value',
      value: peak.max,
      label: clip(t('tilePeak', language, { date: shortDate(peak.day) }), 24),
      icon: 'trending-up',
      color: coefficientColor(peak.max),
    },
    {
      type: 'value',
      value: spring ? shortDate(spring.day) : t('none', language),
      label: t('tileSpring', language, { n: SPRING_COEFFICIENT }),
      icon: 'calendar',
      color: spring ? 'warning' : 'neutral',
    },
  ];
  return {
    ttl_seconds: TTL.coefficients,
    components: [
      heading(port),
      ...tiles,
      {
        type: 'chart',
        chart_type: 'bar',
        series: [
          {
            name: t('seriesCoefficient', language),
            points: days.map((entry) => ({ t: noon(entry.day), v: entry.max })),
          },
        ],
      },
      caption(language),
    ],
  };
}

export {
  WIDGETS,
  LIST_ITEMS,
  COEFFICIENT_DAYS,
  SPRING_COEFFICIENT,
  TTL,
  clip,
  messageContent,
  coefficientColor,
  buildTodayWidget,
  buildListWidget,
  buildCoefficientsWidget,
};
