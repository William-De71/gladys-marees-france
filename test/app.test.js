// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices and the states like the host API does, and a fake SHOM.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS, BLOCKED_RETRY_MS, RETRY_MS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import { ShomError } from '../src/shom-api.js';
import { NOW, MINUTE, TIMEZONE, silent, dataDir, fakeShom } from './helpers/fixtures.js';

const BREST = 'ext:test-integration:port:BREST';

/**
 * @description The integration, connected to a fake Gladys and a fake SHOM.
 * @param {object} [options] - `{ config, shom, dir, now }`.
 * @returns {Promise<object>} `{ gladys, app, shom, clock, dir }`.
 */
async function startApp({
  config = { port: 'BREST' },
  shom = fakeShom(),
  dir = dataDir(),
  now = NOW,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    shom,
    dataDir: dir,
    now: () => clock.now,
    sleep: async () => {},
    timezone: TIMEZONE,
    refreshMinute: 30,
    logger: silent,
  });
  await gladys.connect();
  return { gladys, app, shom, clock, dir };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);

test('connect: three requests, one device offered and accepted, status connected', async (t) => {
  const { gladys, app, shom } = await startApp();
  t.after(() => app.stop());
  assert.deepEqual(
    shom.calls.filter((call) => call[0] !== 'ports'),
    [
      ['tides', 'BREST', '2026-10-14', 8],
      ['levels', 'BREST', '2026-10-14', 3],
      ['coefficients', 'BREST', '2026-10-15', 15],
    ],
  );
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.external_id),
    [BREST],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(gladys.fake.connectionStatus.message.fr, 'Marées de Brest à jour.');
  // Nothing published before the user creates the device.
  assert.equal(gladys.fake.states.length, 0);
  await created(gladys, BREST);
  assert.equal(gladys.fake.lastState(`${BREST}:next_high_in`), 142);
  assert.equal(gladys.fake.lastState(`${BREST}:trend`), 'Montante');
  assert.equal(gladys.fake.lastState(`${BREST}:coefficient`), 62);
});

test('the minute timer: countdowns, height on 5-minute steps, data from /data after a restart', async (t) => {
  const context = await startApp();
  const { gladys, app, clock, dir } = context;
  await created(gladys, BREST);
  const height = gladys.fake.lastState(`${BREST}:height`);
  clock.now += MINUTE;
  await app.tick();
  assert.equal(gladys.fake.lastState(`${BREST}:next_high_in`), 141);
  assert.equal(gladys.fake.lastState(`${BREST}:height`), height, 'same 5-minute step');
  clock.now += 5 * MINUTE;
  await app.tick();
  assert.notEqual(gladys.fake.lastState(`${BREST}:height`), height);
  app.stop();
  // A restart the same day reads /data: no request.
  const shom = fakeShom();
  const again = await startApp({ shom, dir, now: clock.now });
  t.after(() => again.app.stop());
  assert.equal(shom.calls.filter((call) => call[0] === 'tides').length, 0);
  assert.equal(again.gladys.fake.discoveredDevices.length, 1);
});

test('scene events: each one once, at its minute, never twice after a restart', async (t) => {
  const { gladys, app, clock, dir } = await startApp();
  const high = Date.parse('2026-10-15T18:22:00Z');
  clock.now = high - 30 * MINUTE + 1000;
  await app.tick();
  const soon = eventsOf(gladys, TRIGGERS.TIDE_UPCOMING).filter(
    (event) => event.data.tide_datetime === '2026-10-15T18:22:00.000Z',
  );
  // Within the 10-minute grace: 30 min before (just now), not 45 min.
  assert.deepEqual(
    soon.map((event) => event.data.minutes_before),
    ['30'],
  );
  await app.tick();
  assert.equal(eventsOf(gladys, TRIGGERS.TIDE_UPCOMING).length, soon.length);
  app.stop();
  const again = await startApp({ dir, now: clock.now + 1000 });
  t.after(() => again.app.stop());
  assert.equal(eventsOf(again.gladys, TRIGGERS.TIDE_UPCOMING).length, 0);
  again.clock.now = high - 15 * MINUTE + 1000;
  await again.app.tick();
  again.clock.now = high + 1000;
  await again.app.tick();
  assert.deepEqual(
    eventsOf(again.gladys, TRIGGERS.TIDE_UPCOMING).map((event) => event.data.minutes_before),
    ['15', '0'],
  );
  // No spring tide: the coefficient of the evening is 62.
  assert.equal(eventsOf(again.gladys, TRIGGERS.SPRING_TIDE).length, 0);
});

test('an event missed by more than 10 minutes is dropped', async (t) => {
  const { gladys, app, clock } = await startApp();
  t.after(() => app.stop());
  clock.now = Date.parse('2026-10-15T18:22:00Z') + 11 * MINUTE;
  await app.tick();
  assert.ok(!eventsOf(gladys, TRIGGERS.TIDE_UPCOMING).some((e) => e.data.minutes_before === '0'));
});

test('daily download: after the chosen minute of the next local day only', async (t) => {
  const { app, shom, clock } = await startApp();
  t.after(() => app.stop());
  const count = () => shom.calls.filter((call) => call[0] === 'tides').length;
  assert.equal(count(), 1);
  // 2026-10-16 00:20 in Paris (22:20 UTC): before the 30th minute.
  clock.now = Date.parse('2026-10-15T22:20:00Z');
  await app.tick();
  assert.equal(count(), 1);
  clock.now = Date.parse('2026-10-15T22:31:00Z');
  await app.tick();
  assert.equal(count(), 2);
  await app.tick();
  assert.equal(count(), 2);
});

test('a refusal of the firewall: kept data, status explained, retry hours later', async (t) => {
  const shom = fakeShom();
  shom.fail = new ShomError('blocked', 'SHOM firewall refused the request (403)', 403);
  const { gladys, app, clock } = await startApp({ shom });
  t.after(() => app.stop());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /refuse/);
  const count = () => shom.calls.filter((call) => call[0] === 'tides').length;
  clock.now += BLOCKED_RETRY_MS - MINUTE;
  await app.tick();
  assert.equal(count(), 1);
  shom.fail = null;
  clock.now += 2 * MINUTE;
  await app.tick();
  assert.equal(count(), 2);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.ok(RETRY_MS[0] < BLOCKED_RETRY_MS);
});

test('configuration: names, unknown harbors, the five-harbor limit', async (t) => {
  const { gladys, app } = await startApp({
    config: {
      port: 'BREST',
      other_ports: 'st malo; Atlantis, brest, Le Havre, Roscoff, Concarneau, Dunkerque',
    },
  });
  t.after(() => app.stop());
  assert.deepEqual(
    app.getResolved().map((port) => port.id),
    ['BREST', 'SAINT-MALO', 'LE_HAVRE', 'ROSCOFF'],
  );
  assert.deepEqual(
    app.getUnresolved().map((u) => u.entry),
    ['Atlantis'],
  );
  const message = gladys.fake.connectionStatus.message;
  assert.match(message.en, /Not found: Atlantis\./);
  assert.match(message.en, /Ignored \(5 harbors at most\): Concarneau, Dunkerque\./);
  for (const text of Object.values(message)) {
    assert.ok(text.length <= 200);
  }
  await gladys.fake.configUpdated({ port: '', other_ports: '' });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Aucun port configuré/);
});

test('widgets: the first harbor by default, the one of the setting otherwise', async (t) => {
  const { gladys, app } = await startApp({
    config: { port: 'BREST', other_ports: 'Fort-de-France' },
  });
  t.after(() => app.stop());
  for (const key of Object.values(WIDGETS)) {
    for (const settings of [{}, { port: 'ext:test-integration:port:FORT-DE-FRANCE' }]) {
      const ack = await gladys.fake.widgetGet(key, { language: 'fr', settings });
      assert.equal(ack.success, true, `${key}: ${ack.error}`);
      assert.deepEqual(validateWidgetContent(ack.data.content), [], key);
    }
  }
  const ack = await gladys.fake.widgetGet(WIDGETS.TODAY, {
    language: 'en',
    settings: { port: 'ext:test-integration:port:FORT-DE-FRANCE' },
  });
  assert.equal(ack.data.content.components[0].text, 'Fort-de-France (Martinique)');
});

test('scene action: the next tide of a harbor', async (t) => {
  const { gladys, app } = await startApp();
  t.after(() => app.stop());
  const ack = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_TIDE, {
    port: BREST,
    tide: 'high',
  });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.outputs.tide_time, '20:22');
  const any = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_TIDE, {});
  assert.equal(any.data.outputs.port_name, 'Marée Brest');
  const bad = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_TIDE, {
    port: 'ext:test-integration:port:NOPE',
  });
  assert.equal(bad.success, false);
});

test('configuration actions: find a harbor, download now, diagnostic', async (t) => {
  const lines = [];
  const shom = fakeShom();
  const clock = { now: NOW };
  const gladys = createFakeGladys({ config: { port: 'BREST' } });
  const app = createApp(gladys, {
    shom,
    dataDir: dataDir(),
    now: () => clock.now,
    sleep: async () => {},
    timezone: TIMEZONE,
    logger: { ...silent, info: (line) => lines.push(line) },
  });
  await gladys.connect();
  t.after(() => app.stop());
  const find = await gladys.fake.action(ACTIONS.FIND_PORT, { query: 'concarneau' });
  assert.match(find.data.message.fr, /^1 trouvé\(s\) : Concarneau\./);
  const none = await gladys.fake.action(ACTIONS.FIND_PORT, { query: 'atlantis' });
  assert.match(none.data.message.en, /No harbor matches "atlantis"/);
  const many = await gladys.fake.action(ACTIONS.FIND_PORT, { query: 'saint' });
  assert.ok(many.data.message.de.length <= 300);
  const refresh = await gladys.fake.action(ACTIONS.REFRESH);
  assert.equal(refresh.data.message.en, 'Tides downloaded for 1 harbor(s).');
  assert.equal(shom.calls.filter((call) => call[0] === 'tides').length, 2);
  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diagnostic.data.message.fr, /Journaux/);
  assert.ok(lines.some((line) => /Diagnostic: BREST: 30 tides, 864 heights/.test(line)));
});
