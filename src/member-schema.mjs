/** Shared, strictly allowlisted data for a voluntarily saved energy profile. No contact details. */
export const DAYMAIL_POLICY_VERSION = '2026-11-14-dagplan-v1';
export const DAYMAIL_TEXT = 'Ik ontvang het door mij gekozen Zonlio-dagplan van NIVO Groep Holland BV per e-mail. Dit is geen toestemming voor verkooptelefoontjes of aanbiedingen. Ik kan altijd pauzeren of afmelden.';
export const ACCOUNT_POLICY_VERSION = '2026-11-14-mijn-v1';
export const MEMBER_DEVICES = Object.freeze({ washing: 'Wasmachine', dishwasher: 'Vaatwasser', car: 'Elektrische auto' });
export const PROFILE_LIMITS = Object.freeze({ annualUse:[0,100000], annualSolar:[0,100000], selfUsePct:[0,100], targetPct:[0,100], importRate:[-1,5], exportRate:[-1,5], exportFee:[0,5], investment:[0,100000], extraSolarStored:[0,100000], roundTripEfficiency:[.1,1], annualCosts:[0,10000], lifeYears:[1,50] });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function cleanEnergyProfile(value) {
  if (!keys(value, ['scenario','contract','devices','startHour','endHour'])) throw new TypeError('Onbekende profielvelden.');
  const result = { scenario:{}, contract:{type:'unknown'}, devices:[], startHour:8, endHour:22 };
  if (value.scenario !== undefined) {
    if (!keys(value.scenario, Object.keys(PROFILE_LIMITS))) throw new TypeError('Ongeldig rekenscenario.');
    for (const [key, val] of Object.entries(value.scenario)) {
      if (!number(val,...PROFILE_LIMITS[key])) throw new TypeError('Controleer de rekenwaarden.');
      result.scenario[key] = val;
    }
  }
  if (value.contract !== undefined) {
    const c = value.contract;
    if (!keys(c,['type','confirmed','resolution','importRate','markup','energyTax','vat']) || !['unknown','fixed','dynamic'].includes(c.type)) throw new TypeError('Ongeldig contract.');
    if (c.type !== 'unknown') {
      if (c.confirmed !== true) throw new TypeError('Controleer eerst je contracttarieven.');
      if (c.type === 'fixed') {
        if (!number(c.importRate,-1,5)) throw new TypeError('Vul je volledige afnametarief in.');
        result.contract = { type:'fixed', confirmed:true, importRate:c.importRate, resolution:'hour' };
      } else {
        if (!['hour','quarter'].includes(c.resolution) || !number(c.markup,-1,5) || !number(c.energyTax,0,5) || !number(c.vat,0,1)) throw new TypeError('Controleer opslag, belasting, btw en afrekenperiode.');
        result.contract = { type:'dynamic', confirmed:true, resolution:c.resolution, markup:c.markup, energyTax:c.energyTax, vat:c.vat };
      }
    }
  }
  if (value.devices !== undefined) {
    if (!Array.isArray(value.devices) || value.devices.length > 3 || new Set(value.devices).size !== value.devices.length || value.devices.some(d => !Object.hasOwn(MEMBER_DEVICES,d))) throw new TypeError('Kies maximaal drie ondersteunde apparaten.');
    result.devices = [...value.devices];
  }
  for (const field of ['startHour','endHour']) if (value[field] !== undefined) {
    if (!Number.isInteger(value[field]) || !number(value[field],field==='startHour'?0:1,field==='startHour'?23:24)) throw new TypeError('Kies geldige hele uren.');
    result[field] = value[field];
  }
  if (result.endHour <= result.startHour) throw new TypeError('De eindtijd moet later zijn dan de starttijd.');
  return result;
}
export function cleanSubscription(value) {
  if (!keys(value,['edition','status']) || !['evening','morning'].includes(value.edition) || !['active','paused','unsubscribed'].includes(value.status)) throw new TypeError('Kies een geldige editie en status.');
  return {edition:value.edition,status:value.status};
}
