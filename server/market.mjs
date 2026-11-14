const TIME_ZONE = 'Europe/Amsterdam';
const ENDPOINT = 'https://api.energy-charts.info/v2/price';
const MINUTE = 60_000;
const DAY = 86_400_000;
const SOURCE = Object.freeze({
  name: 'Energy-Charts',
  url: 'https://api.energy-charts.info/',
  license: 'CC BY 4.0',
  attribution: 'Energy-Charts (Fraunhofer ISE); oorspronkelijke data: Bundesnetzagentur | SMARD.de',
});
const ACCEPTED_LICENSE = 'CC BY 4.0 (creativecommons.org/licenses/by/4.0) from Bundesnetzagentur | SMARD.de';
const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const localClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parts(formatter, value) {
  return Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value]));
}

function localDate(value) {
  const p = parts(localDateFormatter, value);
  return `${p.year}-${p.month}-${p.day}`;
}

function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('Gebruik een datum in de vorm JJJJ-MM-DD.');
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError('Deze kalenderdatum bestaat niet.');
  }
  return timestamp;
}

function shiftDate(date, days) {
  return new Date(dateValue(date) + days * DAY).toISOString().slice(0, 10);
}

// Dutch local midnight is never ambiguous. Recalculate the UTC offset rather
// than assuming every delivery day contains 24 hours.
function midnight(date) {
  const target = dateValue(date);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const p = parts(localClockFormatter, candidate);
    const localAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    candidate = target - (localAsUtc - candidate);
  }
  return candidate;
}

function timestamp(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) {
    throw new Error('invalid_timestamp');
  }
  try { dateValue(value.slice(0, 10)); } catch { throw new Error('invalid_timestamp'); }
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error('invalid_timestamp');
  return result;
}

function retryTime(response, current) {
  const value = response.headers?.get('retry-after');
  if (value && /^\d+$/.test(value)) {
    const until = current + Number(value) * 1000;
    return Number.isFinite(until) && until <= 8.64e15 ? until : current + MINUTE;
  }
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && parsed > current ? parsed : current + MINUTE;
}

function parsePrices(body, date, current) {
  if (!body || body.schema_version !== '2.0' || body.endpoint !== 'price' ||
      body.bidding_zone !== 'NL' || body.country !== 'nl' || body.timezone !== TIME_ZONE ||
      body.resolution !== 'PT15M' || body.interval_minutes !== 15 ||
      typeof body.unit !== 'string' || body.unit.replace(/\s/g, '') !== 'EUR/MWh') {
    throw new Error('unexpected_schema');
  }
  if (body.license !== ACCEPTED_LICENSE) throw new Error('unconfirmed_license');
  if (typeof body.deprecated !== 'boolean') throw new Error('unexpected_schema');
  if (!Array.isArray(body.series) ||
      !body.series.some(series => series?.id === 'day_ahead_price')) {
    throw new Error('missing_price_series');
  }
  const start = midnight(date);
  const end = midnight(shiftDate(date, 1));
  const count = (end - start) / (15 * MINUTE);
  if (!Array.isArray(body.data) || body.data.length !== count) throw new Error('incomplete_day');
  if (timestamp(body.available_from) !== start ||
      timestamp(body.available_until) !== end - 15 * MINUTE) {
    throw new Error('wrong_delivery_period');
  }
  // generated_at is a response-generation timestamp, not an auction publication
  // timestamp. It must never be exposed as publishedAt.
  if (timestamp(body.generated_at) > current + 5 * MINUTE) throw new Error('future_response_time');
  const intervals = body.data.map((row, index) => {
    const at = timestamp(row?.timestamp);
    if (at !== start + index * 15 * MINUTE) throw new Error('nonconsecutive_intervals');
    const price = row.values?.day_ahead_price;
    if (typeof price !== 'number' || !Number.isFinite(price)) throw new Error('invalid_price');
    return { start: new Date(at).toISOString(), durationMinutes: 15, marketEurMWh: price };
  });
  return { intervals, deprecated: body.deprecated };
}

/**
 * Keyless, server-only Energy-Charts adapter. Only complete licensed NL delivery
 * days are returned. A stale response is always the same requested delivery day.
 * Cache and rate budgets are in memory, per service instance/process.
 */
export function createMarketService({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  if (typeof fetchImpl !== 'function' || typeof now !== 'function') {
    throw new TypeError('fetchImpl en now moeten functies zijn.');
  }
  const cache = new Map();
  const misses = new Map();
  const inFlight = new Map();
  const attempts = [];
  let blockedUntil = 0;
  let lastSuccessAt = null;
  let lastAttemptAt = null;
  let lastErrorCode = null;

  function clock() {
    const value = now();
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Ongeldige klok.');
    return value;
  }

  function nextAllowed(current) {
    while (attempts.length && attempts[0] <= current - MINUTE) attempts.shift();
    return Math.max(blockedUntil, attempts.length >= 2 ? attempts[0] + MINUTE : current);
  }

  function empty(date, status, message, fetchedAt = null) {
    return { status, date, timeZone: TIME_ZONE, source: { ...SOURCE },
      fetchedAt, publishedAt: null, stale: false, intervals: [], message };
  }

  function staleOrEmpty(date, code, current, status = 'unavailable', retryAt = current + MINUTE) {
    lastErrorCode = code;
    const previous = cache.get(date);
    const message = previous
      ? 'De bron kon niet opnieuw worden gecontroleerd. Je ziet de eerder opgehaalde prijzen voor deze datum.'
      : status === 'not_published'
        ? 'De beursprijzen voor morgen zijn nog niet gepubliceerd.'
        : 'De beursprijzen zijn tijdelijk niet beschikbaar. Probeer het later opnieuw.';
    const response = previous
      ? { ...previous.result, stale: true, message }
      : empty(date, status, message);
    misses.set(date, { response, retryAt });
    return structuredClone(response);
  }

  async function refresh(date, current, today) {
    attempts.push(current);
    lastAttemptAt = new Date(current).toISOString();
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({ bzn: 'NL', start: date, end: date }).toString();
    try {
      const response = await fetchImpl(url.href, {
        headers: { Accept: 'application/json', 'User-Agent': 'Zonlio/1.0 (+https://zonlio.nl)' },
        signal: AbortSignal.timeout(15000),
      });
      const received = clock();
      if (response.status === 429) {
        blockedUntil = Math.max(blockedUntil, retryTime(response, received));
        return staleOrEmpty(date, 'rate_limited', received, 'unavailable', blockedUntil);
      }
      if (response.status === 404) {
        const status = date === shiftDate(today, 1) ? 'not_published' : 'unavailable';
        return staleOrEmpty(date, status === 'not_published' ? 'not_published' : 'missing_day', received, status, received + 5 * MINUTE);
      }
      if (!response.ok) return staleOrEmpty(date, 'upstream_error', received);
      const parsed = parsePrices(await response.json(), date, received);
      const fetchedAt = new Date(received).toISOString();
      const result = { status: 'available', date, timeZone: TIME_ZONE, source: { ...SOURCE },
        fetchedAt, publishedAt: null, stale: false, intervals: parsed.intervals };
      if (parsed.deprecated) result.message = 'De dataleverancier heeft deze API-versie als verouderd gemarkeerd.';
      cache.set(date, { result, freshUntil: received + (date < today ? 6 * 60 * MINUTE : 15 * MINUTE) });
      misses.delete(date);
      lastSuccessAt = fetchedAt;
      lastErrorCode = parsed.deprecated ? 'provider_deprecated' : null;
      return structuredClone(result);
    } catch (error) {
      const known = ['unexpected_schema', 'unconfirmed_license', 'missing_price_series', 'incomplete_day',
        'wrong_delivery_period', 'future_response_time', 'nonconsecutive_intervals', 'invalid_price', 'invalid_timestamp'];
      const code = known.includes(error?.message) ? error.message : 'fetch_failed';
      return staleOrEmpty(date, code, clock());
    }
  }

  async function getDay(date) {
    dateValue(date);
    const current = clock();
    const today = localDate(current);
    const earliest = shiftDate(today, -30);
    const latest = shiftDate(today, 1);
    if (date < earliest || date > latest) {
      throw new RangeError('Kies een datum vanaf 30 dagen geleden tot en met morgen.');
    }
    for (const key of cache.keys()) if (key < earliest || key > latest) cache.delete(key);
    for (const key of misses.keys()) if (key < earliest || key > latest) misses.delete(key);
    const hit = cache.get(date);
    if (hit && hit.freshUntil > current) return structuredClone(hit.result);
    if (inFlight.has(date)) return structuredClone(await inFlight.get(date));
    const miss = misses.get(date);
    if (miss && miss.retryAt > current) {
      // A previously unpublished tomorrow becomes today's missing data at
      // midnight; it must no longer be presented as an upcoming auction.
      if (miss.response.status === 'not_published' && date <= today) {
        return empty(date, 'unavailable', 'De beursprijzen zijn tijdelijk niet beschikbaar. Probeer het later opnieuw.');
      }
      return structuredClone(miss.response);
    }
    const allowedAt = nextAllowed(current);
    if (allowedAt > current) return staleOrEmpty(date, 'local_rate_limit', current, 'unavailable', allowedAt);
    const promise = refresh(date, current, today);
    inFlight.set(date, promise);
    try { return await promise; }
    finally { inFlight.delete(date); }
  }

  function getStatus() {
    const current = clock();
    const allowedAt = nextAllowed(current);
    return { provider: 'energy-charts', status: lastErrorCode ? 'degraded' : lastSuccessAt ? 'ready' : 'idle',
      lastSuccessAt, lastAttemptAt, lastErrorCode, cachedDays: cache.size,
      inFlight: inFlight.size, nextFetchAllowedAt: allowedAt > current ? new Date(allowedAt).toISOString() : null };
  }

  return { getDay, getStatus };
}
