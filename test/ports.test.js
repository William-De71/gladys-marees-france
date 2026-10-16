import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SNAPSHOT,
  readPorts,
  displayName,
  searchPorts,
  resolvePort,
  territoryOf,
  normalize,
} from '../src/ports.js';
import { FIXTURES } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

test('the WFS list keeps the harbors with predictions only', () => {
  const ports = readPorts(FIXTURES.ports);
  const ids = ports.map((port) => port.id);
  // Zeebrugge and Le Crotoy have no UTC offset, Bordeaux is nota 6: not predicted.
  for (const id of ['ZEEBRUGGE', 'LE_CROTOY', 'BORDEAUX']) {
    assert.ok(!ids.includes(id), id);
  }
  assert.ok(ids.includes('BREST') && ids.includes('FORT-DE-FRANCE'));
  const fdf = ports.find((port) => port.id === 'FORT-DE-FRANCE');
  assert.equal(displayName(fdf), 'Fort-de-France (Martinique)');
  assert.equal(fdf.coefficient, false);
  const brest = ports.find((port) => port.id === 'BREST');
  assert.equal(displayName(brest), 'Brest');
  assert.equal(brest.coefficient, true);
  // Sorted by name, French collation.
  assert.deepEqual(
    ports.map((port) => port.name),
    [...ports.map((port) => port.name)].sort((a, b) => a.localeCompare(b, 'fr')),
  );
  assert.deepEqual(readPorts(null), []);
});

test('territories: none in mainland France, the island overseas, the country abroad', () => {
  assert.equal(territoryOf('France'), null);
  assert.equal(territoryOf('France (Guadeloupe)'), 'Guadeloupe');
  assert.equal(territoryOf('Maroc'), 'Maroc');
  assert.equal(territoryOf("Côte d''Ivoire"), 'Côte d’Ivoire');
  assert.equal(territoryOf(null), null);
});

test('search: accents, case, "St" and codes', () => {
  assert.equal(normalize("L'Aber-Benoît"), 'l aber benoit');
  assert.equal(searchPorts(SNAPSHOT, 'st malo')[0].id, 'SAINT-MALO');
  assert.equal(searchPorts(SNAPSHOT, 'BREST')[0].id, 'BREST');
  assert.equal(searchPorts(SNAPSHOT, 'aber benoit')[0].id, 'ABER_BENOIT_MEAN_RENEAT');
  assert.ok(searchPorts(SNAPSHOT, 'saint').length > 5);
  assert.ok(searchPorts(SNAPSHOT, 'saint').length <= 15);
  assert.deepEqual(searchPorts(SNAPSHOT, '  '), []);
  assert.deepEqual(searchPorts(SNAPSHOT, 'zzzz'), []);
});

test('resolve: a code, an exact name, a single candidate; ambiguous names give candidates', () => {
  assert.equal(resolvePort(SNAPSHOT, 'BREST').port.id, 'BREST');
  assert.equal(resolvePort(SNAPSHOT, 'brest').port.id, 'BREST');
  assert.equal(resolvePort(SNAPSHOT, 'Saint-Malo').port.id, 'SAINT-MALO');
  assert.equal(resolvePort(SNAPSHOT, 'Fort-de-France').port.id, 'FORT-DE-FRANCE');
  const ambiguous = resolvePort(SNAPSHOT, 'Saint');
  assert.equal(ambiguous.port, null);
  assert.ok(ambiguous.candidates.length > 1);
  assert.deepEqual(resolvePort(SNAPSHOT, 'Atlantis'), { port: null, candidates: [] });
});

test('the built-in list and the select of the manifest are the same harbors', () => {
  assert.ok(SNAPSHOT.length > 350);
  const options = manifest.config_schema.find((field) => field.key === 'port').options;
  assert.deepEqual(
    options.map((option) => option.value),
    SNAPSHOT.map((port) => port.id),
  );
  assert.deepEqual(
    options.map((option) => option.label.en),
    SNAPSHOT.map(displayName),
  );
  assert.equal(new Set(options.map((option) => option.label.en)).size, options.length);
});
