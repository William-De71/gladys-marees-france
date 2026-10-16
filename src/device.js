// -----------------------------------------------------------------------------
// The devices of the Marées France integration: one per harbor, offered on
// the Discovery screen, named "Tide <harbor>" ("Marée Brest").
//
// Category / type pairs come from DEVICE_FEATURE_CATEGORIES of the SDK, with
// an icon in the Gladys front (front/src/utils/consts.js): Gladys has no tide
// category, a water height is a `level-sensor` / `decimal` in metres (the
// droplet icon), a countdown a `duration` / `integer` in minutes, a
// coefficient a `counter-sensor` / `integer` (20 to 120, no unit).
//
//   - height               water height now (interpolated, 5-minute data)
//   - trend                text: rising / falling
//   - next_tide            text: "High tide at 20:22 (6.07 m, coef. 62)"
//   - next_high_in         minutes to the next high tide
//   - next_high_height     height of the next high tide
//   - next_low_in          minutes to the next low tide
//   - next_low_height      height of the next low tide
//   - coefficient          coefficient of the next high tide   (harbors with
//   - coefficient_tomorrow highest coefficient of tomorrow      coefficients)
//
// External ids: the SHOM code of the harbor (BREST, FORT-DE-FRANCE): never
// a name. The data comes from a daily download and the states from the
// integration's own minute timer, so `should_poll` is false.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t, formatNumber } from './i18n.js';
import { displayName } from './ports.js';
import { formatTime, localDay } from './time.js';
import {
  TIDE_TYPES,
  heightAt,
  nextTide,
  trendAt,
  maxCoefficient,
  minutesBetween,
  addDays,
} from './tides.js';

const DEVICE_TYPE = 'port';
// Chart datum of the SHOM: a little below the lowest tides; the highest
// tides of France reach about 15 m (Granville, Mont-Saint-Michel bay).
const HEIGHT = { min: -5, max: 20 };
// A tide comes back every 12 h 25 min, a neap tide may leave one a day.
const MAX_MINUTES = 1500;

const sensor = { read_only: true, has_feedback: false, keep_history: true };
const height = {
  ...sensor,
  category: CATEGORIES.LEVEL_SENSOR,
  type: TYPES.SENSOR.DECIMAL,
  unit: UNITS.M,
  min: HEIGHT.min,
  max: HEIGHT.max,
};
const countdown = {
  ...sensor,
  keep_history: false,
  category: CATEGORIES.DURATION,
  type: TYPES.DURATION.INTEGER,
  unit: UNITS.MINUTES,
  min: 0,
  max: MAX_MINUTES,
};
const coefficient = {
  ...sensor,
  category: CATEGORIES.COUNTER_SENSOR,
  type: TYPES.SENSOR.INTEGER,
  min: 0,
  max: 130,
};
const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
};

/**
 * @description "High tide at 20:22 (6.07 m, coef. 62)".
 * @param {object|null} tide - The tide.
 * @param {string} language - The language.
 * @param {string} timezone - IANA timezone.
 * @returns {string|null} The text.
 */
function tideSentence(tide, language, timezone) {
  if (!tide) {
    return null;
  }
  const values = {
    time: formatTime(new Date(tide.at), timezone),
    height: formatNumber(tide.height, language, 2),
    coefficient: tide.coefficient ?? '',
  };
  const key = `${tide.type}TideAt${tide.coefficient && tide.type === TIDE_TYPES.HIGH ? 'Coef' : ''}`;
  return t(key, language, values);
}

// The features: key, name (TEXTS key), shape, whether only harbors with
// coefficients have it, and the state of a snapshot (a number, `{ text }`,
// or null when unknown: not published).
const FEATURES = [
  { key: 'height', name: 'featureHeight', shape: height, state: (s) => s.height },
  {
    key: 'trend',
    name: 'featureTrend',
    shape: text,
    state: (s, language) => (s.trend ? { text: t(`trend_${s.trend}`, language) } : null),
  },
  {
    key: 'next_tide',
    name: 'featureNextTide',
    shape: text,
    state: (s, language, timezone) => {
      const sentence = tideSentence(s.next, language, timezone);
      return sentence ? { text: sentence } : null;
    },
  },
  {
    key: 'next_high_in',
    name: 'featureNextHighIn',
    shape: countdown,
    state: (s) => (s.nextHigh ? minutesBetween(s.at, s.nextHigh.at) : null),
  },
  {
    key: 'next_high_height',
    name: 'featureNextHighHeight',
    shape: height,
    state: (s) => s.nextHigh?.height ?? null,
  },
  {
    key: 'next_low_in',
    name: 'featureNextLowIn',
    shape: countdown,
    state: (s) => (s.nextLow ? minutesBetween(s.at, s.nextLow.at) : null),
  },
  {
    key: 'next_low_height',
    name: 'featureNextLowHeight',
    shape: height,
    state: (s) => s.nextLow?.height ?? null,
  },
  {
    key: 'coefficient',
    name: 'featureCoefficient',
    shape: coefficient,
    withCoefficient: true,
    state: (s) => s.nextHigh?.coefficient ?? null,
  },
  {
    key: 'coefficient_tomorrow',
    name: 'featureCoefficientTomorrow',
    shape: coefficient,
    withCoefficient: true,
    state: (s) => s.tomorrowCoefficient,
  },
];

/**
 * @description The external ids of a harbor device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} portId - The SHOM code.
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, 'BREST').device; // -> 'ext:marees-france:port:BREST'
 */
const idsOf = (gladys, portId) => gladys.externalIds(DEVICE_TYPE, portId);

/**
 * @description The SHOM code a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {string|null} The code.
 * @example
 * portIdFromExternalId('ext:marees-france:port:BREST:height'); // -> 'BREST'
 */
function portIdFromExternalId(externalId) {
  const match = /:port:([A-Za-z0-9_'-]+?)(?::[a-z_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description The name of a harbor device: "Marée Brest".
 * @param {object} port - The harbor.
 * @param {string} language - The language.
 * @returns {string} The name.
 */
const deviceName = (port, language) => t('deviceName', language, { port: displayName(port) });

/**
 * @description Whether a harbor publishes coefficients: the SHOM flag, or a
 * coefficient in its data (overseas harbors get one by correlation).
 * @param {object} port - The harbor.
 * @param {object|null} data - Its tide data.
 * @returns {boolean} True when it has coefficients.
 */
const hasCoefficients = (port, data) =>
  Boolean(port.coefficient || data?.tides?.some((tide) => tide.coefficient !== null));

/**
 * @description The device of a harbor.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} port - The harbor (ports.js).
 * @param {object|null} data - Its tide data, to know whether it has coefficients.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildPortDevice(gladys, port, data, language = 'en') {
  const ids = idsOf(gladys, port.id);
  const coefficients = hasCoefficients(port, data);
  return {
    name: deviceName(port, language),
    external_id: ids.device,
    model: 'SHOM',
    should_poll: false,
    params: [
      { name: 'PORT_CODE', value: port.id },
      ...(port.lat !== null && port.lon !== null
        ? [{ name: 'COORDINATES', value: `${port.lat},${port.lon}` }]
        : []),
    ],
    features: FEATURES.filter((spec) => !spec.withCoefficient || coefficients).map((spec) => ({
      name: t(spec.name, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The state of a harbor at an instant, out of its data.
 * @param {object} data - `{ tides, levels }`.
 * @param {number} at - The instant (ms).
 * @param {string} timezone - IANA timezone.
 * @returns {object} `{ at, height, trend, next, nextHigh, nextLow, tomorrowCoefficient }`.
 */
function snapshotOf(data, at, timezone) {
  const tides = data?.tides ?? [];
  return {
    at,
    height: heightAt(data?.levels ?? [], at),
    trend: trendAt(tides, at),
    next: nextTide(tides, at),
    nextHigh: nextTide(tides, at, TIDE_TYPES.HIGH),
    nextLow: nextTide(tides, at, TIDE_TYPES.LOW),
    tomorrowCoefficient: maxCoefficient(tides, addDays(localDay(new Date(at), timezone)), timezone),
  };
}

/**
 * @description The states of a harbor device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} port - The harbor.
 * @param {object} snapshot - snapshotOf.
 * @param {string} language - Language of the texts.
 * @param {string} timezone - IANA timezone.
 * @returns {Array<object>} The states.
 */
function buildPortStates(gladys, port, snapshot, language, timezone) {
  const ids = idsOf(gladys, port.id);
  return FEATURES.flatMap((spec) => {
    const value = spec.state(snapshot, language, timezone);
    if (value === null || value === undefined) {
      return [];
    }
    const id = ids.feature(spec.key);
    return [
      typeof value === 'object'
        ? { device_feature_external_id: id, text: value.text }
        : { device_feature_external_id: id, state: value },
    ];
  });
}

export {
  DEVICE_TYPE,
  HEIGHT,
  MAX_MINUTES,
  FEATURES,
  idsOf,
  portIdFromExternalId,
  deviceName,
  hasCoefficients,
  tideSentence,
  buildPortDevice,
  snapshotOf,
  buildPortStates,
};
