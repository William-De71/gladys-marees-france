// The checks the host API and the Gladys front make on a discovered device,
// which the fake Gladys of the SDK does not all make (section "pièges" of the
// community feedback): should_poll, min / max / read_only / has_feedback on
// every feature, and category / type pairs that have an icon in the front.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

import {
  buildPortDevice,
  buildPortStates,
  snapshotOf,
  portIdFromExternalId,
  tideSentence,
  FEATURES,
} from '../src/device.js';
import { SNAPSHOT } from '../src/ports.js';
import { readTides, readLevels } from '../src/tides.js';
import { LANGUAGES } from '../src/i18n.js';
import { FIXTURES, NOW, TIMEZONE, fakeGladys } from './helpers/fixtures.js';

const brest = SNAPSHOT.find((port) => port.id === 'BREST');
const fdf = SNAPSHOT.find((port) => port.id === 'FORT-DE-FRANCE');
const data = { tides: readTides(FIXTURES.brestTides), levels: readLevels(FIXTURES.brestLevels) };

// Pairs with an icon in front/src/utils/consts.js (Gladys master, 2026-10-13).
const ICONS = {
  [`${CATEGORIES.LEVEL_SENSOR}/${TYPES.SENSOR.DECIMAL}`]: 'droplet',
  [`${CATEGORIES.DURATION}/${TYPES.DURATION.INTEGER}`]: 'clock',
  [`${CATEGORIES.COUNTER_SENSOR}/${TYPES.SENSOR.INTEGER}`]: 'plus',
  [`${CATEGORIES.TEXT}/${TYPES.TEXT.TEXT}`]: 'type',
};

test('a harbor device: shapes accepted by the host API, pairs with an icon', () => {
  for (const language of LANGUAGES) {
    const device = buildPortDevice(fakeGladys, brest, data, language);
    assert.equal(device.external_id, 'ext:test-integration:port:BREST');
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
    assert.equal(device.features.length, FEATURES.length);
    assert.deepEqual(device.params[0], { name: 'PORT_CODE', value: 'BREST' });
    for (const feature of device.features) {
      for (const key of ['min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[key], undefined, `${feature.external_id}.${key}`);
      }
      assert.ok(feature.min <= feature.max);
      assert.equal(feature.read_only, true);
      assert.ok(ICONS[`${feature.category}/${feature.type}`], feature.external_id);
      assert.ok(feature.name.length > 2 && feature.name.length <= 255);
    }
    assert.equal(new Set(device.features.map((f) => f.external_id)).size, device.features.length);
  }
  const fr = buildPortDevice(fakeGladys, brest, data, 'fr');
  assert.equal(fr.name, 'Marée Brest');
  assert.equal(fr.features.find((f) => f.external_id.endsWith(':height')).unit, UNITS.M);
  assert.equal(
    fr.features.find((f) => f.external_id.endsWith(':next_high_in')).unit,
    UNITS.MINUTES,
  );
});

test('a harbor without coefficient has no coefficient features', () => {
  const device = buildPortDevice(fakeGladys, fdf, { tides: [], levels: [] }, 'en');
  assert.ok(!device.features.some((f) => /coefficient/.test(f.external_id)));
  assert.equal(device.name, 'Tide Fort-de-France (Martinique)');
  // Fort-de-France gets coefficients by correlation in its data.
  const withData = buildPortDevice(fakeGladys, fdf, {
    tides: readTides(FIXTURES.fdfTides),
    levels: [],
  });
  assert.ok(withData.features.some((f) => f.external_id.endsWith(':coefficient')));
});

test('states at 18:00 in Paris: rising, high tide at 20:22', () => {
  const snapshot = snapshotOf(data, NOW, TIMEZONE);
  const states = Object.fromEntries(
    buildPortStates(fakeGladys, brest, snapshot, 'fr', TIMEZONE).map((s) => [
      s.device_feature_external_id.split(':').at(-1),
      s.state ?? s.text,
    ]),
  );
  assert.deepEqual(states, {
    height: snapshot.height,
    trend: 'Montante',
    next_tide: 'Pleine mer à 20:22 (6,07 m, coef. 62)',
    next_high_in: 142,
    next_high_height: 6.07,
    next_low_in: 528,
    next_low_height: 2.42,
    coefficient: 62,
    coefficient_tomorrow: 56,
  });
  assert.ok(snapshot.height > 4 && snapshot.height < 6);
  // Unknown values are not published (never 0).
  const empty = buildPortStates(
    fakeGladys,
    brest,
    snapshotOf({ tides: [], levels: [] }, NOW, TIMEZONE),
    'en',
    TIMEZONE,
  );
  assert.deepEqual(empty, []);
});

test('texts and ids', () => {
  const low = {
    type: 'low',
    at: Date.parse('2026-10-16T00:48:00Z'),
    height: 2.42,
    coefficient: 56,
  };
  assert.equal(tideSentence(low, 'en', TIMEZONE), 'Low tide at 02:48 (2.42 m)');
  assert.equal(tideSentence(null, 'en', TIMEZONE), null);
  assert.equal(
    portIdFromExternalId('ext:marees-france:port:FORT-DE-FRANCE:height'),
    'FORT-DE-FRANCE',
  );
  assert.equal(
    portIdFromExternalId('ext:marees-france:port:ABER_BENOIT_MEAN_RENEAT'),
    'ABER_BENOIT_MEAN_RENEAT',
  );
  assert.equal(portIdFromExternalId('nothing'), null);
  assert.equal(portIdFromExternalId(undefined), null);
});
