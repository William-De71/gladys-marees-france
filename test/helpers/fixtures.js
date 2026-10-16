// Real answers of the SHOM services, captured on 2026-10-16 (Brest and
// Fort-de-France, UTC days from 2026-10-14), served through a fake client.
// Tests never touch the network.

import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const read = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

// Brest, 2026-10-15: low tide 12:35 UTC (2.13 m), high tide 18:22 UTC (6.07 m, coef. 62).
const NOW = Date.parse('2026-10-15T16:00:00Z');
const MINUTE = 60000;
const TIMEZONE = 'Europe/Paris';
const FIXTURES = {
  brestTides: read('brest.hlt.json'),
  brestLevels: read('brest.wl.json'),
  brestCoefficients: read('brest.coeff.json'),
  fdfTides: read('fort-de-france.hlt.json'),
  ports: read('ports.wfs.json'),
};

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary data directory.
 * @returns {string} The path.
 */
const dataDir = () => mkdtempSync(join(tmpdir(), 'marees-'));

/**
 * @description A fake SHOM client: the fixtures for Brest (and the tides of
 * Fort-de-France for every other harbor), with switches for the tests.
 * @returns {object} The client, with `calls` and `fail` (an error to throw).
 */
function fakeShom() {
  const shom = {
    calls: [],
    fail: null,
    async ports() {
      shom.calls.push(['ports']);
      return FIXTURES.ports;
    },
    async tides(port, date, days) {
      shom.calls.push(['tides', port, date, days]);
      if (shom.fail) {
        throw shom.fail;
      }
      return port === 'BREST' ? FIXTURES.brestTides : FIXTURES.fdfTides;
    },
    async levels(port, date, days) {
      shom.calls.push(['levels', port, date, days]);
      if (shom.fail) {
        throw shom.fail;
      }
      return port === 'BREST' ? FIXTURES.brestLevels : {};
    },
    async coefficients(port, date, days) {
      shom.calls.push(['coefficients', port, date, days]);
      if (shom.fail) {
        throw shom.fail;
      }
      return port === 'BREST' ? FIXTURES.brestCoefficients : [[]];
    },
  };
  return shom;
}

const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:test-integration:${type}:${id}`,
    feature: (key) => `ext:test-integration:${type}:${id}:${key}`,
  }),
};

export { NOW, MINUTE, TIMEZONE, FIXTURES, silent, dataDir, fakeShom, fakeGladys };
