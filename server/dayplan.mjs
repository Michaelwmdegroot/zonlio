import { createHash } from 'node:crypto';
import { normalizePrices, hourlySlots, futurePriceSlots, localDate, localHour, addDays } from '../src/api.mjs';
import { findBestWindow, priceForContract } from '../src/domain.mjs';
import { devices } from '../src/data.mjs';
import { cleanEnergyProfile } from '../src/member-schema.mjs';
export const DAYPLAN_VERSION = 'dagplan-1';
export function dueEdition(now) {
  const hour = localHour(now); const day = localDate(now);
  if (hour >= 18 && hour < 21) return { edition:'evening', date:addDays(day,1) };
  if (hour >= 7 && hour < 9) return { edition:'morning', date:day };
  return null;
}
export function makeDayPlan(raw, input, now = Date.now()) {
  const profile = cleanEnergyProfile(input);
  if (!profile.devices.length) return {status:'no_devices'};
  const prices = normalizePrices(raw);
  if (prices.status !== 'available' || prices.stale || !prices.contiguous) return {status:'unavailable'};
  // A full local delivery day is required, including Dutch DST days.
  const all = prices.intervals;
  const first = Date.parse(all[0].start), last = Date.parse(all.at(-1).start) + all.at(-1).durationMinutes*60000;
  if (localDate(first) !== prices.date || localHour(first) !== 0 || localDate(last) !== addDays(prices.date,1) || localHour(last) !== 0 || all.some(s=>localDate(s.start)!==prices.date)) return {status:'unavailable'};
  const contract = profile.contract;
  let slots = contract.type === 'dynamic' && contract.resolution === 'hour' ? hourlySlots(all) : all;
  slots = futurePriceSlots(slots,prices.date,now).map(slot=>({ ...slot,
    price:contract.type === 'unknown' ? slot.market/1000 : priceForContract(slot.market,{...contract,exportRate:0,exportFee:0}).importRate, solarKwh:0 }));
  const plans = [];
  for (const id of profile.devices) {
    const device = devices[id]; let best = null;
    if (slots.length >= 2) best = findBestWindow(slots,{durationHours:device.durationHours,energyKwh:device.energyKwh,startHour:profile.startHour,endHour:profile.endHour,goal:'cost'});
    if (best) plans.push({device:id,name:device.name,start:best.start,end:best.end,cost:best.gridCost,energyKwh:device.energyKwh});
  }
  if (!plans.length) return {status:'no_window'};
  return {status:'available',version:DAYPLAN_VERSION,date:prices.date,generatedAt:new Date(now).toISOString(),
    validUntil:new Date(Math.min(...plans.map(p=>Date.parse(p.start)))).toISOString(),
    priceBasis:contract.type === 'unknown'?'market':contract.type === 'fixed'?'fixed':'contract',
    basisLabel:contract.type === 'unknown'?'Alleen beurskosten, zonder belasting en leverancierskosten':contract.type === 'fixed'?'Vast ingevoerd tarief: elk passend uur kost evenveel':'Afnamekosten volgens jouw bevestigde contractinvoer',
    source:{name:raw.source?.name||'Energy-Charts',attribution:raw.source?.attribution||'Energy-Charts (Fraunhofer ISE); Bundesnetzagentur | SMARD.de',license:raw.source?.license||'CC BY 4.0',fetchedAt:raw.fetchedAt||null},
    sourceHash:createHash('sha256').update(JSON.stringify(raw.intervals)).digest('hex'),
    profileHash:createHash('sha256').update(JSON.stringify(profile)).digest('hex'),plans,
    limitations:'Apparaatverbruik is een aanname. Je stelt zelf je timer in. Geen zonneprognose, huishoudoptimalisatie of gerealiseerde besparing.'};
}
