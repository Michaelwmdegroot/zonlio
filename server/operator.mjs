/** Public company details confirmed by the owner on 14 November 2026. */
export const OPERATOR = Object.freeze({
  name: 'NIVO Groep Holland BV', kvk: '95227768', street: 'Lireweg 52',
  postcode: '2153 PH', city: 'Nieuw-Vennep', country: 'Nederland',
  email: 'info@zonlio.nl', brand: 'Zonlio',
});
export const OPERATOR_VERSION = '2026-11-14-nivo-v1';
const canonical = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function operatorConfiguration(env = process.env) {
  const matches = !env.LEAD_CONTROLLER_NAME || canonical(env.LEAD_CONTROLLER_NAME) === canonical(OPERATOR.name);
  const contactMatches = !env.LEAD_CONTROLLER_EMAIL || env.LEAD_CONTROLLER_EMAIL.trim().toLowerCase() === OPERATOR.email;
  return { controller: OPERATOR, matches: matches && contactMatches,
    confirmed: env.LEAD_CONTROLLER_CONFIRMED === 'true' && matches && contactMatches };
}
