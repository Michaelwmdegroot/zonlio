import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherService, WEATHER_REGIONS } from '../server/weather.mjs';

const HOUR = 3_600_000;
const REFERENCE = Date.parse('2026-11-14T10:00:00Z');
const CONTACT = 'Zonlio-test/1.0 (+https://example.test/contact)';

function fixture(current = REFERENCE) {
  const first = Math.floor(current / HOUR) * HOUR;
  const timeseries = [0, 1, 2, 3, 6, 12, 18].map((offset, index) => ({
    time: new Date(first + offset * HOUR).toISOString().replace('.000Z', 'Z'),
    data: {
      instant: { details: { air_temperature: 8 + index, cloud_area_fraction: index * 10 } },
      ...(index < 3
        ? { next_1_hours: { details: { precipitation_amount: index / 10 } } }
        : { next_6_hours: { details: { precipitation_amount: 6 } } }),
    },
  }));
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [4.49, 52.16, 0] },
    properties: { meta: { updated_at: new Date(current - HOUR).toISOString().replace('.000Z', 'Z'),
      units: { air_temperature: 'celsius', cloud_area_fraction: '%', precipitation_amount: 'mm' } }, timeseries } };
}

function json(value, headers = {}, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}

test('weather exposes coarse whitelisted regions and real weather units, without a PV estimate', async () => {
  assert.ok(WEATHER_REGIONS.some(region => region.id === 'leiden'));
  assert.ok(WEATHER_REGIONS.every(region => Object.keys(region).sort().join(',') === 'id,name'));
  let calls = 0;
  const service = createWeatherService({ now: () => REFERENCE, userAgent: CONTACT, fetchImpl: async (url, options) => {
    calls += 1;
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('lat'), '52.16');
    assert.equal(parsed.searchParams.get('lon'), '4.49');
    assert.equal(options.headers['User-Agent'], CONTACT);
    return json(fixture());
  } });
  const result = await service.getRegion('leiden');
  assert.equal(result.status, 'available');
  assert.deepEqual(result.region, { id: 'leiden', name: 'Leiden' });
  assert.equal(result.hours[0].temperatureC, 8);
  assert.equal(result.hours[0].cloudPercent, 0);
  assert.equal(result.hours[0].rainMm, 0);
  assert.equal(Object.hasOwn(result.hours[3], 'rainMm'), false); // Six-hour total is not hourly rain.
  assert.equal(Object.hasOwn(result.hours[0], 'solarKwh'), false);
  result.hours[0].temperatureC = 99;
  assert.equal((await service.getRegion('leiden')).hours[0].temperatureC, 8);
  assert.equal(calls, 1);
});

test('weather rejects arbitrary locations before any upstream request', async () => {
  let calls = 0;
  const service = createWeatherService({ now: () => REFERENCE, fetchImpl: async () => { calls += 1; return json(fixture()); } });
  for (const region of ['52.16,4.49', 'leiden?lat=0', 'Leiden', 'unknown', '', null]) {
    await assert.rejects(service.getRegion(region), error => error instanceof RangeError || error instanceof TypeError);
  }
  assert.equal(calls, 0);
});

test('weather singleflight and minimum three-hour cache prevent repeated identical requests', async () => {
  let current = REFERENCE;
  let release;
  let calls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const service = createWeatherService({ now: () => current, fetchImpl: () => { calls += 1; return pending; } });
  const a = service.getRegion('leiden');
  const b = service.getRegion('leiden');
  assert.equal(calls, 1);
  release(json(fixture(), { Expires: new Date(current + HOUR).toUTCString() }));
  assert.deepEqual(await a, await b);
  current += 2 * HOUR;
  assert.equal((await service.getRegion('leiden')).status, 'available');
  assert.equal(calls, 1);
});

test('weather respects later Expires and sends the exact Last-Modified on conditional refresh', async () => {
  let current = REFERENCE;
  let calls = 0;
  const modified = new Date(REFERENCE - HOUR).toUTCString();
  const service = createWeatherService({ now: () => current, fetchImpl: async (_url, options) => {
    calls += 1;
    if (calls === 1) return json(fixture(), {
      Expires: new Date(REFERENCE + 8 * HOUR).toUTCString(), 'Last-Modified': modified,
    });
    assert.equal(options.headers['If-Modified-Since'], modified);
    return new Response(null, { status: 304 });
  } });
  const initial = await service.getRegion('leiden');
  current += 4 * HOUR;
  await service.getRegion('leiden');
  assert.equal(calls, 1);
  current += 4 * HOUR;
  const refreshed = await service.getRegion('leiden');
  assert.equal(calls, 2);
  assert.equal(refreshed.status, 'available');
  assert.equal(refreshed.stale, false);
  assert.notEqual(refreshed.fetchedAt, initial.fetchedAt);
});

test('weather outage retains an explicitly stale forecast, then expires old model data', async () => {
  let current = REFERENCE;
  let calls = 0;
  const service = createWeatherService({ now: () => current, fetchImpl: async () => {
    calls += 1;
    if (calls > 1) throw new Error('network failed');
    return json(fixture());
  } });
  const initial = await service.getRegion('leiden');
  current += 4 * HOUR;
  const stale = await service.getRegion('leiden');
  assert.equal(stale.status, 'available');
  assert.equal(stale.stale, true);
  assert.equal(stale.fetchedAt, initial.fetchedAt);
  current = REFERENCE + 25 * HOUR;
  const expired = await service.getRegion('leiden');
  assert.equal(expired.status, 'unavailable');
  assert.deepEqual(expired.hours, []);
});

test('weather rejects invalid values, units, dates, sequences and unrelated forecast locations', async () => {
  const changes = [
    body => { body.geometry.coordinates = [5.12, 52.09, 0]; },
    body => { body.properties.meta.units.air_temperature = 'fahrenheit'; },
    body => { body.properties.timeseries[0].data.instant.details.cloud_area_fraction = null; },
    body => { body.properties.timeseries[0].data.instant.details.cloud_area_fraction = 101; },
    body => { body.properties.timeseries[0].data.next_1_hours.details.precipitation_amount = -1; },
    body => { body.properties.timeseries[1].time = body.properties.timeseries[0].time; },
    body => { body.properties.meta.updated_at = '2026-11-14T15:00:00Z'; },
    body => { body.properties.meta.updated_at = '2026-02-30T10:00:00Z'; },
  ];
  for (const change of changes) {
    const body = fixture();
    change(body);
    const service = createWeatherService({ now: () => REFERENCE, fetchImpl: async () => json(body) });
    const result = await service.getRegion('leiden');
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.hours, []);
  }
});

test('weather does not turn a 304 without any cached forecast into an available result', async () => {
  const service = createWeatherService({ now: () => REFERENCE,
    fetchImpl: async () => new Response(null, { status: 304 }) });
  assert.equal((await service.getRegion('leiden')).status, 'unavailable');
  assert.equal(service.getStatus().lastErrorCode, 'unusable_not_modified');
});

test('weather honors 429 Retry-After for other regions and exposes no upstream diagnostics', async () => {
  let current = REFERENCE;
  let calls = 0;
  const service = createWeatherService({ now: () => current, fetchImpl: async () => {
    calls += 1;
    return json({ privateDiagnostic: 'not for the public endpoint' }, { 'Retry-After': '3600' }, 429);
  } });
  await service.getRegion('leiden');
  current += HOUR / 2;
  assert.equal((await service.getRegion('utrecht')).status, 'unavailable');
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(service.getStatus()), /privateDiagnostic/);
});

test('weather also respects Expires after rejecting malformed upstream data', async () => {
  let current = REFERENCE;
  let calls = 0;
  const service = createWeatherService({ now: () => current, fetchImpl: async () => {
    calls += 1;
    return json({}, { Expires: new Date(REFERENCE + 8 * HOUR).toUTCString() });
  } });
  assert.equal((await service.getRegion('leiden')).status, 'unavailable');
  current += 4 * HOUR;
  assert.equal((await service.getRegion('leiden')).status, 'unavailable');
  assert.equal(calls, 1);
});
