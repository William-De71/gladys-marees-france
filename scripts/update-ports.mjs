#!/usr/bin/env node
// Refresh the harbor list of the integration from the SHOM WFS layer:
//   - src/ports.json, the snapshot the code searches when the live list is
//     unreachable;
//   - the options of the `port` select of the manifest (value = SHOM code,
//     label = harbor name; a proper noun, the same in every language, so the
//     label only carries `en`, which every Gladys front falls back to: four
//     copies would push the manifest towards the 100 KB limit of the store).
//
// Usage: node scripts/update-ports.mjs [wfs.json]   (no argument: download)
// Option values are forever (stored in configurations): a harbor the SHOM
// removes stays resolvable by the code, its device simply stops updating.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readPorts, displayName } from '../src/ports.js';
import { createShomClient } from '../src/shom-api.js';

const root = new URL('../', import.meta.url);
const file = process.argv[2];
const geojson = file ? JSON.parse(readFileSync(file, 'utf8')) : await createShomClient().ports();
const ports = readPorts(geojson);
if (ports.length < 100) {
  throw new Error(`Only ${ports.length} harbors: refusing to write a truncated list`);
}

// One harbor per line: Prettier keeps an object on one line when it was
// written so and fits the print width.
const line = (value) => JSON.stringify(value).replace(/":/g, '": ').replace(/,"/g, ', "');
const snapshot = `[\n${ports.map((port) => `  ${line(port).replace(/^\{/, '{ ').replace(/\}$/, ' }')}`).join(',\n')}\n]\n`;
writeFileSync(new URL('src/ports.json', root), snapshot);

const manifestUrl = new URL('gladys-assistant-integration.json', root);
const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
const field = manifest.config_schema.find((entry) => entry.key === 'port');
const MARKER = '__PORT_OPTIONS__';
field.options = MARKER;
const options = ports
  .map(
    (port) =>
      `{ "value": ${JSON.stringify(port.id)}, "label": { "en": ${JSON.stringify(displayName(port))} } }`,
  )
  .join(',\n');
writeFileSync(
  manifestUrl,
  `${JSON.stringify(manifest, null, 2).replace(`"${MARKER}"`, `[\n${options}\n]`)}\n`,
);
execFileSync(
  'npx',
  ['prettier', '--write', 'gladys-assistant-integration.json', 'src/ports.json'],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
console.log(`${ports.length} harbors written`);
