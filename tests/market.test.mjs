import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarketService } from '../server/market.mjs';

const MINUTE = 60_000;
const REFERENCE = Date.parse('2026-11-14T10:00:00Z');
const LICENSE = 'CC BY 4.0 (creativecommons.org/licenses/by/4.0) from Bundesnetzagentur | SMARD.de';

function fixture(date = '2026-11-14', {
  start = `${date}T00:00:00+01:00`, count = 96, generatedAt = REFERENCE,
} = {}) {
  const first = Date.parse(start);
  const data = Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(first + i * 15 * MINUTE).toISOString(),
    values: { day_ahead_price: i === 0 ? -20 : i === 1 ? 0 : 100 + i / 10 },
  }));
  return { schema_version: '2.0', endpoint: 'price', country: 'nl', bidding_zone: 'NL',
    timezone: 'Europe/Amsterdam', resolution: 'PT15M', interval_minutes: 15, unit: 'EUR / MWh',
    generated_at: new Date(generatedAt).toISOString(), available_from: data[0].timestamp,
    available_until: data.at(-1).timestamp, series: [{ id: 'day_ahead_price' }], data,
    attributes: {}, license: LICENSE, deprecated: false };
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers });
}

test('market retains actual EUR/MWh, zero and negative prices, with a complete licensed day', async () => {
  let calls = 0;
  const service = createMarketService({ now: () => REFERENCE, fetchImpl: async url => {
    calls += 1;
    assert.equal(new URL(url).searchParams.get('bzn'), 'NL');
    assert.equal(new URL(url).searchParams.get('start'), '2026-11-14');
    return json(fixture());
  } });
  const result = await service.getDay('2026-11-14');
  assert.equal(result.status, 'available');
  assert.equal(result.intervals.length, 96);
  assert.equal(result.intervals[0].marketEurMWh, -20);
  assert.equal(result.intervals[1].marketEurMWh, 0);
  assert.equal(result.intervals[0].start, '2026-11-13T23:00:00.000Z');
  assert.equal(result.intervals.at(-1).start, '2026-11-14T22:45:00.000Z');
  assert.equal(result.publishedAt, null);
  assert.equal(result.stale, false);
  assert.match(result.source.attribution, /SMARD/);
  result.intervals[0].marketEurMWh = 99_999;
  assert.equal((await service.getDay('2026-11-14')).intervals[0].marketEurMWh, -20);
  assert.equal(calls, 1);
});

test('market coalesces simultaneous requests for the same delivery day', async () => {
  let release;
  let calls = 0;
  const response = new Promise(resolve => { release = resolve; });
  const service = createMarketService({ now: () => REFERENCE, fetchImpl: () => { calls += 1; return response; } });
  const a = service.getDay('2026-11-14');
  const b = service.getDay('2026-11-14');
  assert.equal(calls, 1);
  release(json(fixture()));
  const results = await Promise.all([a, b]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(service.getStatus().inFlight, 0);
});

test('market validates calendar input and the Dutch rolling date boundary before network access', async () => {
  let calls = 0;
  const current = Date.parse('2026-11-13T23:30:00Z'); // Already 14 November in NL.
  const service = createMarketService({ now: () => current, fetchImpl: async () => { calls += 1; return json({}, 404); } });
  for (const date of ['2026-02-30', '2026-13-01', '2026-1-1', '14-11-2026', null, '2026-10-14', '2026-11-16']) {
    await assert.rejects(service.getDay(date), error => error instanceof TypeError || error instanceof RangeError);
  }
  assert.equal(calls, 0);
  assert.equal((await service.getDay('2026-10-15')).status, 'unavailable');
  assert.equal((await service.getDay('2026-11-15')).status, 'not_published');
  assert.equal(calls, 2);
});

test('market accepts 92 and 100 distinct UTC quarter-hours on Dutch DST transition days', async () => {
  const cases = [
    { date: '2026-03-29', start: '2026-03-29T00:00:00+01:00', count: 92, end: '2026-03-29T22:00:00.000Z' },
    { date: '2026-10-25', start: '2026-10-25T00:00:00+02:00', count: 100, end: '2026-10-25T23:00:00.000Z' },
  ];
  for (const item of cases) {
    const current = Date.parse(`${item.date}T12:00:00Z`);
    const service = createMarketService({ now: () => current,
      fetchImpl: async () => json(fixture(item.date, { ...item, generatedAt: current })) });
    const result = await service.getDay(item.date);
    assert.equal(result.status, 'available');
    assert.equal(result.intervals.length, item.count);
    assert.equal(new Set(result.intervals.map(i => i.start)).size, item.count);
    assert.equal(new Date(Date.parse(result.intervals.at(-1).start) + 15 * MINUTE).toISOString(), item.end);
  }
});

test('market rejects incomplete, wrong-zone, unlicensed and malformed prices without numeric coercion', async () => {
  const changes = [
    body => { body.data.pop(); },
    body => { body.data[10].timestamp = body.data[9].timestamp; },
    body => { body.data[0].values.day_ahead_price = null; },
    body => { body.data[0].values.day_ahead_price = '12.5'; },
    body => { body.unit = 'EUR/kWh'; },
    body => { body.bidding_zone = 'DE-LU'; },
    body => { body.license = 'private and internal use only'; },
    body => { body.available_until = '2026-11-15T00:00:00+01:00'; },
    body => { body.data[0].timestamp = '2026-11-14T00:00:00'; },
    body => { body.generated_at = '2026-11-14T13:00:00Z'; },
  ];
  for (const change of changes) {
    const body = fixture();
    change(body);
    const service = createMarketService({ now: () => REFERENCE, fetchImpl: async () => json(body) });
    const result = await service.getDay('2026-11-14');
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.intervals, []);
    assert.equal(service.getStatus().status, 'degraded');
  }
});

test('market distinguishes not-yet-published tomorrow from a missing current delivery day', async () => {
  let calls = 0;
  const service = createMarketService({ now: () => REFERENCE, fetchImpl: async () => { calls += 1; return json({}, 404); } });
  assert.equal((await service.getDay('2026-11-15')).status, 'not_published');
  assert.equal((await service.getDay('2026-11-15')).status, 'not_published');
  assert.equal((await service.getDay('2026-11-14')).status, 'unavailable');
  assert.equal(calls, 2);
});

test('market does not describe a cached unpublished date as tomorrow after Dutch midnight', async () => {
  let current = Date.parse('2026-11-13T22:59:00Z');
  let calls = 0;
  const service = createMarketService({ now: () => current, fetchImpl: async () => { calls += 1; return json({}, 404); } });
  assert.equal((await service.getDay('2026-11-14')).status, 'not_published');
  current += 2 * MINUTE;
  const result = await service.getDay('2026-11-14');
  assert.equal(result.status, 'unavailable');
  assert.doesNotMatch(result.message, /morgen/);
  assert.equal(calls, 1);
});

test('market limits all dates together to two upstream attempts per rolling minute', async () => {
  let current = REFERENCE;
  let calls = 0;
  const service = createMarketService({ now: () => current, fetchImpl: async () => { calls += 1; return json({}, 404); } });
  await service.getDay('2026-11-13');
  await service.getDay('2026-11-14');
  assert.equal((await service.getDay('2026-11-15')).status, 'unavailable');
  assert.equal(calls, 2);
  assert.equal(service.getStatus().lastErrorCode, 'local_rate_limit');
  current += MINUTE + 1;
  assert.equal((await service.getDay('2026-11-15')).status, 'not_published');
  assert.equal(calls, 3);
});

test('market outage serves only the same cached day, explicitly stale, and cannot invent another day', async () => {
  let current = REFERENCE;
  let calls = 0;
  const service = createMarketService({ now: () => current, fetchImpl: async () => {
    calls += 1;
    if (calls > 1) throw new Error('upstream diagnostic must remain private');
    return json(fixture());
  } });
  const initial = await service.getDay('2026-11-14');
  current += 16 * MINUTE;
  const stale = await service.getDay('2026-11-14');
  assert.equal(stale.status, 'available');
  assert.equal(stale.stale, true);
  assert.equal(stale.fetchedAt, initial.fetchedAt);
  assert.deepEqual(stale.intervals, initial.intervals);
  const missing = await service.getDay('2026-11-15');
  assert.equal(missing.status, 'unavailable');
  assert.deepEqual(missing.intervals, []);
  assert.doesNotMatch(JSON.stringify(service.getStatus()), /diagnostic/);
});

test('market honors upstream Retry-After across different delivery dates', async () => {
  let current = REFERENCE;
  let calls = 0;
  const service = createMarketService({ now: () => current, fetchImpl: async () => {
    calls += 1;
    return calls === 1 ? json({}, 429, { 'Retry-After': '600' }) : json(fixture('2026-11-14', { generatedAt: current }));
  } });
  await service.getDay('2026-11-13');
  current += 9 * MINUTE;
  assert.equal((await service.getDay('2026-11-14')).status, 'unavailable');
  assert.equal(calls, 1);
  current += MINUTE + 1;
  assert.equal((await service.getDay('2026-11-14')).status, 'available');
  assert.equal(calls, 2);
});
