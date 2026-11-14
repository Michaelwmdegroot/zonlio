/** Shared public field contract. No credentials, personal data or business scoring. */
export const HOUSING_CONSENT_VERSION = '2026-11-14-housing-v2-nivo';
export const LEAD_STATUS_LABELS = Object.freeze({
  new: 'Nieuw', assigned: 'Toegewezen', attempted: 'Contactpoging', contacted: 'Bereikt',
  qualified: 'Gekwalificeerd', appointment: 'Afspraak', quoted: 'Offerte',
  won: 'Gewonnen', lost: 'Verloren', closed: 'Gesloten', withdrawn: 'Ingetrokken',
});
export const CLOSED_STATUSES = Object.freeze(['won', 'lost', 'closed', 'withdrawn']);
export const HOUSING_TOPICS = Object.freeze({
  battery: 'Past een thuisbatterij bij mijn woning?', solar: 'Mijn zonnepanelen en eigen verbruik',
  charging: 'Een laadvoorziening bij mijn woning', heatpump: 'Verwarming en verduurzaming', other: 'Een andere woningvraag',
});
export const CONTACT_PREFERENCES = Object.freeze({
  any: 'Geen voorkeur', morning: 'Ochtend', afternoon: 'Middag', evening: 'Avond',
});
const clean = (value, max, required = false) => typeof value === 'string'
  && value.trim().length <= max && (!required || value.trim().length > 0)
  && !/[\u0000-\u001f\u007f]/.test(value);

export function housingFieldErrors({ housing, postcode, contactPreference, topic } = {}) {
  const errors = {};
  if (!housing || typeof housing !== 'object' || Array.isArray(housing)
    || Object.keys(housing).some(key => !['street', 'houseNumber', 'addition', 'city'].includes(key))) {
    errors.housing = 'Vul het adres van de woning in.';
  }
  const address = housing && typeof housing === 'object' ? housing : {};
  if (!clean(address.street, 120, true)) errors.street = 'Vul een straatnaam in (maximaal 120 tekens).';
  if (typeof address.houseNumber !== 'string' || !/^[1-9]\d{0,4}$/.test(address.houseNumber.trim())) errors.houseNumber = 'Vul een huisnummer in (1–99999).';
  if (address.addition !== undefined && !clean(address.addition, 20)) errors.addition = 'Gebruik maximaal 20 tekens voor de toevoeging.';
  if (!clean(address.city, 100, true)) errors.city = 'Vul een woonplaats in (maximaal 100 tekens).';
  if (typeof postcode !== 'string' || !/^[1-9]\d{3}[A-Z]{2}$/.test(postcode.replace(/\s/g, '').toUpperCase())) errors.postcode = 'Vul een volledige Nederlandse postcode in.';
  if (!Object.hasOwn(CONTACT_PREFERENCES, contactPreference || '')) errors.contactPreference = 'Kies een voorkeursmoment.';
  if (!Object.hasOwn(HOUSING_TOPICS, topic || '')) errors.topic = 'Kies een onderwerp voor het woningadvies.';
  return errors;
}

export function followUpFieldErrors(value) {
  const errors = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['owner', 'nextAction', 'nextActionOn'].includes(key))) return { followUp: 'Ongeldige opvolggegevens.' };
  if (!clean(value.owner, 120)) errors.owner = 'Gebruik maximaal 120 tekens voor de verantwoordelijke.';
  if (!clean(value.nextAction, 500)) errors.nextAction = 'Gebruik maximaal 500 tekens voor de volgende actie.';
  const day = value.nextActionOn;
  if (typeof day !== 'string' || (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day)
    || !Number.isFinite(Date.parse(day + 'T12:00:00Z')) || new Date(day + 'T12:00:00Z').toISOString().slice(0, 10) !== day))) errors.nextActionOn = 'Kies een geldige kalenderdatum.';
  if (day && (!value.nextAction?.trim() || !value.owner?.trim())) errors.nextAction = 'Een geplande actie heeft een verantwoordelijke en omschrijving nodig.';
  return errors;
}
