// -----------------------------------------------------------------------------
// The harbors of the SHOM: the list, their display names and the search.
//
// The WFS layer lists 439 points; like the website (and marees_france), the
// ones without a UTC offset (`ut` null: foreign or river points the SHOM
// does not predict) and the ones with `nota` 6 (Bordeaux: no prediction
// table) are left out. A snapshot of the list ships in src/ports.json
// (scripts/update-ports.mjs, also the source of the `port` select of the
// manifest); the live list, read once a week, finds harbors added since.
//
// A harbor is identified by its SHOM code (`cst`, e.g. BREST,
// FORT-DE-FRANCE): the device external id is built from it, never from the
// name.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const SNAPSHOT = JSON.parse(readFileSync(new URL('./ports.json', import.meta.url), 'utf8'));
// Search results shown by the "Find a harbor" action.
const MAX_RESULTS = 15;

/**
 * @description The territory to show next to a harbor name: none in mainland
 * France, the island or region overseas, the country abroad.
 * @param {string|null} country - The `pays` of the SHOM ("France (Martinique)").
 * @returns {string|null} The territory.
 * @example
 * territoryOf('France (Martinique)'); // -> 'Martinique'
 */
function territoryOf(country) {
  if (typeof country !== 'string' || !country.trim() || country === 'France') {
    return null;
  }
  const overseas = /^France \((.+)\)$/.exec(country);
  return (overseas ? overseas[1] : country).replace(/''/g, '’');
}

/**
 * @description The harbors of a WFS answer, filtered and sorted by name.
 * @param {object} geojson - The WFS answer.
 * @returns {Array<{ id: string, name: string, territory: string|null, lat: number|null, lon: number|null, coefficient: boolean }>} The harbors.
 * @example
 * readPorts(await shom.ports());
 */
function readPorts(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  const ports = new Map();
  for (const feature of features) {
    const p = feature?.properties ?? {};
    if (typeof p.cst !== 'string' || typeof p.toponyme !== 'string') {
      continue;
    }
    if (p.ut === null || p.ut === undefined || p.nota === 6) {
      continue;
    }
    ports.set(p.cst, {
      id: p.cst,
      name: p.toponyme.trim(),
      territory: territoryOf(p.pays),
      lat: typeof p.lat === 'number' ? p.lat : null,
      lon: typeof p.lon === 'number' ? p.lon : null,
      coefficient: p.coeff === 1,
    });
  }
  return [...ports.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id),
  );
}

/**
 * @description The name of a harbor as shown to the user.
 * @param {{ name: string, territory: string|null }} port - The harbor.
 * @returns {string} "Brest", "Fort-de-France (Martinique)".
 */
const displayName = (port) => (port.territory ? `${port.name} (${port.territory})` : port.name);

/**
 * @description Lower case, without accents, punctuation as spaces.
 * @param {string} text - A text.
 * @returns {string} The normalized text.
 * @example
 * normalize("L'Aber-Benoît"); // -> 'l aber benoit'
 */
function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @description Find harbors by name or code: exact match first, then the
 * names starting with the query, then the ones containing it.
 * @param {Array<object>} ports - The harbors.
 * @param {string} query - What the user typed.
 * @param {number} [limit] - Results at most.
 * @returns {Array<object>} The harbors, best first.
 * @example
 * searchPorts(ports, 'st malo'); // -> [{ id: 'SAINT-MALO', ... }]
 */
function searchPorts(ports, query, limit = MAX_RESULTS) {
  const wanted = normalize(query)
    .replace(/\bst\b/g, 'saint')
    .replace(/\bste\b/g, 'sainte');
  if (!wanted) {
    return [];
  }
  const scored = [];
  for (const port of ports) {
    const names = [normalize(port.name), normalize(displayName(port))];
    const code = normalize(port.id);
    let score = null;
    if (code === wanted || names.includes(wanted)) {
      score = 0;
    } else if (names.some((name) => name.startsWith(wanted)) || code.startsWith(wanted)) {
      score = 1;
    } else if (names.some((name) => name.includes(wanted))) {
      score = 2;
    }
    if (score !== null) {
      scored.push({ port, score });
    }
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ port }) => port);
}

/**
 * @description Resolve one entry of the configuration: a code of the list,
 * or a name that matches one harbor only (exact, or a single candidate).
 * @param {Array<object>} ports - The harbors.
 * @param {string} entry - A code or a name.
 * @returns {{ port: object|null, candidates: Array<object> }} The harbor, or
 * the candidates when the name is ambiguous or unknown (empty).
 * @example
 * resolvePort(ports, 'Saint-Malo');
 */
function resolvePort(ports, entry) {
  const text = String(entry ?? '').trim();
  const byCode = ports.find((port) => port.id === text || port.id === text.toUpperCase());
  if (byCode) {
    return { port: byCode, candidates: [] };
  }
  const found = searchPorts(ports, text, MAX_RESULTS);
  const exact = found.filter(
    (port) =>
      normalize(port.name) === normalize(text) || normalize(displayName(port)) === normalize(text),
  );
  if (exact.length === 1) {
    return { port: exact[0], candidates: [] };
  }
  if (found.length === 1) {
    return { port: found[0], candidates: [] };
  }
  return { port: null, candidates: exact.length > 1 ? exact : found };
}

export {
  SNAPSHOT,
  MAX_RESULTS,
  territoryOf,
  readPorts,
  displayName,
  normalize,
  searchPorts,
  resolvePort,
};
