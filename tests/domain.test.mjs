import test from 'node:test';
import assert from 'node:assert/strict';
import { priceForContract, calculate2027, compareSelfUse, batteryScenario, findBestWindow } from '../src/domain.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const household = { annualUse: 4200, annualSolar: 4000, selfUsePct: 30, importRate: 0.30, exportRate: 0.10, exportFee: 0.05 };
const battery = { annualSolar: 4000, selfUsePct: 30, extraSolarStored: 1000, roundTripEfficiency: 0.9, importRate: 0.30, exportRate: 0.10, exportFee: 0.05, investment: 1000, annualCosts: 20, lifeYears: 10 };

function slotsFrom(start, count, minutes, price = 0.30) {
  return Array.from({ length: count }, (_, i) => ({ start: new Date(Date.parse(start) + i * minutes * 60_000).toISOString(), price }));
}

test('dynamic pricing converts MWh, adds pre-VAT components, and keeps export explicit', () => {
  const actual = priceForContract(100, { type: 'dynamic', markup: 0.02, energyTax: 0.10, vat: 0.21, exportRate: 0.08, exportFee: 0.05 });
  close(actual.importRate, 0.2662);
  close(actual.exportNet, 0.03);
  close(priceForContract(-100, { type: 'dynamic', energyTax: 0.10, vat: 0.21, exportRate: 0 }).importRate, 0);
  close(priceForContract(-300, { type: 'dynamic', markup: 0.02, energyTax: 0.10, vat: 0.21, exportRate: -0.1 }).importRate, -0.2178);
});

test('a fixed contract is independent of the wholesale market', () => {
  assert.deepEqual(priceForContract(null, { type: 'fixed', importRate: 0.30, exportRate: 0.10, exportFee: 0.05 }), { importRate: 0.30, exportNet: 0.05 });
});

test('2027 illustration reconciles flows and the hand-calculated 30 to 70 percent example', () => {
  const result = compareSelfUse(household, 70);
  assert.deepEqual(result.baseline, { directUse: 1200, gridImport: 3000, gridExport: 2800, netExportRate: 0.05, annualVariableCost: 760 });
  assert.equal(result.optimized.directUse, 2800);
  assert.equal(result.optimized.gridImport, 1400);
  assert.equal(result.optimized.gridExport, 1200);
  assert.equal(result.optimized.annualVariableCost, 360);
  assert.equal(result.annualSaving, 400);
  assert.equal(compareSelfUse({ ...household, selfUsePct: 70 }, 30).annualSaving, -400);
});

test('direct consumption cannot exceed household demand or generation', () => {
  const capped = calculate2027({ ...household, annualUse: 500, selfUsePct: 70 });
  assert.equal(capped.directUse, 500);
  assert.equal(capped.gridImport, 0);
  assert.equal(capped.gridExport, 3500);
  close(capped.annualVariableCost, -175);
  const noSolar = calculate2027({ ...household, annualSolar: 0 });
  assert.equal(noSolar.directUse, 0);
  assert.equal(noSolar.gridExport, 0);
  assert.equal(noSolar.annualVariableCost, 1260);
});

test('negative net export is a cost, and negative import prices remain valid', () => {
  const exportCost = calculate2027({ ...household, exportRate: 0.02, exportFee: 0.07 });
  close(exportCost.netExportRate, -0.05);
  close(exportCost.annualVariableCost, 1040);
  close(calculate2027({ ...household, annualSolar: 0, annualUse: 1, importRate: -0.02 }).annualVariableCost, -0.02);
});

test('battery opportunity cost uses energy stored before loss; imports avoided use output after loss', () => {
  const result = batteryScenario(battery);
  assert.equal(result.solarStored, 1000);
  assert.equal(result.usefulOutput, 900);
  close(result.annualGrossBenefit, 220);
  close(result.annualNetBenefit, 200);
  close(result.simplePayback, 5);
  close(result.breakEvenCost, 2000);
  assert.equal(result.paybackWithinLife, true);
});

test('storage is capped by remaining annual PV and unprofitable scenarios do not invent payback', () => {
  const capped = batteryScenario({ ...battery, extraSolarStored: 5000, investment: 10000 });
  assert.equal(capped.solarStored, 2800);
  assert.equal(capped.usefulOutput, 2520);
  assert.equal(capped.paybackWithinLife, false);
  const loss = batteryScenario({ ...battery, exportRate: 0.35, exportFee: 0 });
  close(loss.annualNetBenefit, -100);
  assert.equal(loss.simplePayback, null);
  assert.equal(loss.breakEvenCost, 0);
  close(batteryScenario({ ...battery, exportRate: 0, exportFee: 0.05 }).annualGrossBenefit, 320);
  assert.equal(batteryScenario({ ...battery, annualSolar: 0 }).usefulOutput, 0);
});

test('optional annual demand caps useful battery output and shares the direct-use cap', () => {
  const limited = batteryScenario({ ...battery, annualUse: 1500 });
  assert.equal(limited.requestedSolarStored, 1000);
  assert.equal(limited.capped, true);
  close(limited.solarStored, 300 / 0.9);
  close(limited.usefulOutput, 300);
  close(limited.annualGrossBenefit, 90 - (300 / 0.9) * 0.05);
  const noRemainingDemand = batteryScenario({ ...battery, annualUse: 500, selfUsePct: 70 });
  assert.equal(noRemainingDemand.solarStored, 0);
  assert.equal(noRemainingDemand.usefulOutput, 0);
  assert.equal(noRemainingDemand.capped, true);
  assert.equal(batteryScenario({ ...battery, annualUse: 0 }).usefulOutput, 0);
  assert.throws(() => batteryScenario({ ...battery, annualUse: -1 }), RangeError);
});

test('numeric validation rejects missing, non-finite, negative energy and percentage-unit mistakes', () => {
  for (const invalid of [NaN, Infinity, '4200', -1]) {
    assert.throws(() => calculate2027({ ...household, annualUse: invalid }));
  }
  assert.throws(() => calculate2027({ ...household, selfUsePct: 101 }), RangeError);
  assert.throws(() => compareSelfUse(household, -1), RangeError);
  assert.throws(() => calculate2027({ ...household, exportFee: -0.01 }), RangeError);
  assert.throws(() => priceForContract(100, { type: 'dynamic', exportRate: 0, vat: 21 }), RangeError);
  assert.throws(() => priceForContract(100, { type: 'unknown', exportRate: 0 }), RangeError);
  assert.throws(() => priceForContract(100, { type: 'dynamic' }), TypeError);
  assert.throws(() => batteryScenario({ ...battery, roundTripEfficiency: 0 }), RangeError);
  assert.throws(() => batteryScenario({ ...battery, roundTripEfficiency: 1.1 }), RangeError);
  assert.throws(() => batteryScenario({ ...battery, lifeYears: 0 }), RangeError);
});

test('planner chooses consecutive whole intervals and reports actual elapsed duration', () => {
  const slots = slotsFrom('2026-11-12T08:00:00+01:00', 4, 60);
  [0.30, 0.10, 0.20, 0.40].forEach((price, i) => { slots[i].price = price; });
  const result = findBestWindow(slots, { durationHours: 2, energyKwh: 2, startHour: 8, endHour: 12, goal: 'cost' });
  assert.equal(result.start, '2026-11-12T08:00:00.000Z'); // 09:00 Amsterdam
  assert.equal(result.end, '2026-11-12T10:00:00.000Z');
  close(result.gridCost, 0.30);
  assert.equal(Date.parse(result.end) - Date.parse(result.start), 2 * 3_600_000);
  assert.equal(result.slotCount, 2);
  assert.equal(findBestWindow(slots, { durationHours: 3, energyKwh: 2, startHour: 10, endHour: 12 }), null);
  assert.equal(findBestWindow(slots, { durationHours: 1, energyKwh: 0 }), null);
});

test('solar and import-cost objectives differ; solar is capped in each interval', () => {
  const slots = slotsFrom('2026-11-12T08:00:00+01:00', 4, 60);
  slots.forEach((slot, i) => { slot.price = i < 2 ? -0.20 : 0.40; slot.solarKwh = i < 2 ? 0 : 2; });
  const options = { durationHours: 2, energyKwh: 2, startHour: 8, endHour: 12 };
  const cost = findBestWindow(slots, { ...options, goal: 'cost' });
  const solar = findBestWindow(slots, { ...options, goal: 'solar' });
  close(cost.gridCost, -0.40);
  assert.equal(cost.solarKwh, 0);
  assert.equal(solar.solarKwh, 2);
  assert.equal(solar.gridKwh, 0);
  close(solar.gridCost, 0);
  const uneven = slotsFrom('2026-11-12T12:00:00+01:00', 2, 60);
  uneven[0].solarKwh = 2;
  const capped = findBestWindow(uneven, { durationHours: 2, energyKwh: 2, goal: 'solar' });
  assert.equal(capped.solarKwh, 1);
  assert.equal(capped.gridKwh, 1);
  close(capped.gridCost, 0.30);
});

test('planner refuses incomplete, duplicated, malformed or ambiguous interval data', () => {
  const complete = slotsFrom('2026-11-12T00:00:00+01:00', 4, 15);
  const options = { durationHours: 1, energyKwh: 1 };
  assert.throws(() => findBestWindow([complete[0], complete[1], complete[3]], options), /equally spaced/);
  assert.throws(() => findBestWindow([complete[0], complete[0]], options), /increasing/);
  assert.throws(() => findBestWindow([complete[0]], options), /two slot/);
  assert.throws(() => findBestWindow(complete, { ...options, durationHours: 0.3 }), /whole number/);
  assert.throws(() => findBestWindow(complete, { ...options, startHour: 20, endHour: 8 }), RangeError);
  assert.throws(() => findBestWindow(complete.map(slot => ({ ...slot, price: NaN })), options), TypeError);
  assert.throws(() => findBestWindow([{ ...complete[0], start: '2026-11-12T00:00:00' }, complete[1]], options), /timezone/);
  assert.throws(() => findBestWindow([{ ...complete[0], start: '2026-02-30T00:00:00Z' }, complete[1]], options), /valid timestamp/);
  assert.equal(findBestWindow([], options), null);
});

test('spring and autumn clock changes use real durations and Amsterdam planning hours', () => {
  const spring = slotsFrom('2026-03-28T23:00:00Z', 92, 15);
  const springWindow = findBestWindow(spring, { durationHours: 2, energyKwh: 2, startHour: 1, endHour: 4 });
  assert.equal(springWindow.start, '2026-03-29T00:00:00.000Z');
  assert.equal(springWindow.end, '2026-03-29T02:00:00.000Z');
  assert.equal(springWindow.slotCount, 8);
  const autumn = slotsFrom('2026-10-24T22:00:00Z', 100, 15);
  const autumnWindow = findBestWindow(autumn, { durationHours: 2, energyKwh: 2, startHour: 2, endHour: 3 });
  assert.equal(autumnWindow.start, '2026-10-25T00:00:00.000Z');
  assert.equal(autumnWindow.end, '2026-10-25T02:00:00.000Z');
  assert.equal(autumnWindow.slotCount, 8);
});
