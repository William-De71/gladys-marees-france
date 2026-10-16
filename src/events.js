// -----------------------------------------------------------------------------
// Scene triggers and scene action outputs.
//
// The filters of a scene trigger compare by equality only, so the "N minutes
// before" and "coefficient of at least N" choices are published as one event
// per choice: for a high tide of coefficient 98, the `spring_tide` events
// carry min_coefficient "70", "80", "90" and "95", each at every offset; a
// scene keeps the one it asked for. Both fields are required in the
// manifest, so a scene never receives all of them.
//
// Event data is flat (at most 30 keys, scalar values, strings of at most
// 1,000 characters). Outputs are the declared ones only, never null: -1 for
// an unknown number, "" for an unknown text.
// -----------------------------------------------------------------------------

import { idsOf, deviceName, tideSentence } from './device.js';
import { t, formatNumber } from './i18n.js';
import { formatTime } from './time.js';
import { TIDE_TYPES, MINUTE, nextTide, heightAt, trendAt, minutesBetween } from './tides.js';

const TRIGGERS = { TIDE_UPCOMING: 'tide_upcoming', SPRING_TIDE: 'spring_tide' };
// Minutes before the tide, 0 = at the time of the tide.
const TIDE_OFFSETS = [0, 15, 30, 45, 60, 90, 120, 180, 240, 360];
const SPRING_OFFSETS = [0, 60, 120, 180, 360, 720, 1440];
const SPRING_THRESHOLDS = [70, 80, 90, 95, 100, 105, 110, 115];
const NEXT_TIDE_CHOICES = ['any', TIDE_TYPES.HIGH, TIDE_TYPES.LOW];
const MAX_STRING = 1000;

const text = (value) => String(value ?? '').slice(0, MAX_STRING);
const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : -1);

/**
 * @description The data every tide event and output shares.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} port - The harbor.
 * @param {object} tide - The tide.
 * @param {string} timezone - IANA timezone.
 * @param {string} language - Language of the names.
 * @returns {object} The data.
 */
const tideData = (gladys, port, tide, timezone, language) => ({
  port: idsOf(gladys, port.id).device,
  port_name: text(deviceName(port, language)),
  tide: tide.type,
  tide_time: formatTime(new Date(tide.at), timezone),
  tide_datetime: new Date(tide.at).toISOString(),
  height: number(tide.height),
  coefficient: number(tide.coefficient),
});

/**
 * @description Every scene event of a harbor whose instant falls in a window.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} port - The harbor.
 * @param {Array<object>} tides - Its tides.
 * @param {{ from: number, to: number }} window - Instants (ms), from excluded.
 * @param {string} timezone - IANA timezone.
 * @param {string} language - Language of the texts.
 * @returns {Array<{ id: string, at: number, key: string, data: object }>} The events, by time.
 */
function eventsBetween(gladys, port, tides, { from, to }, timezone, language) {
  const events = [];
  const inWindow = (at) => at > from && at <= to;
  for (const tide of tides) {
    const base = tideData(gladys, port, tide, timezone, language);
    const sentence = tideSentence(tide, language, timezone);
    for (const offset of TIDE_OFFSETS) {
      const at = tide.at - offset * MINUTE;
      if (!inWindow(at)) {
        continue;
      }
      events.push({
        id: `${TRIGGERS.TIDE_UPCOMING}:${port.id}:${tide.at}:${offset}`,
        at,
        key: TRIGGERS.TIDE_UPCOMING,
        data: {
          ...base,
          minutes_before: String(offset),
          summary: text(
            offset === 0
              ? t('summaryTideNow', language, { port: port.name, tide: sentence })
              : t('summaryTideSoon', language, { port: port.name, tide: sentence, n: offset }),
          ),
        },
      });
    }
    if (tide.type !== TIDE_TYPES.HIGH || tide.coefficient === null) {
      continue;
    }
    const low = nextTide(tides, tide.at, TIDE_TYPES.LOW);
    for (const threshold of SPRING_THRESHOLDS.filter((value) => tide.coefficient >= value)) {
      for (const offset of SPRING_OFFSETS) {
        const at = tide.at - offset * MINUTE;
        if (!inWindow(at)) {
          continue;
        }
        events.push({
          id: `${TRIGGERS.SPRING_TIDE}:${port.id}:${tide.at}:${offset}:${threshold}`,
          at,
          key: TRIGGERS.SPRING_TIDE,
          data: {
            ...base,
            min_coefficient: String(threshold),
            minutes_before: String(offset),
            low_tide_time: low ? formatTime(new Date(low.at), timezone) : '',
            low_tide_height: number(low?.height),
            summary: text(
              t('summarySpring', language, {
                port: port.name,
                coefficient: tide.coefficient,
                time: base.tide_time,
                low: low ? formatTime(new Date(low.at), timezone) : '?',
              }),
            ),
          },
        });
      }
    }
  }
  return events.sort((a, b) => a.at - b.at);
}

/**
 * @description Outputs of the `get_next_tide` scene action.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} port - The harbor.
 * @param {object} data - Its tide data.
 * @param {string} choice - any, high or low.
 * @param {number} at - Now (ms).
 * @param {string} timezone - IANA timezone.
 * @param {string} language - Language of the texts.
 * @returns {object} The outputs.
 */
function nextTideOutputs(gladys, port, data, choice, at, timezone, language) {
  const type = choice === TIDE_TYPES.HIGH || choice === TIDE_TYPES.LOW ? choice : undefined;
  const tide = nextTide(data.tides, at, type);
  if (!tide) {
    throw new Error(`No tide known after now for ${port.id}: see the connection status`);
  }
  const base = tideData(gladys, port, tide, timezone, language);
  const trend = trendAt(data.tides, at);
  return {
    port_name: base.port_name,
    tide: base.tide,
    tide_time: base.tide_time,
    tide_datetime: base.tide_datetime,
    minutes: minutesBetween(at, tide.at),
    height: base.height,
    coefficient: base.coefficient,
    current_height: number(heightAt(data.levels, at)),
    trend: trend ?? '',
    summary: text(
      t('summaryNext', language, {
        port: port.name,
        tide: tideSentence(tide, language, timezone),
        height: formatNumber(heightAt(data.levels, at), language, 2),
        trend: trend ? t(`trend_${trend}`, language).toLowerCase() : '?',
      }),
    ),
  };
}

export {
  TRIGGERS,
  TIDE_OFFSETS,
  SPRING_OFFSETS,
  SPRING_THRESHOLDS,
  NEXT_TIDE_CHOICES,
  eventsBetween,
  nextTideOutputs,
};
