// -----------------------------------------------------------------------------
// Client of the public tide services of the SHOM (Service hydrographique et
// océanographique de la Marine), the ones the maree.shom.fr website calls.
//
// Endpoints, read in the Home Assistant integration KipK/marees_france
// (MIT) and checked against the live service:
//   - ports    WFS layer SPM_PORTS_WFS:liste_ports_spm_h2m (GeoJSON): the
//              harbors with tide predictions, `cst` is the harbor code;
//   - hlt      high and low tides, per day: [type, "HH:MM", "height", "coef"];
//   - wl       water heights every 5 minutes, per day: ["HH:MM:SS", height];
//   - coeff    coefficients per day, grouped by month.
//
// Pitfalls of the service (all checked):
//   - Without the Referer of maree.shom.fr and a browser User-Agent it
//     answers 401 / 403.
//   - A web application firewall sits in front of it: some query strings are
//     refused with an HTML "Security Error" page in 403 (e.g. a query ending
//     with `&correlation=1&duration=1`), and the address is then refused for
//     a while. The query strings below keep the parameter order of the
//     website; never send a duration of 1 to hlt.
//   - `utc=0` gives the times in UTC (the date keys are UTC days too):
//     `utc=standard` gives the legal time of mainland France, whatever the
//     harbor. The integration always asks UTC and converts.
//   - hlt accepts 8 days at most ("Wrong period requested" beyond).
//   - An unknown harbor answers 400 `error.bad_parameters`.
//
// The data is the property of the SHOM (prediction tables, licence of the
// SHOM); the integration reads it like the website does, once a day per
// harbor, and keeps it in /data between restarts.
// -----------------------------------------------------------------------------

const PORTS_URL =
  'https://services.data.shom.fr/x13f1b4faeszdyinv9zqxmx1/wfs?service=WFS&version=1.0.0' +
  '&srsName=EPSG:3857&request=GetFeature&typeName=SPM_PORTS_WFS:liste_ports_spm_h2m' +
  '&outputFormat=application/json';
const SPM_URL = 'https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm/spm';
const HEADERS = {
  Referer: 'https://maree.shom.fr/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/109.0.0.0 Safari/537.36',
  Accept: 'application/json',
};
const MAX_TIDE_DAYS = 8;
const MAX_LEVEL_DAYS = 3;
const MAX_COEFF_DAYS = 31;
const TIMEOUT_MS = 30000;

/**
 * @description An error of the SHOM service, with a kind the app turns into a
 * message: `blocked` (the firewall refused the address), `unknown_port`,
 * `http`, `invalid` (not the expected JSON), `unreachable`.
 */
class ShomError extends Error {
  /**
   * @param {string} kind - The kind.
   * @param {string} message - The message.
   * @param {number} [status] - The HTTP status.
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'ShomError';
    this.kind = kind;
    this.status = status;
  }
}

const encode = (value) => encodeURIComponent(value);

/**
 * @description URL of the high and low tides of a harbor.
 * @param {string} port - The harbor code (cst).
 * @param {string} date - First UTC day, YYYY-MM-DD.
 * @param {number} days - 2 to 8 days.
 * @returns {string} The URL.
 * @example
 * tidesUrl('BREST', '2026-10-14', 8);
 */
function tidesUrl(port, date, days) {
  const duration = Math.min(MAX_TIDE_DAYS, Math.max(2, Math.round(days)));
  return `${SPM_URL}/hlt?harborName=${encode(port)}&date=${date}&utc=0&correlation=1&duration=${duration}`;
}

/**
 * @description URL of the water heights (every 5 minutes) of a harbor.
 * @param {string} port - The harbor code.
 * @param {string} date - First UTC day, YYYY-MM-DD.
 * @param {number} days - 1 to 3 days.
 * @returns {string} The URL.
 */
function levelsUrl(port, date, days) {
  const duration = Math.min(MAX_LEVEL_DAYS, Math.max(1, Math.round(days)));
  return `${SPM_URL}/wl?harborName=${encode(port)}&duration=${duration}&date=${date}&utc=0&nbWaterLevels=288`;
}

/**
 * @description URL of the daily coefficients of a harbor.
 * @param {string} port - The harbor code.
 * @param {string} date - First UTC day, YYYY-MM-DD.
 * @param {number} days - 2 to 31 days.
 * @returns {string} The URL.
 */
function coefficientsUrl(port, date, days) {
  const duration = Math.min(MAX_COEFF_DAYS, Math.max(2, Math.round(days)));
  return `${SPM_URL}/coeff?harborName=${encode(port)}&duration=${duration}&date=${date}&utc=0&correlation=1`;
}

/**
 * @description The default transport: fetch, with a timeout.
 * @param {string} url - The URL.
 * @param {object} headers - The headers.
 * @returns {Promise<{ status: number, contentType: string, body: string }>} The answer.
 */
async function fetchRequest(url, headers) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: await response.text(),
  };
}

/**
 * @description Create a SHOM client.
 * @param {object} [options] - Options.
 * @param {Function} [options.request] - `(url, headers) => Promise<{ status, contentType, body }>` (tests).
 * @returns {object} The client: `ports()`, `tides()`, `levels()`, `coefficients()`.
 * @example
 * const shom = createShomClient();
 * const tides = await shom.tides('BREST', '2026-10-14', 8);
 */
function createShomClient({ request = fetchRequest } = {}) {
  /**
   * @description GET a JSON document, with the errors sorted.
   * @param {string} url - The URL.
   * @returns {Promise<unknown>} The JSON.
   */
  async function getJson(url) {
    let answer;
    try {
      answer = await request(url, HEADERS);
    } catch (err) {
      throw new ShomError('unreachable', `SHOM unreachable: ${err.message}`);
    }
    const { status, body = '' } = answer;
    const looksHtml = /^\s*</.test(body);
    if (looksHtml && /Security Error/i.test(body)) {
      throw new ShomError('blocked', `SHOM firewall refused the request (${status})`, status);
    }
    let json;
    try {
      json = looksHtml ? null : JSON.parse(body);
    } catch {
      json = null;
    }
    if (status === 400 && json?.error_message && /bad_parameters/.test(json.error_message)) {
      throw new ShomError('unknown_port', `SHOM: ${json.error_message}`, status);
    }
    if (status === 401 || status === 403) {
      throw new ShomError('blocked', `SHOM refused the request (${status})`, status);
    }
    if (status < 200 || status >= 300) {
      throw new ShomError('http', `SHOM answered ${status}`, status);
    }
    if (json === null || typeof json !== 'object') {
      throw new ShomError('invalid', 'SHOM answer is not JSON', status);
    }
    return json;
  }

  return {
    ports: () => getJson(PORTS_URL),
    tides: (port, date, days = MAX_TIDE_DAYS) => getJson(tidesUrl(port, date, days)),
    levels: (port, date, days = MAX_LEVEL_DAYS) => getJson(levelsUrl(port, date, days)),
    coefficients: (port, date, days) => getJson(coefficientsUrl(port, date, days)),
  };
}

export {
  PORTS_URL,
  SPM_URL,
  HEADERS,
  MAX_TIDE_DAYS,
  MAX_LEVEL_DAYS,
  MAX_COEFF_DAYS,
  ShomError,
  createShomClient,
  tidesUrl,
  levelsUrl,
  coefficientsUrl,
};
