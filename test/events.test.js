import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  eventsBetween,
  nextTideOutputs,
  TRIGGERS,
  TIDE_OFFSETS,
  SPRING_OFFSETS,
  SPRING_THRESHOLDS,
} from '../src/events.js';
import { SNAPSHOT } from '../src/ports.js';
import { readTides, readLevels, DAY } from '../src/tides.js';
import { LANGUAGES } from '../src/i18n.js';
import { FIXTURES, NOW, TIMEZONE, fakeGladys } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const brest = SNAPSHOT.find((port) => port.id === 'BREST');
const data = { tides: readTides(FIXTURES.brestTides), levels: readLevels(FIXTURES.brestLevels) };
const from = Date.parse('2026-10-14T00:00:00Z');
const all = eventsBetween(
  fakeGladys,
  brest,
  data.tides,
  { from, to: from + 7 * DAY },
  TIMEZONE,
  'fr',
);

/**
 * @description Assert an event payload respects the limits of the core.
 * @param {object} data - The data.
 */
function assertFlat(data) {
  assert.ok(Object.keys(data).length <= 30);
  for (const [key, value] of Object.entries(data)) {
    assert.ok(
      value === null || ['string', 'number', 'boolean'].includes(typeof value),
      `${key} is scalar`,
    );
    if (typeof value === 'string') {
      assert.ok(value.length <= 1000, key);
    }
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), key);
    }
  }
}

test('one tide_upcoming event per tide and per offset, at the right instant', () => {
  const upcoming = all.filter((event) => event.key === TRIGGERS.TIDE_UPCOMING);
  const highAt = Date.parse('2026-10-15T18:22:00Z');
  const ofTide = upcoming.filter(
    (event) => event.data.tide_datetime === new Date(highAt).toISOString(),
  );
  assert.deepEqual(
    ofTide.map((event) => [event.data.minutes_before, highAt - event.at]),
    TIDE_OFFSETS.map((offset) => [String(offset), offset * 60000]).sort((a, b) => b[1] - a[1]),
  );
  const now = ofTide.find((event) => event.data.minutes_before === '0');
  assert.deepEqual(
    { ...now.data, summary: undefined },
    {
      port: 'ext:test-integration:port:BREST',
      port_name: 'Marée Brest',
      tide: 'high',
      tide_time: '20:22',
      tide_datetime: '2026-10-15T18:22:00.000Z',
      height: 6.07,
      coefficient: 62,
      minutes_before: '0',
      summary: undefined,
    },
  );
  assert.equal(now.data.summary, 'Brest : Pleine mer à 20:22 (6,07 m, coef. 62)');
  const soon = ofTide.find((event) => event.data.minutes_before === '30');
  assert.equal(soon.data.summary, 'Brest : dans 30 min, Pleine mer à 20:22 (6,07 m, coef. 62)');
  assert.equal(new Set(all.map((event) => event.id)).size, all.length);
  all.forEach((event) => assertFlat(event.data));
});

test('spring_tide: one event per threshold reached and per offset', () => {
  const spring = all.filter((event) => event.key === TRIGGERS.SPRING_TIDE);
  // 2026-10-14 05:35 UTC: coefficient 79, only the threshold 70.
  const first = spring.filter((event) => event.data.tide_datetime === '2026-10-14T05:35:00.000Z');
  assert.deepEqual([...new Set(first.map((event) => event.data.min_coefficient))], ['70']);
  assert.deepEqual(
    first.map((event) => event.data.minutes_before),
    SPRING_OFFSETS.filter((offset) => Date.parse('2026-10-14T05:35:00Z') - offset * 60000 > from)
      .map(String)
      .reverse(),
  );
  assert.equal(first[0].data.low_tide_time, '14:01');
  assert.ok(spring.every((event) => Number(event.data.min_coefficient) <= event.data.coefficient));
  assert.ok(spring.every((event) => event.data.tide === 'high'));
});

test('the window excludes its start: an event is never in two windows', () => {
  const at = Date.parse('2026-10-15T18:22:00Z');
  const before = eventsBetween(
    fakeGladys,
    brest,
    data.tides,
    { from: at - 60000, to: at },
    TIMEZONE,
    'en',
  );
  const after = eventsBetween(
    fakeGladys,
    brest,
    data.tides,
    { from: at, to: at + 60000 },
    TIMEZONE,
    'en',
  );
  assert.ok(before.some((event) => event.data.minutes_before === '0'));
  assert.ok(
    !after.some(
      (event) =>
        event.data.tide_datetime === '2026-10-15T18:22:00.000Z' &&
        event.data.minutes_before === '0',
    ),
  );
});

test('event keys, filters and variables match the manifest', () => {
  const triggers = byKey(manifest.scene_triggers);
  assert.deepEqual([...triggers.keys()].sort(), Object.values(TRIGGERS).sort());
  const values = (trigger, field) =>
    byKey(triggers.get(trigger).fields)
      .get(field)
      .options.map((option) => option.value);
  assert.deepEqual(values('tide_upcoming', 'minutes_before'), TIDE_OFFSETS.map(String));
  assert.deepEqual(values('spring_tide', 'minutes_before'), SPRING_OFFSETS.map(String));
  assert.deepEqual(values('spring_tide', 'min_coefficient'), SPRING_THRESHOLDS.map(String));
  assert.deepEqual(values('tide_upcoming', 'tide'), ['high', 'low']);
  for (const event of all) {
    const trigger = triggers.get(event.key);
    for (const field of trigger.fields) {
      assert.ok(field.key in event.data, `${event.key} filters on ${field.key}`);
      assert.equal(typeof event.data[field.key], 'string', 'select values are strings');
    }
    for (const variable of trigger.variables) {
      assert.ok(variable.key in event.data, `${event.key}.${variable.key}`);
      assert.equal(
        typeof event.data[variable.key],
        variable.type === 'number' ? 'number' : 'string',
      );
    }
  }
  // The filters a spring tide scene must fill: no wildcard on the choices.
  for (const key of ['minutes_before', 'min_coefficient']) {
    assert.equal(byKey(triggers.get('spring_tide').fields).get(key).required, true);
  }
  assert.equal(byKey(triggers.get('tide_upcoming').fields).get('minutes_before').required, true);
});

test('get_next_tide returns its declared outputs only', () => {
  const declared = byKey(manifest.scene_actions).get('get_next_tide').outputs;
  for (const language of LANGUAGES) {
    for (const choice of ['any', 'high', 'low', undefined]) {
      const outputs = nextTideOutputs(fakeGladys, brest, data, choice, NOW, TIMEZONE, language);
      assert.deepEqual(Object.keys(outputs).sort(), declared.map((o) => o.key).sort());
      for (const output of declared) {
        assert.equal(typeof outputs[output.key], output.type === 'number' ? 'number' : 'string');
      }
    }
  }
  const low = nextTideOutputs(fakeGladys, brest, data, 'low', NOW, TIMEZONE, 'en');
  assert.equal(low.tide, 'low');
  assert.equal(low.tide_time, '02:48');
  assert.equal(low.minutes, 528);
  assert.equal(low.trend, 'rising');
  assert.match(
    low.summary,
    /^Brest: Low tide at 02:48 \(2\.42 m\)\. Water height now \d\.\d+ m, rising\.$/,
  );
  assert.throws(() =>
    nextTideOutputs(fakeGladys, brest, { tides: [], levels: [] }, 'any', NOW, TIMEZONE, 'en'),
  );
});
