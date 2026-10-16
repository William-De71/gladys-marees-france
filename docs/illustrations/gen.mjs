// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The three widgets for Brest, on real answers of the SHOM recorded for the
// tests (test/fixtures), at a fixed instant: Thursday 15 October 2026,
// 18:00 in Paris. Nothing is made up but the instant.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildTodayWidget, buildListWidget, buildCoefficientsWidget } = await load('src/widgets.js');
const { readTides, readLevels, readCoefficients } = await load('src/tides.js');
const { SNAPSHOT } = await load('src/ports.js');
const { LANGUAGES } = await load('src/i18n.js');
const json = (path) => JSON.parse(readFileSync(`${repo}/${path}`, 'utf8'));
const manifest = json('gladys-assistant-integration.json');

const NOW = Date.parse('2026-10-15T16:00:00Z');
const timezone = 'Europe/Paris';
const port = SNAPSHOT.find((entry) => entry.id === 'BREST');
const data = {
  tides: readTides(json('test/fixtures/brest.hlt.json')),
  levels: readLevels(json('test/fixtures/brest.wl.json')),
  coefficients: readCoefficients(json('test/fixtures/brest.coeff.json'), '2026-10-15'),
};

const contents = {};
for (const language of LANGUAGES) {
  const options = { port, data, now: NOW, timezone, language };
  contents[language] = {
    tide_today: buildTodayWidget(options),
    tide_list: buildListWidget(options),
    coefficients: buildCoefficientsWidget(options),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
