// -----------------------------------------------------------------------------
// The Marées France integration: every handler, registered on a Gladys client.
//
// Tides of the French harbors (mainland and overseas) from the public
// services of the SHOM:
//   - devices (device.js): one per harbor, water height now, rising or
//     falling, next high and low tides, coefficients;
//   - scene triggers (events.js): a high or low tide in N minutes (or now),
//     a spring tide of a coefficient of at least N;
//   - scene action: the next tide of a harbor, for a notification;
//   - dashboard widgets (widgets.js): the tide of the day with its curve, the
//     next tides, the coefficients of the coming two weeks.
//
// The data of each harbor is downloaded once a day (three requests) and
// kept in /data; everything else is computed locally on a one-minute timer:
// the states, the countdowns and the scene events. Transport: cloud (the
// SHOM services, over the internet); nothing about the user is sent.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  portEntries,
  readLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createShomClient, MAX_TIDE_DAYS, MAX_LEVEL_DAYS } from './shom-api.js';
import { SNAPSHOT, readPorts, resolvePort, searchPorts, displayName } from './ports.js';
import { createStore } from './store.js';
import { resolveTimezone, localDay, zonedTime } from './time.js';
import { readTides, readLevels, readCoefficients, MINUTE, HOUR, DAY } from './tides.js';
import {
  idsOf,
  portIdFromExternalId,
  buildPortDevice,
  buildPortStates,
  snapshotOf,
} from './device.js';
import { eventsBetween, nextTideOutputs } from './events.js';
import {
  WIDGETS,
  COEFFICIENT_DAYS,
  messageContent,
  buildTodayWidget,
  buildListWidget,
  buildCoefficientsWidget,
} from './widgets.js';
import { t, all, LANGUAGES } from './i18n.js';

const ACTIONS = { FIND_PORT: 'find_port', REFRESH: 'refresh', DIAGNOSTIC: 'diagnostic' };
const SCENE_ACTIONS = { GET_NEXT_TIDE: 'get_next_tide' };
// Language of the texts before any widget asked for one: the users of a
// French tide service mostly read French.
const DEFAULT_LANGUAGE = 'fr';
// An event missed by more than this (container stopped) is dropped: a
// "high tide in 30 minutes" scene an hour late would surprise more than help.
const GRACE_MS = 10 * MINUTE;
const KEEP_FIRED_MS = 3 * DAY;
// Pause between two requests to the SHOM: its firewall dislikes bursts.
const REQUEST_PAUSE_MS = 2000;
// Retry delays of a failed download; a refusal of the firewall waits longest.
const RETRY_MS = [15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR];
const BLOCKED_RETRY_MS = 3 * HOUR;
// The harbor list changes a few times a year.
const PORTS_MAX_AGE_MS = 7 * DAY;
// The water height is published on 5-minute steps, as the SHOM computes it:
// a state a minute would only grow the history.
const HEIGHT_STEP_MS = 5 * MINUTE;

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {object} [options.shom] - The SHOM client (tests).
 * @param {string} [options.dataDir] - Directory of the JSON files.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {Function} [options.sleep] - `(ms) => Promise` (tests).
 * @param {string} [options.timezone] - Timezone of Gladys (tests).
 * @param {number} [options.refreshMinute] - Minutes after midnight of the daily download.
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  {
    shom = createShomClient(),
    dataDir,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    timezone = resolveTimezone(),
    // Spread the instances over the night: not every Gladys at 00:05.
    refreshMinute = 5 + Math.floor(Math.random() * 115),
    logger = sdkLogger,
  } = {},
) {
  const storeOptions = { logger, ...(dataDir ? { dir: dataDir } : {}) };
  const tidesStore = createStore('tides.json', storeOptions);
  const portsStore = createStore('ports.json', storeOptions);
  const firedStore = createStore('fired.json', storeOptions);

  let config = normalizeConfig();
  let language = DEFAULT_LANGUAGE;
  let createdDevices = new Set();
  let ports = SNAPSHOT;
  let portsFetchedAt = 0;
  // The harbors of the configuration, resolved, and the entries that were not.
  let resolved = [];
  let unresolved = [];
  let dropped = [];
  // port id -> { tides, levels, coefficients, day, fetchedAt }
  let data = new Map();
  // port id -> { kind, message, at }
  const errors = new Map();
  let fired = new Map();
  let failures = 0;
  let retryAt = 0;
  let refreshing = null;
  let timer = null;
  let running = false;
  let lastStatus = null;
  let lastDiscovery = null;

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);
  const today = () => localDay(new Date(now()), timezone);
  const isCreated = (portId) => createdDevices.has(idsOf(gladys, portId).device);
  const portById = (portId) => resolved.find((port) => port.id === portId) ?? null;

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The connection status of the current state.
   * @returns {Promise<void>}
   */
  async function updateStatus() {
    if (resolved.length === 0) {
      await reportStatus(
        false,
        unresolved.length > 0
          ? all('statusUnresolved', { entries: unresolved.map((u) => u.entry).join(', ') })
          : all('statusNoPort'),
      );
      return;
    }
    const missing = resolved.filter((port) => !data.has(port.id));
    if (missing.length === resolved.length) {
      const error = errors.get(missing[0].id);
      await reportStatus(false, all(`statusError_${error?.kind ?? 'pending'}`));
      return;
    }
    const names = resolved.map((port) => port.name).join(', ');
    const stale = resolved.filter((port) => data.get(port.id)?.day !== today());
    const notes = [
      ...(unresolved.length ? ['noteUnresolved'] : []),
      ...(dropped.length ? ['noteDropped'] : []),
      ...(stale.length ? ['noteStale'] : []),
    ];
    const message = Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        [
          t('statusOk', l, { ports: names }),
          ...notes.map((note) =>
            t(note, l, {
              entries: unresolved.map((u) => u.entry).join(', '),
              dropped: dropped.join(', '),
              ports: stale.map((port) => port.name).join(', '),
            }),
          ),
        ]
          .join(' ')
          .slice(0, 200),
      ]),
    );
    await reportStatus(true, message);
  }

  /**
   * @description Resolve the harbors of the configuration against the list.
   */
  function resolveConfig() {
    const { entries, dropped: beyond } = portEntries(config);
    resolved = [];
    unresolved = [];
    dropped = beyond;
    for (const entry of entries) {
      const { port, candidates } = resolvePort(ports, entry);
      if (port && !resolved.some((known) => known.id === port.id)) {
        resolved.push(port);
      } else if (!port) {
        unresolved.push({ entry, candidates });
        logger.warn(
          `Harbor "${entry}" not found${candidates.length ? `, did you mean: ${candidates.map(displayName).join(', ')}` : ''}`,
        );
      }
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description Publish the states of the created harbor devices.
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const at = now();
    const lang = textLanguage();
    const states = resolved
      .filter((port) => data.has(port.id) && isCreated(port.id))
      .flatMap((port) => {
        const snapshot = snapshotOf(data.get(port.id), at, timezone);
        snapshot.height = snapshotOf(
          data.get(port.id),
          Math.floor(at / HEIGHT_STEP_MS) * HEIGHT_STEP_MS,
          timezone,
        ).height;
        return buildPortStates(gladys, port, snapshot, lang, timezone);
      });
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  const publishQuietly = () =>
    publishStates().catch((err) => logger.warn(`Unable to publish the states: ${err.message}`));

  const refreshWidgets = () =>
    Object.values(WIDGETS).forEach((key) => gladys.requestWidgetRefresh(key));

  /**
   * @description Offer the harbor devices, only when the list changed.
   * @param {boolean} [force] - Send it even when unchanged.
   * @returns {Promise<number>} How many devices are offered.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = resolved
      .filter((port) => data.has(port.id))
      .map((port) => buildPortDevice(gladys, port, data.get(port.id), lang));
    const signature = JSON.stringify(
      devices.map((d) => [d.external_id, d.name, d.features.length]),
    );
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Download the data of one harbor: tides (8 days from
   * yesterday), water heights (3 days from yesterday), coefficients (two
   * weeks from today). UTC days, see shom-api.js.
   * @param {object} port - The harbor.
   * @returns {Promise<object>} The data.
   */
  async function download(port) {
    const at = now();
    const yesterday = new Date(at - DAY).toISOString().slice(0, 10);
    const utcToday = new Date(at).toISOString().slice(0, 10);
    const tides = readTides(await shom.tides(port.id, yesterday, MAX_TIDE_DAYS));
    await sleep(REQUEST_PAUSE_MS);
    const levels = readLevels(await shom.levels(port.id, yesterday, MAX_LEVEL_DAYS));
    await sleep(REQUEST_PAUSE_MS);
    let coefficients = [];
    try {
      coefficients = readCoefficients(
        await shom.coefficients(port.id, utcToday, COEFFICIENT_DAYS + 1),
        utcToday,
      );
    } catch (err) {
      // The coefficients only feed one widget: the tides are enough.
      logger.warn(`Coefficients of ${port.id}: ${err.message}`);
    }
    if (tides.length === 0) {
      throw Object.assign(new Error(`No tide in the answer for ${port.id}`), { kind: 'invalid' });
    }
    return { tides, levels, coefficients, day: today(), fetchedAt: at };
  }

  /**
   * @description Refresh the harbor list when it is a week old (best effort).
   * @returns {Promise<void>}
   */
  async function refreshPortList() {
    if (now() - portsFetchedAt < PORTS_MAX_AGE_MS) {
      return;
    }
    try {
      const list = readPorts(await shom.ports());
      if (list.length >= 100) {
        ports = list;
        portsFetchedAt = now();
        await portsStore.save({ fetchedAt: portsFetchedAt, ports });
      }
    } catch (err) {
      logger.warn(`Harbor list not refreshed, the built-in one is used: ${err.message}`);
    }
    await sleep(REQUEST_PAUSE_MS);
  }

  /**
   * @description Download the harbors whose data is not from today (or all).
   * One download at a time.
   * @param {object} [options] - Options.
   * @param {boolean} [options.force] - Download every harbor again.
   * @returns {Promise<{ ok: Array<string>, failed: Array<string> }>} The result.
   */
  function refresh({ force = false } = {}) {
    if (refreshing) {
      return refreshing;
    }
    refreshing = (async () => {
      const ok = [];
      const failed = [];
      const day = today();
      const due = resolved.filter((port) => force || data.get(port.id)?.day !== day);
      if (due.length > 0) {
        await refreshPortList();
      }
      let blocked = false;
      for (const port of due) {
        if (blocked) {
          failed.push(port.id);
          continue;
        }
        try {
          data.set(port.id, await download(port));
          errors.delete(port.id);
          ok.push(port.id);
          logger.info(`Tides of ${port.id} downloaded (${data.get(port.id).tides.length} tides)`);
        } catch (err) {
          errors.set(port.id, { kind: err.kind ?? 'invalid', message: err.message, at: now() });
          failed.push(port.id);
          logger.warn(`Tides of ${port.id} not downloaded: ${err.message}`);
          // A refused address stays refused for a while: stop asking.
          blocked = err.kind === 'blocked';
        }
        await sleep(REQUEST_PAUSE_MS);
      }
      if (failed.length > 0) {
        retryAt =
          now() + (blocked ? BLOCKED_RETRY_MS : RETRY_MS[Math.min(failures, RETRY_MS.length - 1)]);
        failures += 1;
      } else {
        failures = 0;
        retryAt = 0;
      }
      if (ok.length > 0) {
        await tidesStore.save(Object.fromEntries(data));
        await publishDiscoveredDevices().catch((err) =>
          logger.warn(`Unable to offer the devices: ${err.message}`),
        );
        await publishQuietly();
        refreshWidgets();
      }
      await updateStatus();
      return { ok, failed };
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  /**
   * @description Whether the daily download is due: data not from today,
   * past the minute of the day picked for this instance, no retry pending.
   * @returns {boolean} True when due.
   */
  function refreshDue() {
    const at = now();
    if (at < retryAt) {
      return false;
    }
    const day = today();
    return resolved.some((port) => {
      const current = data.get(port.id);
      if (!current) {
        return true;
      }
      if (current.day === day) {
        return false;
      }
      // Minutes since local midnight.
      return (at - zonedTime(day, 0, timezone).getTime()) / MINUTE >= refreshMinute;
    });
  }

  /**
   * @description Publish the scene events reached and not fired yet.
   * @returns {Promise<number>} How many were published.
   */
  async function fireEvents() {
    const at = now();
    const lang = textLanguage();
    const events = resolved
      .filter((port) => data.has(port.id))
      .flatMap((port) =>
        eventsBetween(
          gladys,
          port,
          data.get(port.id).tides,
          { from: at - GRACE_MS, to: at },
          timezone,
          lang,
        ),
      )
      .filter((event) => !fired.has(event.id));
    let count = 0;
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
        fired.set(event.id, event.at);
        count += 1;
      } catch (err) {
        // Kept for the next minute, within the grace delay.
        logger.warn(`Unable to publish the scene event ${event.key}: ${err.message}`);
        break;
      }
    }
    if (count > 0) {
      for (const [id, time] of fired) {
        if (time < at - KEEP_FIRED_MS) {
          fired.delete(id);
        }
      }
      await firedStore.save(Object.fromEntries(fired));
      logger.debug?.(`${count} scene event(s) published`);
    }
    return count;
  }

  /**
   * @description One minute of the integration: events, states, download.
   * @returns {Promise<void>}
   */
  async function tick() {
    await fireEvents().catch((err) => logger.warn(`Scene events: ${err.message}`));
    await publishQuietly();
    if (refreshDue()) {
      await refresh();
    }
  }

  /**
   * @description Wait for the next minute (plus one second), then tick.
   */
  function schedule() {
    clearTimeout(timer);
    if (!running) {
      return;
    }
    const delay = MINUTE - (now() % MINUTE) + 1000;
    timer = setTimeout(() => {
      tick()
        .catch((err) => logger.warn(`Tick: ${err.message}`))
        .finally(schedule);
    }, delay);
    timer.unref?.();
  }

  // --- Dashboard widgets -------------------------------------------------------------

  /**
   * @description The harbor of a widget: its `port` setting (a harbor device
   * external id), else the first harbor of the configuration.
   * @param {object} settings - The widget settings.
   * @param {string} lang - The user language.
   * @returns {{ port: object, data: object }|{ content: object }} The harbor, or a message.
   */
  function widgetPort(settings, lang) {
    if (resolved.length === 0) {
      return { content: messageContent(t('noPort', lang)) };
    }
    const wanted = portIdFromExternalId(settings?.port);
    const port = (wanted && portById(wanted)) || resolved[0];
    const portData = data.get(port.id);
    if (!portData) {
      return { content: messageContent(t('notLoaded', lang, { port: port.name }), 30) };
    }
    return { port, data: portData };
  }

  const widget =
    (build) =>
    async ({ settings = {}, language: lang }) => {
      rememberLanguage(lang);
      const found = widgetPort(settings, lang);
      return found.content ?? build({ ...found, now: now(), timezone, language: lang });
    };

  gladys.onWidgetGet(WIDGETS.TODAY, widget(buildTodayWidget));
  gladys.onWidgetGet(WIDGETS.LIST, widget(buildListWidget));
  gladys.onWidgetGet(WIDGETS.COEFFICIENTS, widget(buildCoefficientsWidget));

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_NEXT_TIDE, async (fields = {}) => {
    const wanted = portIdFromExternalId(fields.port);
    const port = (wanted && portById(wanted)) || (!fields.port ? resolved[0] : null);
    if (!port) {
      throw new Error(`Unknown harbor: ${fields.port ?? '(none configured)'}`);
    }
    if (!data.has(port.id)) {
      await refresh();
    }
    if (!data.has(port.id)) {
      throw new Error(`No tide data for ${port.id}: see the connection status`);
    }
    return nextTideOutputs(
      gladys,
      port,
      data.get(port.id),
      fields.tide,
      now(),
      timezone,
      textLanguage(),
    );
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.FIND_PORT, async (fields = {}) => {
    const query = String(fields.query ?? '').trim();
    if (!query) {
      return all('findEmpty');
    }
    const found = searchPorts(ports, query);
    if (found.length === 0) {
      return all('findNone', { query });
    }
    // The message stays short: as many names as fit.
    const names = [];
    for (const port of found) {
      const next = [...names, displayName(port)].join(', ');
      if (next.length > 160) {
        break;
      }
      names.push(displayName(port));
    }
    return all('findResults', { n: found.length, ports: names.join(', ') });
  });

  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (resolved.length === 0) {
      return all('statusNoPort');
    }
    retryAt = 0;
    const { ok, failed } = await refresh({ force: true });
    if (failed.length === 0) {
      return all('refreshOk', { n: ok.length });
    }
    const error = errors.get(failed[0]);
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        t('refreshFailed', l, {
          ports: failed.join(', '),
          reason: t(`statusError_${error?.kind ?? 'pending'}`, l),
        }),
      ]),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    // Gladys does not pass DEBUG to the container: the details go to the
    // Logs tab, at the info level, on demand.
    const lines = [
      `timezone=${timezone} today=${today()} language=${textLanguage()} daily download at +${refreshMinute} min`,
      `harbor list: ${ports.length} (${portsFetchedAt ? new Date(portsFetchedAt).toISOString() : 'built-in'})`,
      `configured: ${[config.port, ...config.otherPorts].join(' | ') || '(none)'}`,
      ...resolved.map((port) => {
        const portData = data.get(port.id);
        const error = errors.get(port.id);
        return `${port.id}: ${portData ? `${portData.tides.length} tides, ${portData.levels.length} heights, ${portData.coefficients.length} coefficient days, day ${portData.day}` : 'no data'}${error ? `, last error ${error.kind}: ${error.message}` : ''}${isCreated(port.id) ? ', device created' : ''}`;
      }),
      ...unresolved.map(
        (u) =>
          `not found: "${u.entry}" (${u.candidates.map((p) => p.id).join(', ') || 'no candidate'})`,
      ),
      `scene events fired (3 days): ${fired.size}; next retry: ${retryAt ? new Date(retryAt).toISOString() : 'none'}`,
    ];
    lines.forEach((line) => logger.info(`Diagnostic: ${line}`));
    return all('diagnosticDone', { ports: resolved.length, fired: fired.size });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    retryAt = 0;
    await refresh();
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} harbor device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishQuietly();
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
    resolveConfig();
  }

  /**
   * @description Read what /data kept: harbor list, tide data, fired events.
   * @returns {Promise<void>}
   */
  async function loadStores() {
    const storedPorts = await portsStore.load(null);
    if (Array.isArray(storedPorts?.ports) && storedPorts.ports.length >= 100) {
      ports = storedPorts.ports;
      portsFetchedAt = Number(storedPorts.fetchedAt) || 0;
    }
    const storedTides = await tidesStore.load({});
    data = new Map(
      Object.entries(storedTides && typeof storedTides === 'object' ? storedTides : {}).filter(
        ([, value]) => Array.isArray(value?.tides) && Array.isArray(value?.levels),
      ),
    );
    const storedFired = await firedStore.load({});
    fired = new Map(
      Object.entries(storedFired && typeof storedFired === 'object' ? storedFired : {}).filter(
        ([, time]) => Number.isFinite(time),
      ),
    );
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    await loadConfig(rawConfig);
    logger.info(
      `Configuration updated: ${resolved.map((port) => port.id).join(', ') || 'no harbor'}`,
    );
    lastDiscovery = null;
    retryAt = 0;
    failures = 0;
    await updateStatus();
    await refresh();
    await publishDiscoveredDevices().catch(() => {});
    refreshWidgets();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  gladys.on('connected', async () => {
    await loadStores();
    await loadConfig();
    await refreshCreatedDevices();
    lastStatus = null;
    lastDiscovery = null;
    await updateStatus();
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await tick();
    if (!running) {
      running = true;
      schedule();
    }
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    running = false;
    clearTimeout(timer);
  });

  return {
    tick,
    refresh,
    fireEvents,
    refreshDue,
    getConfig: () => config,
    getResolved: () => resolved,
    getUnresolved: () => unresolved,
    getData: () => data,
    getFired: () => fired,
    stop: () => {
      running = false;
      clearTimeout(timer);
    },
  };
}

export {
  createApp,
  ACTIONS,
  SCENE_ACTIONS,
  DEFAULT_LANGUAGE,
  GRACE_MS,
  RETRY_MS,
  BLOCKED_RETRY_MS,
  HEIGHT_STEP_MS,
};
