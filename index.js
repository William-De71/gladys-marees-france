// -----------------------------------------------------------------------------
// Entry point of the Marées France external integration.
//
// Brings the tides of the French harbors into Gladys, from the public
// prediction services of the SHOM (the ones of maree.shom.fr):
//   - devices: one per harbor (water height, rising or falling, next high
//     and low tides, coefficients), offered on the Discovery screen (see
//     src/device.js);
//   - scene triggers: high or low tide in N minutes or now, spring tide;
//   - scene action: the next tide of a harbor;
//   - dashboard widgets: tide of the day, next tides, coefficients.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: the local days and times of the tides)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Marées France integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
