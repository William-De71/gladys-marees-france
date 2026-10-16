import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createShomClient,
  tidesUrl,
  levelsUrl,
  coefficientsUrl,
  HEADERS,
  ShomError,
} from '../src/shom-api.js';

const SECURITY_PAGE =
  '<!DOCTYPE html>\n<html><head><title>\n Security Error\n</title></head><body>[1670]</body></html>';

test('the query strings keep the order of the website and always ask UTC', () => {
  assert.equal(
    tidesUrl('BREST', '2026-10-14', 8),
    'https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm/spm/hlt?harborName=BREST&date=2026-10-14&utc=0&correlation=1&duration=8',
  );
  assert.equal(
    levelsUrl('BREST', '2026-10-14', 3),
    'https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm/spm/wl?harborName=BREST&duration=3&date=2026-10-14&utc=0&nbWaterLevels=288',
  );
  assert.equal(
    coefficientsUrl('BREST', '2026-10-15', 15),
    'https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm/spm/coeff?harborName=BREST&duration=15&date=2026-10-15&utc=0&correlation=1',
  );
  // The firewall refuses `...&correlation=1&duration=1`; the SHOM refuses more than 8 days.
  assert.match(tidesUrl('BREST', '2026-10-14', 1), /duration=2$/);
  assert.match(tidesUrl('BREST', '2026-10-14', 30), /duration=8$/);
  assert.match(levelsUrl('BREST', '2026-10-14', 9), /duration=3&/);
  assert.match(tidesUrl("L'ILE", '2026-10-14', 8), /harborName=L'ILE&/);
});

test('every request carries the Referer of maree.shom.fr and a browser User-Agent', async () => {
  const seen = [];
  const shom = createShomClient({
    request: async (url, headers) => {
      seen.push(headers);
      return { status: 200, body: '{"2026-10-14":[]}' };
    },
  });
  await shom.tides('BREST', '2026-10-14');
  assert.equal(seen[0].Referer, 'https://maree.shom.fr/');
  assert.match(seen[0]['User-Agent'], /^Mozilla\/5\.0/);
  assert.equal(seen[0], HEADERS);
});

test('the errors are sorted by kind', async () => {
  const answer = (status, body) =>
    createShomClient({ request: async () => ({ status, body }) }).tides('BREST', '2026-10-14');
  const kind = async (promise) => {
    try {
      await promise;
    } catch (err) {
      assert.ok(err instanceof ShomError);
      return err.kind;
    }
    return 'none';
  };
  assert.equal(await kind(answer(403, SECURITY_PAGE)), 'blocked');
  assert.equal(await kind(answer(200, SECURITY_PAGE)), 'blocked');
  assert.equal(await kind(answer(401, '')), 'blocked');
  assert.equal(
    await kind(
      answer(
        400,
        '{"error_code":"error.bad_request","error_message":"Error when calling SPM : error.bad_parameters"}',
      ),
    ),
    'unknown_port',
  );
  assert.equal(
    await kind(
      answer(400, '{"error_code":"error.bad_request","error_message":"Wrong period requested"}'),
    ),
    'http',
  );
  assert.equal(await kind(answer(502, '<html>Bad gateway</html>')), 'http');
  assert.equal(await kind(answer(200, '<html>maintenance</html>')), 'invalid');
  assert.equal(await kind(answer(200, 'not json')), 'invalid');
  const down = createShomClient({
    request: async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    },
  });
  assert.equal(await kind(down.ports()), 'unreachable');
});
