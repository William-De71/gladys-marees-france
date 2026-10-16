// -----------------------------------------------------------------------------
// Tide computations, pure functions on the data of the SHOM.
//
// Every instant is a UTC timestamp in milliseconds: the SHOM is asked in UTC
// (utc=0, see shom-api.js) and the local days and times are computed with
// the timezone of Gladys (time.js) only for display and for the "today" /
// "tomorrow" boundaries.
//
// Heights are in metres above the chart datum (zéro hydrographique), as the
// SHOM publishes them; a coefficient (20 to 120) belongs to a high tide.
// -----------------------------------------------------------------------------

import { localDay, zonedTime } from './time.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TIDE_TYPES = { HIGH: 'high', LOW: 'low' };
// A water height read between two points 5 minutes apart; a gap larger
// than this means missing data, not something to interpolate across.
const MAX_LEVEL_GAP_MS = 15 * MINUTE;
const MAX_CHART_POINTS = 300;

/**
 * @description A number of the SHOM ("6.39"), null for "---" and garbage.
 * @param {unknown} raw - The raw value.
 * @returns {number|null} The number.
 */
function readNumber(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== 'string' || !/^-?\d+(\.\d+)?$/.test(raw.trim())) {
    return null;
  }
  return Number(raw.trim());
}

/**
 * @description The UTC instant of a day key and a "HH:MM" or "HH:MM:SS" time.
 * @param {string} day - YYYY-MM-DD.
 * @param {string} time - The time.
 * @returns {number|null} The instant (ms).
 */
function utcInstant(day, time) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  const clock = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time ?? '');
  if (!date || !clock || Number(clock[1]) > 23 || Number(clock[2]) > 59) {
    return null;
  }
  return Date.UTC(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    Number(clock[1]),
    Number(clock[2]),
    Number(clock[3] ?? 0),
  );
}

/**
 * @description The high and low tides of an hlt answer (utc=0), sorted. A
 * low tide takes the coefficient of the nearest high tide (the tidal range it
 * belongs to): that is what a "low tide with a coefficient of 95" means to
 * someone fishing on foot.
 * @param {object} json - `{ "YYYY-MM-DD": [["tide.high", "HH:MM", "6.39", "68"], ...] }`.
 * @returns {Array<{ type: string, at: number, height: number, coefficient: number|null }>} The tides.
 * @example
 * readTides(await shom.tides('BREST', '2026-10-14'));
 */
function readTides(json) {
  const tides = [];
  for (const [day, entries] of Object.entries(json ?? {})) {
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      if (!Array.isArray(entry)) {
        continue;
      }
      const [kind, time, height, coefficient] = entry;
      const type =
        kind === 'tide.high' ? TIDE_TYPES.HIGH : kind === 'tide.low' ? TIDE_TYPES.LOW : null;
      const at = utcInstant(day, time);
      const meters = readNumber(height);
      if (!type || at === null || meters === null) {
        continue;
      }
      const coef = readNumber(coefficient);
      tides.push({
        type,
        at,
        height: meters,
        coefficient: type === TIDE_TYPES.HIGH && coef !== null ? Math.round(coef) : null,
      });
    }
  }
  tides.sort((a, b) => a.at - b.at);
  const deduped = tides.filter((tide, i) => i === 0 || tide.at !== tides[i - 1].at);
  const highs = deduped.filter((tide) => tide.type === TIDE_TYPES.HIGH && tide.coefficient);
  for (const tide of deduped) {
    if (tide.type === TIDE_TYPES.LOW && highs.length > 0) {
      const nearest = highs.reduce((best, high) =>
        Math.abs(high.at - tide.at) < Math.abs(best.at - tide.at) ? high : best,
      );
      tide.coefficient = Math.abs(nearest.at - tide.at) < 9 * HOUR ? nearest.coefficient : null;
    }
  }
  return deduped;
}

/**
 * @description The water heights of a wl answer (utc=0), sorted.
 * @param {object} json - `{ "YYYY-MM-DD": [["HH:MM:SS", 3.2], ...] }`.
 * @returns {Array<{ at: number, height: number }>} The heights.
 */
function readLevels(json) {
  const levels = [];
  for (const [day, entries] of Object.entries(json ?? {})) {
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      const at = Array.isArray(entry) ? utcInstant(day, entry[0]) : null;
      const height = Array.isArray(entry) ? readNumber(entry[1]) : null;
      if (at !== null && height !== null) {
        levels.push({ at, height });
      }
    }
  }
  levels.sort((a, b) => a.at - b.at);
  return levels.filter((level, i) => i === 0 || level.at !== levels[i - 1].at);
}

/**
 * @description The daily coefficients of a coeff answer: a list of months,
 * each a list of days starting at the asked date, each a list of the
 * coefficients of the day's high tides (strings, sometimes wrapped once
 * more in a list).
 * @param {Array} json - The answer.
 * @param {string} startDay - The asked UTC day, YYYY-MM-DD.
 * @returns {Array<{ day: string, coefficients: Array<number>, max: number }>} The days.
 */
function readCoefficients(json, startDay) {
  const start = utcInstant(startDay, '00:00');
  if (!Array.isArray(json) || start === null) {
    return [];
  }
  const days = [];
  for (const month of json) {
    if (!Array.isArray(month)) {
      continue;
    }
    for (const daily of month) {
      const values = (Array.isArray(daily) ? daily : [])
        .map((item) => readNumber(Array.isArray(item) ? item[0] : item))
        .filter((value) => value !== null)
        .map(Math.round);
      const day = new Date(start + days.length * DAY).toISOString().slice(0, 10);
      days.push({ day, coefficients: values, max: values.length ? Math.max(...values) : null });
    }
  }
  return days.filter((entry) => entry.max !== null);
}

/**
 * @description The water height at an instant, linearly interpolated.
 * @param {Array<{ at: number, height: number }>} levels - The heights.
 * @param {number} at - The instant.
 * @returns {number|null} The height (2 decimals), null outside the data.
 */
function heightAt(levels, at) {
  if (!levels.length || at < levels[0].at || at > levels[levels.length - 1].at) {
    return null;
  }
  let low = 0;
  let high = levels.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (levels[middle].at <= at) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const a = levels[low];
  const b = levels[high];
  if (a.at === at || a === b) {
    return a.height;
  }
  if (b.at - a.at > MAX_LEVEL_GAP_MS) {
    return null;
  }
  const value = a.height + ((b.height - a.height) * (at - a.at)) / (b.at - a.at);
  return Math.round(value * 100) / 100;
}

/**
 * @description The next tide after an instant (strictly later), of a type.
 * @param {Array<object>} tides - The tides.
 * @param {number} at - The instant.
 * @param {string} [type] - high, low, or any when absent.
 * @returns {object|null} The tide.
 */
const nextTide = (tides, at, type) =>
  tides.find((tide) => tide.at > at && (!type || tide.type === type)) ?? null;

/**
 * @description The last tide at or before an instant.
 * @param {Array<object>} tides - The tides.
 * @param {number} at - The instant.
 * @returns {object|null} The tide.
 */
function previousTide(tides, at) {
  for (let i = tides.length - 1; i >= 0; i -= 1) {
    if (tides[i].at <= at) {
      return tides[i];
    }
  }
  return null;
}

/**
 * @description Rising or falling: the tide goes towards the next extreme.
 * @param {Array<object>} tides - The tides.
 * @param {number} at - The instant.
 * @returns {'rising'|'falling'|null} The trend, null without a next tide.
 */
function trendAt(tides, at) {
  const next = nextTide(tides, at);
  if (!next) {
    return null;
  }
  return next.type === TIDE_TYPES.HIGH ? 'rising' : 'falling';
}

/**
 * @description The local day after a day.
 * @param {string} day - YYYY-MM-DD.
 * @param {number} [count] - Days to add.
 * @returns {string} YYYY-MM-DD.
 */
function addDays(day, count = 1) {
  const start = utcInstant(day, '00:00');
  return new Date(start + count * DAY).toISOString().slice(0, 10);
}

/**
 * @description The tides of a local day (timezone of Gladys).
 * @param {Array<object>} tides - The tides.
 * @param {string} day - The local day, YYYY-MM-DD.
 * @param {string} timezone - IANA timezone.
 * @returns {Array<object>} The tides of that day.
 */
const tidesOfDay = (tides, day, timezone) =>
  tides.filter((tide) => localDay(new Date(tide.at), timezone) === day);

/**
 * @description The highest coefficient of a local day.
 * @param {Array<object>} tides - The tides.
 * @param {string} day - The local day.
 * @param {string} timezone - IANA timezone.
 * @returns {number|null} The coefficient.
 */
function maxCoefficient(tides, day, timezone) {
  const values = tidesOfDay(tides, day, timezone)
    .filter((tide) => tide.type === TIDE_TYPES.HIGH && tide.coefficient !== null)
    .map((tide) => tide.coefficient);
  return values.length ? Math.max(...values) : null;
}

/**
 * @description The water heights of a local day, for a chart (at most 300
 * points: 288 on a normal day, 300 on the 25-hour day of the autumn change).
 * @param {Array<{ at: number, height: number }>} levels - The heights.
 * @param {string} day - The local day.
 * @param {string} timezone - IANA timezone.
 * @returns {Array<{ at: number, height: number }>} The points.
 */
function levelsOfDay(levels, day, timezone) {
  const start = zonedTime(day, 0, timezone).getTime();
  const end = zonedTime(addDays(day), 0, timezone).getTime();
  const points = levels.filter((level) => level.at >= start && level.at < end);
  if (points.length <= MAX_CHART_POINTS) {
    return points;
  }
  const step = Math.ceil(points.length / MAX_CHART_POINTS);
  return points.filter((_, i) => i % step === 0);
}

/**
 * @description Whole minutes from an instant to a later one (rounded up: a
 * tide 30 s away is "in 1 minute").
 * @param {number} from - The current instant.
 * @param {number} to - The later instant.
 * @returns {number} Minutes, 0 when reached.
 */
const minutesBetween = (from, to) => Math.max(0, Math.ceil((to - from) / MINUTE));

export {
  MINUTE,
  HOUR,
  DAY,
  TIDE_TYPES,
  MAX_CHART_POINTS,
  readNumber,
  utcInstant,
  readTides,
  readLevels,
  readCoefficients,
  heightAt,
  nextTide,
  previousTide,
  trendAt,
  addDays,
  tidesOfDay,
  maxCoefficient,
  levelsOfDay,
  minutesBetween,
};
