const HOUR = 3_600_000;
const REFRESH_INTERVAL = 3 * HOUR;
const MAX_STALE_AGE = 24 * HOUR;
const ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const SOURCE = Object.freeze({
  name: 'MET Norway',
  url: 'https://api.met.no/weatherapi/locationforecast/2.0/documentation',
  license: 'CC BY 4.0',
  attribution: 'Weerdata van MET Norway; door Zonlio geselecteerd en weergegeven.',
});
const regions = [
  ['leiden', 'Leiden', 52.16, 4.49],
  ['amsterdam', 'Amsterdam', 52.37, 4.90],
  ['rotterdam', 'Rotterdam', 51.92, 4.48],
  ['den-haag', 'Den Haag', 52.08, 4.30],
  ['utrecht', 'Utrecht', 52.09, 5.12],
  ['eindhoven', 'Eindhoven', 51.44, 5.48],
  ['arnhem', 'Arnhem', 51.99, 5.91],
  ['zwolle', 'Zwolle', 52.51, 6.09],
  ['groningen', 'Groningen', 53.22, 6.57],
  ['leeuwarden', 'Leeuwarden', 53.20, 5.80],
  ['assen', 'Assen', 53.00, 6.56],
  ['maastricht', 'Maastricht', 50.85, 5.69],
  ['middelburg', 'Middelburg', 51.50, 3.61],
  ['lelystad', 'Lelystad', 52.52, 5.47],
];
export const WEATHER_REGIONS = Object.freeze(regions.map(([id, name]) => Object.freeze({ id, name })));
const byId = new Map(regions.map(([id, name, lat, lon]) => [id, { id, name, lat, lon }]));

function parseTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    throw new Error('invalid_timestamp');
  }
  const result = Date.parse(value);
  if (!Number.isFinite(result) || new Date(result).toISOString() !== value.replace('Z', '.000Z')) {
    throw new Error('invalid_timestamp');
  }
  return result;
}

function finite(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function parseWeather(body, region, current) {
  const properties = body?.properties;
  const coordinates = body?.geometry?.coordinates;
  if (body?.type !== 'Feature' || body?.geometry?.type !== 'Point' || !Array.isArray(coordinates) ||
      !finite(coordinates[0], -180, 180) || !finite(coordinates[1], -90, 90) ||
      Math.abs(coordinates[0] - region.lon) > 0.25 || Math.abs(coordinates[1] - region.lat) > 0.25) {
    throw new Error('unexpected_location');
  }
  const updatedAt = parseTime(properties?.meta?.updated_at);
  if (updatedAt > current + 5 * 60_000 || updatedAt < current - MAX_STALE_AGE) throw new Error('outdated_forecast');
  const units = properties?.meta?.units;
  if (units?.air_temperature !== 'celsius' || units?.cloud_area_fraction !== '%') throw new Error('unexpected_units');
  const rows = properties.timeseries;
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('missing_forecast');
  let previous = -Infinity;
  const hours = rows.map(row => {
    const at = parseTime(row?.time);
    if (at <= previous || (Number.isFinite(previous) && at - previous > 6 * HOUR)) throw new Error('invalid_sequence');
    previous = at;
    const details = row?.data?.instant?.details;
    if (!finite(details?.air_temperature, -100, 100) || !finite(details?.cloud_area_fraction, 0, 100)) {
      throw new Error('invalid_weather_value');
    }
    const hour = { start: new Date(at).toISOString(), temperatureC: details.air_temperature, cloudPercent: details.cloud_area_fraction };
    // A 6-hour precipitation total must never be labelled as an hourly total.
    const rain = row.data.next_1_hours?.details?.precipitation_amount;
    if (rain !== undefined) {
      if (units.precipitation_amount !== 'mm' || !finite(rain, 0, 1000)) throw new Error('invalid_rain_value');
      hour.rainMm = rain;
    }
    return hour;
  });
  if (!hours.some(hour => Date.parse(hour.start) >= current && Date.parse(hour.start) <= current + 6 * HOUR)) {
    throw new Error('missing_near_forecast');
  }
  return { hours, updatedAt };
}

function httpDate(value) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/** Regional weather context, never a PV yield forecast or live observation. */
export function createWeatherService({
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  userAgent = process.env.MET_USER_AGENT || 'Zonlio/1.0 info@zonlio.nl',
} = {}) {
  if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new TypeError('fetchImpl en now moeten functies zijn.');
  if (typeof userAgent !== 'string' || !userAgent.trim() || /[\r\n]/.test(userAgent)) throw new TypeError('Ongeldige MET User-Agent.');
  const cache = new Map();
  const misses = new Map();
  const inFlight = new Map();
  let blockedUntil = 0;
  let lastSuccessAt = null;
  let lastAttemptAt = null;
  let lastErrorCode = null;

  function clock() {
    const value = now();
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Ongeldige klok.');
    return value;
  }

  function empty(region) {
    return { status: 'unavailable', region: { id: region.id, name: region.name }, source: { ...SOURCE },
      fetchedAt: null, stale: false, hours: [], message: 'De weersverwachting is tijdelijk niet beschikbaar.' };
  }

  function usable(entry, current) {
    return entry && current - entry.updatedAt <= MAX_STALE_AGE &&
      entry.result.hours.some(hour => Date.parse(hour.start) >= current);
  }

  function copyResult(entry, current, forceStale = false) {
    const stale = forceStale || current - entry.updatedAt > 12 * HOUR;
    const result = structuredClone(entry.result);
    result.stale = stale;
    if (stale) result.message = forceStale
      ? 'De bron kon niet opnieuw worden gecontroleerd. Je ziet een eerder opgehaalde weersverwachting.'
      : 'De bron levert een oudere weersverwachting. Houd rekening met extra onzekerheid.';
    return result;
  }

  function fail(region, code, current, retryAt = current + REFRESH_INTERVAL) {
    lastErrorCode = code;
    misses.set(region.id, { retryAt });
    const previous = cache.get(region.id);
    return usable(previous, current) ? copyResult(previous, current, true) : empty(region);
  }

  async function refresh(region, current) {
    const previous = cache.get(region.id);
    const headers = { 'User-Agent': userAgent, 'Accept-Encoding': 'gzip, deflate' };
    if (previous?.lastModified) headers['If-Modified-Since'] = previous.lastModified;
    lastAttemptAt = new Date(current).toISOString();
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({ lat: region.lat.toFixed(2), lon: region.lon.toFixed(2) }).toString();
    let retryAt = current + REFRESH_INTERVAL;
    try {
      const response = await fetchImpl(url.href, { headers, signal: AbortSignal.timeout(15000) });
      const received = clock();
      const expiresAt = httpDate(response.headers?.get('expires')) || received;
      const nextRequestAt = Math.max(received + REFRESH_INTERVAL, expiresAt);
      retryAt = nextRequestAt;
      if (response.status === 429) {
        const retry = response.headers?.get('retry-after');
        const parsedRetry = retry && /^\d+$/.test(retry) ? received + Number(retry) * 1000 : httpDate(retry);
        const requested = Number.isFinite(parsedRetry) && parsedRetry <= 8.64e15 ? parsedRetry : null;
        blockedUntil = Math.max(blockedUntil, requested || nextRequestAt);
        return fail(region, 'rate_limited', received, Math.max(nextRequestAt, blockedUntil));
      }
      if (response.status === 304) {
        if (!usable(previous, received)) return fail(region, 'unusable_not_modified', received, nextRequestAt);
        previous.result.fetchedAt = new Date(received).toISOString();
        previous.nextRequestAt = nextRequestAt;
        misses.delete(region.id);
        lastSuccessAt = previous.result.fetchedAt;
        lastErrorCode = null;
        return copyResult(previous, received);
      }
      if (!response.ok) return fail(region, 'upstream_error', received, nextRequestAt);
      const parsed = parseWeather(await response.json(), region, received);
      const result = { status: 'available', region: { id: region.id, name: region.name }, source: { ...SOURCE },
        fetchedAt: new Date(received).toISOString(), stale: false, hours: parsed.hours };
      const lastModified = response.headers?.get('last-modified');
      const entry = { result, updatedAt: parsed.updatedAt, nextRequestAt,
        lastModified: httpDate(lastModified) !== null ? lastModified : null };
      cache.set(region.id, entry);
      misses.delete(region.id);
      lastSuccessAt = result.fetchedAt;
      lastErrorCode = response.status === 203 ? 'provider_deprecated' : null;
      return copyResult(entry, received);
    } catch (error) {
      const known = ['invalid_timestamp', 'unexpected_location', 'outdated_forecast', 'unexpected_units',
        'missing_forecast', 'invalid_sequence', 'invalid_weather_value', 'invalid_rain_value', 'missing_near_forecast'];
      const failedAt = clock();
      return fail(region, known.includes(error?.message) ? error.message : 'fetch_failed', failedAt,
        Math.max(retryAt, failedAt + REFRESH_INTERVAL));
    }
  }

  async function getRegion(regionSlug) {
    if (typeof regionSlug !== 'string') throw new TypeError('Kies een beschikbare weerregio.');
    const region = byId.get(regionSlug);
    if (!region) throw new RangeError('Deze weerregio is niet beschikbaar.');
    const current = clock();
    if (inFlight.has(region.id)) return structuredClone(await inFlight.get(region.id));
    const hit = cache.get(region.id);
    const miss = misses.get(region.id);
    if (miss?.retryAt > current || blockedUntil > current) {
      return usable(hit, current) ? copyResult(hit, current, true) : empty(region);
    }
    if (hit?.nextRequestAt > current) return usable(hit, current) ? copyResult(hit, current) : empty(region);
    const promise = refresh(region, current);
    inFlight.set(region.id, promise);
    try { return await promise; }
    finally { inFlight.delete(region.id); }
  }

  function getStatus() {
    return { provider: 'met-norway', status: lastErrorCode ? 'degraded' : lastSuccessAt ? 'ready' : 'idle',
      lastSuccessAt, lastAttemptAt, lastErrorCode, cachedRegions: cache.size, inFlight: inFlight.size };
  }

  return { getRegion, getStatus };
}
