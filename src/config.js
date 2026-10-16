// -----------------------------------------------------------------------------
// Configuration of the Marées France integration.
//
// Fields of the config_schema:
//   - `port`         the main harbor, picked in the list of the SHOM (select,
//                    value = SHOM code, e.g. BREST);
//   - `other_ports`  more harbors, typed by name or code and separated by
//                    commas ("Saint-Malo, Le Conquet"): the search finds
//                    them in the list, accents and case ignored;
//   - `language`     language of the texts Gladys does not ask for in a
//                    language (device and feature names, text states,
//                    scene variables): `auto` follows the language of the
//                    last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`  language of the last widget request, kept for the
//                      texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

// Each harbor costs three requests a day to the SHOM, and a device.
const MAX_PORTS = 5;
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Split the `other_ports` field: commas, semicolons or new lines.
 * @param {unknown} raw - What the user typed.
 * @returns {Array<string>} The entries, trimmed, without empty ones.
 * @example
 * splitPorts('Saint-Malo; Le Conquet'); // -> ['Saint-Malo', 'Le Conquet']
 */
function splitPorts(raw) {
  return readString(raw)
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ port: string, otherPorts: Array<string>, language: string }} The config.
 * @example
 * normalizeConfig({ port: 'BREST', other_ports: 'Saint-Malo' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    port: readString(config.port),
    otherPorts: splitPorts(config.other_ports),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description The harbor entries to resolve, the select first, without
 * duplicates (case ignored), MAX_PORTS at most.
 * @param {object} config - A normalized config.
 * @returns {{ entries: Array<string>, dropped: Array<string> }} The entries,
 * and the ones beyond the limit.
 */
function portEntries(config) {
  const seen = new Set();
  const all = [config.port, ...config.otherPorts].filter((entry) => {
    const key = entry.toLowerCase();
    if (!entry || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return { entries: all.slice(0, MAX_PORTS), dropped: all.slice(MAX_PORTS) };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_PORTS,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  splitPorts,
  normalizeConfig,
  portEntries,
  readLanguage,
};
