import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  readTides,
  readLevels,
  readCoefficients,
  heightAt,
  nextTide,
  previousTide,
  trendAt,
  tidesOfDay,
  maxCoefficient,
  levelsOfDay,
  minutesBetween,
  addDays,
  utcInstant,
  MINUTE,
} from '../src/tides.js';
import { FIXTURES, NOW, TIMEZONE } from './helpers/fixtures.js';

const tides = readTides(FIXTURES.brestTides);
const levels = readLevels(FIXTURES.brestLevels);
const at = (iso) => Date.parse(iso);

test('tides: UTC instants, heights, coefficients; empty slots skipped', () => {
  assert.equal(tides.length, 30);
  const day = tides.filter((tide) => new Date(tide.at).toISOString().startsWith('2026-10-15'));
  assert.deepEqual(day, [
    { type: 'low', at: at('2026-10-15T00:16:00Z'), height: 2.03, coefficient: 68 },
    { type: 'high', at: at('2026-10-15T06:06:00Z'), height: 6.39, coefficient: 68 },
    { type: 'low', at: at('2026-10-15T12:35:00Z'), height: 2.13, coefficient: 62 },
    { type: 'high', at: at('2026-10-15T18:22:00Z'), height: 6.07, coefficient: 62 },
  ]);
  // The 14th has three tides only ("tide.none" in the fourth slot).
  assert.equal(tides.filter((tide) => new Date(tide.at).getUTCDate() === 14).length, 3);
  // A low tide takes the coefficient of the nearest high tide.
  assert.equal(tides.find((tide) => tide.at === at('2026-10-14T12:01:00Z')).coefficient, 74);
  assert.deepEqual(readTides(null), []);
  assert.deepEqual(readTides({ x: 'y', '2026-10-15': [['tide.high', '--:--', '---', '---']] }), []);
});

test('overseas harbor: two tides a day, a coefficient by correlation', () => {
  const fdf = readTides(FIXTURES.fdfTides);
  assert.ok(fdf.length >= 14);
  assert.ok(fdf.every((tide) => tide.height < 1.5));
  assert.ok(fdf.some((tide) => tide.coefficient !== null));
});

test('water heights: every 5 minutes, interpolated in between', () => {
  assert.equal(levels.length, 3 * 288);
  assert.equal(heightAt(levels, at('2026-10-15T00:00:00Z')), 2.05);
  const a = heightAt(levels, at('2026-10-15T16:00:00Z'));
  const b = heightAt(levels, at('2026-10-15T16:05:00Z'));
  const middle = heightAt(levels, at('2026-10-15T16:02:30Z'));
  assert.ok(Math.abs(middle - (a + b) / 2) <= 0.01);
  // Close to the predicted high tide.
  assert.ok(Math.abs(heightAt(levels, at('2026-10-15T18:22:00Z')) - 6.07) < 0.05);
  assert.equal(heightAt(levels, at('2026-10-20T00:00:00Z')), null);
  assert.equal(heightAt([], NOW), null);
  // A hole in the data is not interpolated across.
  assert.equal(
    heightAt(
      [
        { at: 0, height: 1 },
        { at: 60 * MINUTE, height: 2 },
      ],
      30 * MINUTE,
    ),
    null,
  );
});

test('next, previous, trend', () => {
  assert.equal(nextTide(tides, NOW).at, at('2026-10-15T18:22:00Z'));
  assert.equal(nextTide(tides, NOW, 'low').at, at('2026-10-16T00:48:00Z'));
  assert.equal(previousTide(tides, NOW).at, at('2026-10-15T12:35:00Z'));
  assert.equal(trendAt(tides, NOW), 'rising');
  assert.equal(trendAt(tides, at('2026-10-15T19:00:00Z')), 'falling');
  assert.equal(trendAt([], NOW), null);
  assert.equal(nextTide(tides, at('2026-10-30T00:00:00Z')), null);
});

test('local days: tides, highest coefficient, chart points (DST change included)', () => {
  // 18:22 UTC is 20:22 in Paris: still the 15th.
  assert.equal(tidesOfDay(tides, '2026-10-15', TIMEZONE).length, 4);
  assert.equal(maxCoefficient(tides, '2026-10-15', TIMEZONE), 68);
  assert.equal(maxCoefficient(tides, addDays('2026-10-15'), TIMEZONE), 56);
  assert.equal(maxCoefficient(tides, '2027-01-01', TIMEZONE), null);
  // The local day of Paris: 22:00 UTC the day before to 22:00 UTC.
  const points = levelsOfDay(levels, '2026-10-15', TIMEZONE);
  assert.equal(points.length, 288);
  assert.equal(points[0].at, at('2026-10-14T22:00:00Z'));
  // 2026-10-25 lasts 25 hours in Paris: 300 points, the chart maximum.
  const synthetic = Array.from({ length: 4 * 288 }, (_, i) => ({
    at: at('2026-10-24T00:00:00Z') + i * 5 * MINUTE,
    height: 3,
  }));
  assert.equal(levelsOfDay(synthetic, '2026-10-25', TIMEZONE).length, 300);
  assert.ok(levelsOfDay(synthetic, '2026-10-25', 'UTC').length === 288);
});

test('coefficients per day, as the coeff service groups them', () => {
  const days = readCoefficients(FIXTURES.brestCoefficients, '2026-10-15');
  assert.equal(days.length, 14);
  assert.deepEqual(days[0], { day: '2026-10-15', coefficients: [68, 62], max: 68 });
  assert.deepEqual(days[6], { day: '2026-10-21', coefficients: [41], max: 41 });
  assert.equal(days[12].max, 100);
  assert.deepEqual(readCoefficients([[[['95'], '98']]], '2026-12-31'), [
    { day: '2026-12-31', coefficients: [95, 98], max: 98 },
  ]);
  assert.deepEqual(readCoefficients({}, '2026-10-15'), []);
});

test('helpers', () => {
  assert.equal(minutesBetween(NOW, NOW + 30 * 1000), 1);
  assert.equal(minutesBetween(NOW, NOW - 1), 0);
  assert.equal(addDays('2026-12-31'), '2027-01-01');
  assert.equal(utcInstant('2026-10-15', '25:00'), null);
});
