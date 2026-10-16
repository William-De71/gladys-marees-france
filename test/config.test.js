import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  portEntries,
  splitPorts,
  readLanguage,
  MAX_PORTS,
} from '../src/config.js';

test('normalize: trimmed values, automatic language by default', () => {
  assert.deepEqual(normalizeConfig(), { port: '', otherPorts: [], language: 'auto' });
  assert.deepEqual(normalizeConfig({ port: ' BREST ', other_ports: 'a, b', language: 'de' }), {
    port: 'BREST',
    otherPorts: ['a', 'b'],
    language: 'de',
  });
  assert.equal(normalizeConfig({ language: 'it' }).language, 'auto');
  assert.deepEqual(normalizeConfig(null).otherPorts, []);
});

test('other harbors: commas, semicolons, new lines', () => {
  assert.deepEqual(splitPorts('Saint-Malo; Le Conquet,\nRoscoff,,'), [
    'Saint-Malo',
    'Le Conquet',
    'Roscoff',
  ]);
  assert.deepEqual(splitPorts(42), []);
});

test('entries: the select first, no duplicate, five at most', () => {
  const { entries, dropped } = portEntries(
    normalizeConfig({ port: 'BREST', other_ports: 'brest, A, B, C, D, E' }),
  );
  assert.equal(MAX_PORTS, 5);
  assert.deepEqual(entries, ['BREST', 'A', 'B', 'C', 'D']);
  assert.deepEqual(dropped, ['E']);
  assert.deepEqual(portEntries(normalizeConfig({ other_ports: 'X' })).entries, ['X']);
});

test('stored language', () => {
  assert.equal(readLanguage({ last_language: 'es' }, 'fr'), 'es');
  assert.equal(readLanguage({ last_language: 'español' }, 'fr'), 'fr');
  assert.equal(readLanguage(undefined, 'fr'), 'fr');
});
