/**
 * Deterministic educational energy calculations.
 * Rates are EUR/kWh; energy is kWh; percentages are 0..100.
 * No function fetches data, invents future tariffs, or models legal net metering.
 * See docs/MODEL.md for the deliberately limited scenario assumptions.
 */

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function number(value, name, { min = -Infinity, max = Infinity, positive = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  if (value < min || value > max || (positive && value <= 0)) {
    throw new RangeError(`${name} is outside its permitted range`);
  }
  return value;
}

function exportTerms(input) {
  const exportRate = number(input.exportRate, 'exportRate');
  const exportFee = number(input.exportFee ?? 0, 'exportFee', { min: 0 });
  return { exportRate, exportFee, netExportRate: exportRate - exportFee };
}

/**
 * Convert a market price to a contract-specific marginal import rate.
 * Dynamic markup/energyTax are before VAT; vat is a fraction (0.21, not 21).
 * Fixed importRate and explicit exportRate/exportFee are already on the
 * consumer's applicable final price basis. No tax treatment of export is guessed.
 */
export function priceForContract(marketEurMWh, contract) {
  record(contract, 'contract');
  if (!['dynamic', 'fixed'].includes(contract.type)) {
    throw new RangeError('contract.type must be dynamic or fixed');
  }
  const { netExportRate } = exportTerms(contract);
  let importRate;
  if (contract.type === 'fixed') {
    importRate = number(contract.importRate, 'importRate');
  } else {
    const market = number(marketEurMWh, 'marketEurMWh');
    const markup = number(contract.markup ?? 0, 'markup');
    const energyTax = number(contract.energyTax ?? 0, 'energyTax', { min: 0 });
    const vat = number(contract.vat ?? 0, 'vat', { min: 0, max: 1 });
    importRate = (market / 1000 + markup + energyTax) * (1 + vat);
  }
  return { importRate, exportNet: netExportRate };
}

/**
 * Annual post-net-metering illustration with linear export costs.
 * selfUsePct means direct consumption as a percentage of PV generation.
 * Direct use is capped by total household use as well as available generation.
 */
export function calculate2027(input) {
  record(input, 'input');
  const annualUse = number(input.annualUse, 'annualUse', { min: 0 });
  const annualSolar = number(input.annualSolar, 'annualSolar', { min: 0 });
  const selfUsePct = number(input.selfUsePct, 'selfUsePct', { min: 0, max: 100 });
  const importRate = number(input.importRate, 'importRate');
  const { netExportRate } = exportTerms(input);
  const directUse = Math.min(annualUse, annualSolar * selfUsePct / 100);
  const gridImport = annualUse - directUse;
  const gridExport = annualSolar - directUse;
  return {
    directUse,
    gridImport,
    gridExport,
    netExportRate,
    annualVariableCost: gridImport * importRate - gridExport * netExportRate,
  };
}

export function compareSelfUse(baseInput, targetPct) {
  record(baseInput, 'baseInput');
  number(targetPct, 'targetPct', { min: 0, max: 100 });
  const baseline = calculate2027(baseInput);
  const optimized = calculate2027({ ...baseInput, selfUsePct: targetPct });
  return {
    baseline,
    optimized,
    annualSaving: baseline.annualVariableCost - optimized.annualVariableCost,
  };
}

/**
 * Transparent annual PV-storage scenario, NOT a dispatch/physics simulation.
 * extraSolarStored is annual PV input to storage, before round-trip losses.
 * It is capped at PV left after the assumed direct use. When annualUse is
 * provided, useful output is also capped by the remaining annual grid demand.
 * Annual totals cannot establish whether the energy is available at the right time.
 */
export function batteryScenario(input) {
  record(input, 'input');
  const annualSolar = number(input.annualSolar, 'annualSolar', { min: 0 });
  const selfUsePct = number(input.selfUsePct, 'selfUsePct', { min: 0, max: 100 });
  const annualUse = input.annualUse === undefined ? null
    : number(input.annualUse, 'annualUse', { min: 0 });
  const requestedSolarStored = number(input.extraSolarStored, 'extraSolarStored', { min: 0 });
  const efficiency = number(input.roundTripEfficiency, 'roundTripEfficiency', { positive: true, max: 1 });
  const importRate = number(input.importRate, 'importRate');
  const investment = number(input.investment, 'investment', { min: 0 });
  const annualCosts = number(input.annualCosts ?? 0, 'annualCosts', { min: 0 });
  const lifeYears = number(input.lifeYears, 'lifeYears', { positive: true });
  const { netExportRate } = exportTerms(input);
  const directUse = Math.min(annualUse ?? Infinity, annualSolar * selfUsePct / 100);
  const availableSolar = annualSolar - directUse;
  const remainingImport = annualUse === null ? Infinity : annualUse - directUse;
  const solarStored = Math.min(requestedSolarStored, availableSolar, remainingImport / efficiency);
  const usefulOutput = Math.min(solarStored * efficiency, remainingImport);
  const annualGrossBenefit = usefulOutput * importRate - solarStored * netExportRate;
  const annualNetBenefit = annualGrossBenefit - annualCosts;
  const simplePayback = annualNetBenefit > 0 ? investment / annualNetBenefit : null;
  return {
    requestedSolarStored,
    solarStored,
    capped: solarStored < requestedSolarStored,
    usefulOutput,
    annualGrossBenefit,
    annualNetBenefit,
    simplePayback,
    paybackWithinLife: simplePayback !== null && simplePayback <= lifeYears,
    breakEvenCost: Math.max(0, annualNetBenefit * lifeYears),
  };
}

const amsterdamClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function localTime(milliseconds) {
  const p = Object.fromEntries(amsterdamClock.formatToParts(milliseconds).map(({ type, value }) => [type, value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour) + Number(p.minute) / 60 + Number(p.second) / 3600
      + ((milliseconds % 1000 + 1000) % 1000) / 3_600_000,
  };
}

function timestamp(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new TypeError(`${name} must be an ISO timestamp with an explicit timezone`);
  }
  const ms = Date.parse(value);
  const day = value.slice(0, 10);
  const dayMs = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(ms) || !Number.isFinite(dayMs)
      || new Date(dayMs).toISOString().slice(0, 10) !== day
      || Number(value.slice(11, 13)) > 23) {
    throw new RangeError(`${name} is not a valid timestamp`);
  }
  return ms;
}

/**
 * Find an uninterrupted constant-power appliance window on one Amsterdam day.
 * Slots must be sorted, complete, equally spaced, and contain at least 2 starts.
 * The final slot has the same duration inferred from those starts.
 * solarKwh is available SURPLUS per interval, after other household demand.
 * cost/gridCost are import costs only: foregone export income is not included.
 * Returns null when no window fits, or when energyKwh is zero.
 */
export function findBestWindow(slots, options) {
  if (!Array.isArray(slots)) throw new TypeError('slots must be an array');
  record(options, 'options');
  const durationHours = number(options.durationHours, 'durationHours', { positive: true });
  const energyKwh = number(options.energyKwh, 'energyKwh', { min: 0 });
  const startHour = number(options.startHour ?? 0, 'startHour', { min: 0, max: 24 });
  const endHour = number(options.endHour ?? 24, 'endHour', { min: 0, max: 24 });
  const goal = options.goal ?? 'cost';
  if (startHour >= endHour) throw new RangeError('startHour must be before endHour on the same local day');
  if (!['cost', 'solar'].includes(goal)) throw new RangeError('goal must be cost or solar');
  if (slots.length === 0) return null;
  if (slots.length < 2) throw new RangeError('at least two slot starts are required to determine interval duration');
  const normalized = slots.map((slot, i) => {
    record(slot, `slots[${i}]`);
    return {
      start: slot.start,
      ms: timestamp(slot.start, `slots[${i}].start`),
      price: number(slot.price, `slots[${i}].price`),
      solarKwh: number(slot.solarKwh ?? 0, `slots[${i}].solarKwh`, { min: 0 }),
    };
  });
  const intervalMs = normalized[1].ms - normalized[0].ms;
  if (intervalMs <= 0) throw new RangeError('slot starts must be strictly increasing');
  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i].ms - normalized[i - 1].ms !== intervalMs) {
      throw new RangeError('slots must be complete and equally spaced; gaps, duplicates and mixed resolutions are not supported');
    }
  }
  const exactCount = durationHours * 3_600_000 / intervalMs;
  const slotCount = Math.round(exactCount);
  if (slotCount < 1 || Math.abs(exactCount - slotCount) > 1e-9) {
    throw new RangeError('durationHours must cover a whole number of price intervals');
  }
  if (slotCount > normalized.length || energyKwh === 0) return null;
  const energyPerSlot = energyKwh / slotCount;
  const prefixes = { cost: [0], solar: [0], price: [0], unavailable: [0] };
  for (const slot of normalized) {
    const localStart = localTime(slot.ms);
    const localLast = localTime(slot.ms + intervalMs - 1);
    slot.localDate = localStart.date;
    const allowed = localStart.date === localLast.date
      && localStart.hour >= startHour && localStart.hour < endHour
      && localLast.hour >= startHour && localLast.hour < endHour;
    const solar = Math.min(energyPerSlot, slot.solarKwh);
    prefixes.cost.push(prefixes.cost.at(-1) + (energyPerSlot - solar) * slot.price);
    prefixes.solar.push(prefixes.solar.at(-1) + solar);
    prefixes.price.push(prefixes.price.at(-1) + slot.price);
    prefixes.unavailable.push(prefixes.unavailable.at(-1) + (allowed ? 0 : 1));
  }
  let best = null;
  const eps = 1e-9;
  for (let i = 0; i + slotCount <= normalized.length; i += 1) {
    const j = i + slotCount;
    if (prefixes.unavailable[j] !== prefixes.unavailable[i]
      || normalized[i].localDate !== normalized[j - 1].localDate) continue;
    const solarKwh = Math.min(energyKwh, Math.max(0, prefixes.solar[j] - prefixes.solar[i]));
    const gridCost = prefixes.cost[j] - prefixes.cost[i];
    const candidate = {
      start: normalized[i].start,
      end: new Date(normalized[j - 1].ms + intervalMs).toISOString(),
      durationHours,
      energyKwh,
      solarKwh,
      gridKwh: Math.max(0, energyKwh - solarKwh),
      gridCost,
      cost: gridCost,
      averagePrice: (prefixes.price[j] - prefixes.price[i]) / slotCount,
      slotCount,
      intervalMinutes: intervalMs / 60_000,
      goal,
    };
    const better = !best || (goal === 'solar'
      ? solarKwh > best.solarKwh + eps || (Math.abs(solarKwh - best.solarKwh) <= eps && gridCost < best.gridCost - eps)
      : gridCost < best.gridCost - eps || (Math.abs(gridCost - best.gridCost) <= eps && solarKwh > best.solarKwh + eps));
    if (better) best = candidate;
  }
  return best;
}
