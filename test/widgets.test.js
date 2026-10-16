// Every widget content through validateWidgetContent (the checks of the core,
// which only run in debug mode in production) and the content budget of a
// card, in the four languages and in the edge cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildTodayWidget,
  buildListWidget,
  buildCoefficientsWidget,
  messageContent,
  coefficientColor,
} from '../src/widgets.js';
import { SNAPSHOT } from '../src/ports.js';
import { readTides, readLevels, readCoefficients } from '../src/tides.js';
import { LANGUAGES } from '../src/i18n.js';
import { FIXTURES, NOW, TIMEZONE } from './helpers/fixtures.js';

const brest = SNAPSHOT.find((port) => port.id === 'BREST');
const data = {
  tides: readTides(FIXTURES.brestTides),
  levels: readLevels(FIXTURES.brestLevels),
  coefficients: readCoefficients(FIXTURES.brestCoefficients, '2026-10-15'),
};
const types = (content) => content.components.map((component) => component.type);

/**
 * @description Assert a content is valid and within the budget of a card.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
  const count = (list) => types(content).filter((type) => list.includes(type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
  for (const component of content.components) {
    if (component.type === 'value') {
      assert.ok(typeof component.value === 'number' || component.value.length <= 12, label);
      assert.ok(component.label.length <= 24, `${label}: ${component.label}`);
    }
    for (const annotation of component.annotations ?? []) {
      assert.ok(annotation.label.length <= 16, label);
    }
  }
}

const builders = { buildTodayWidget, buildListWidget, buildCoefficientsWidget };

test('every widget, in every language, is valid and within the budget', () => {
  for (const [name, build] of Object.entries(builders)) {
    for (const language of LANGUAGES) {
      assertValid(
        build({ port: brest, data, now: NOW, timezone: TIMEZONE, language }),
        `${name} ${language}`,
      );
    }
  }
});

test('tide of the day: tiles, the curve of the local day and its four tides', () => {
  const content = buildTodayWidget({
    port: brest,
    data,
    now: NOW,
    timezone: TIMEZONE,
    language: 'fr',
  });
  assert.deepEqual(types(content), ['text', 'value', 'value', 'value', 'value', 'chart', 'text']);
  const [, height, trend, next, coefficient, chart] = content.components;
  assert.equal(height.unit, 'm');
  assert.equal(trend.value, 'Montante');
  assert.deepEqual([next.value, next.label], ['20:22', 'Pleine mer']);
  assert.equal(coefficient.value, 62);
  assert.equal(chart.series[0].points.length, 288);
  assert.equal(chart.series[0].points[0].t, '2026-10-14T22:00:00.000Z');
  assert.deepEqual(
    chart.annotations.map((a) => a.label),
    ['BM 02:16', 'PM 08:06', 'BM 14:35', 'PM 20:22'],
  );
  assert.equal(chart.now_marker, true);
});

test('next tides: eight cards, dated, coefficient badges', () => {
  const content = buildListWidget({
    port: brest,
    data,
    now: NOW,
    timezone: TIMEZONE,
    language: 'en',
  });
  const list = content.components.find((c) => c.type === 'card-list');
  assert.equal(list.items.length, 8);
  assert.deepEqual(list.items[0], {
    title: 'High tide · 6.07 m',
    date: '2026-10-15T18:22:00.000Z',
    badge: { text: 'Coef. 62', color: 'neutral' },
  });
  assert.equal(list.items[1].badge.color, 'neutral');
  const none = buildListWidget({
    port: brest,
    data: { ...data, tides: [] },
    now: NOW,
    timezone: TIMEZONE,
    language: 'en',
  });
  assert.deepEqual(types(none), ['text']);
});

test('coefficients: two weeks of bars, the peak and the next spring tide', () => {
  const content = buildCoefficientsWidget({
    port: brest,
    data,
    now: NOW,
    timezone: TIMEZONE,
    language: 'fr',
  });
  const chart = content.components.find((c) => c.type === 'chart');
  assert.equal(chart.series[0].points.length, 14);
  assert.equal(chart.chart_type, 'bar');
  const tiles = content.components.filter((c) => c.type === 'value');
  assert.equal(tiles[0].value, 68);
  assert.equal(tiles[1].value, 100);
  assert.match(tiles[1].label, /^Pic /);
  assert.match(tiles[2].value, /oct/);
  const none = buildCoefficientsWidget({
    port: brest,
    data: { ...data, coefficients: [] },
    now: NOW,
    timezone: TIMEZONE,
    language: 'de',
  });
  assertValid(none, 'no coefficients');
});

test('helpers', () => {
  assertValid(messageContent('x'.repeat(400)), 'message');
  assert.equal(coefficientColor(null), 'neutral');
  assert.equal(coefficientColor(112), 'danger');
  assert.equal(coefficientColor(96), 'warning');
  assert.equal(coefficientColor(75), 'primary');
});
