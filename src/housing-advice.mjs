import { api } from './api.mjs';
import { HOUSING_TOPICS, CONTACT_PREFERENCES, housingFieldErrors } from './advice-schema.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const profileKeys = ['annualUse','annualSolar','selfUsePct','targetPct','importRate','exportRate','exportFee','investment','extraSolarStored','roundTripEfficiency','annualCosts','lifeYears'];
const field = (key, label, attrs = '', optional = false) => `<div class="field"><label for="housing-${key}">${label}${optional ? ' <span class="optional">(optioneel)</span>' : ''}</label><input id="housing-${key}" name="${key}" ${attrs} ${optional ? '' : 'required'} aria-describedby="housing-error-${key}"><small class="field-error" id="housing-error-${key}" data-error="${key}"></small></div>`;

/** Contact data stay only in this open form until a deliberate final submission. */
export function openHousingAdvice({ config, profile, sourcePath, summary, showDialog, onOpened = () => {}, onGeneral }) {
  if (!config?.housingAdviceEnabled || typeof config.housingContactText !== 'string') return false;
  const receiver = config.controller.name;
  const snapshot = Object.fromEntries(profileKeys.filter(key => Number.isFinite(profile?.[key])).map(key => [key, profile[key]]));
  const initialTopic = sourcePath === 'batterij' ? 'battery' : sourcePath === '2027' ? 'solar' : 'other';
  const state = { step: 0, pending: false, token: null, tokenPromise: null, requestId: crypto.randomUUID(), lastPayload: null };
  onOpened();
  showDialog(`<span class="badge blue">Vrijblijvend woningadvies</span><h2 id="dialog-title">Van inzicht naar jouw woning.</h2>
    <p class="dialog-text">Bespreek je vraag met ${esc(receiver)}. Jij bepaalt wat je deelt.</p>
    <ol class="advice-steps" aria-label="Voortgang"><li aria-current="step">1. Woning</li><li>2. Contact</li><li>3. Controle</li></ol>
    <div class="lead-snapshot"><span>Jouw vertrekpunt</span><strong>${esc(summary)}</strong><small>Rekenscenario, geen offerte of gegarandeerde besparing.</small></div>
    <form id="housing-form" novalidate>
      <section data-step="0" aria-labelledby="housing-step-0"><h3 id="housing-step-0" tabindex="-1">Om welke woning gaat het?</h3>
        <p class="mini-note">Je adres is bedoeld voor de voorbereiding van woninggericht advies. Alleen een algemene vraag? <button type="button" class="button-text" data-general>Stel je vraag zonder volledig adres</button>.</p>
        <div class="field"><label for="housing-topic">Waar wil je over praten?</label><select name="topic" id="housing-topic">${Object.entries(HOUSING_TOPICS).map(([key, label]) => `<option value="${key}" ${key === initialTopic ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><small class="field-error" data-error="topic"></small></div>
        <div class="form-grid">${field('postcode','Postcode','autocomplete="postal-code" maxlength="7" placeholder="1234 AB"')}${field('houseNumber','Huisnummer','inputmode="numeric" maxlength="5"')}</div>
        <div class="form-grid">${field('street','Straat','autocomplete="address-line1" maxlength="120"')}${field('addition','Toevoeging','maxlength="20"',true)}</div>
        ${field('city','Woonplaats','autocomplete="address-level2" maxlength="100"')}
        <div class="field"><label for="housing-message">Je vraag <span class="optional">(optioneel)</span></label><textarea name="message" id="housing-message" maxlength="2000" rows="3" placeholder="Wat wil je graag laten beoordelen?"></textarea><small>Vermeld hier geen gevoelige gegevens.</small></div>
      </section>
      <section data-step="1" hidden aria-labelledby="housing-step-1"><h3 id="housing-step-1" tabindex="-1">Wanneer past een gesprek?</h3>
        ${field('name','Naam','autocomplete="name" minlength="2" maxlength="120"')}
        ${field('phone','Telefoonnummer','type="tel" autocomplete="tel" inputmode="tel" maxlength="40"')}
        ${field('email','E-mail voor je ontvangstbevestiging','type="email" autocomplete="email" maxlength="254"',true)}
        <div class="field"><label for="housing-contactPreference">Voorkeursmoment</label><select id="housing-contactPreference" name="contactPreference">${Object.entries(CONTACT_PREFERENCES).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><small>Dit is een voorkeur, geen bevestigde afspraak.</small></div>
      </section>
      <section data-step="2" hidden aria-labelledby="housing-step-2"><h3 id="housing-step-2" tabindex="-1">Klopt alles?</h3>
        <dl class="advice-review" id="housing-review"></dl>
        <label class="check-row lead-check"><input type="checkbox" name="shareScenario"><span>Deel ook mijn rekenprofiel.<small>Jaarverbruik, opwek, tarieven en gekozen scenarioaannames. Vrijwillig.</small></span></label>
        <label class="check-row lead-check"><input type="checkbox" name="contactRequested" required><span>${esc(config.housingContactText)}</span></label>
        <p class="lead-privacy">Geen automatische inschrijving voor dagmails of marketing. <a href="/privacy" target="_blank" rel="noopener">Privacyinformatie</a>.</p>
      </section>
      <div class="form-trap" aria-hidden="true"><label for="housing-website">Website</label><input id="housing-website" name="website" tabindex="-1" autocomplete="off"></div>
      <div class="form-message error hidden" id="housing-error" role="alert" tabindex="-1"></div>
      <p id="housing-progress" class="mini-note" role="status" aria-live="polite">Stap 1 van 3 · nog niets verzonden</p>
      <div class="advice-actions"><button type="button" class="button button-secondary" data-back hidden>Vorige</button><button type="submit" class="button button-primary" id="housing-submit">Naar contactgegevens →</button></div>
    </form>`);
  const form = document.querySelector('#housing-form');
  const submit = form.querySelector('#housing-submit');
  const errorBox = form.querySelector('#housing-error');
  const value = key => String(form.elements[key]?.value || '').trim();
  const draft = () => ({ housing: Object.fromEntries(['street','houseNumber','addition','city'].map(key => [key,value(key)])), postcode:value('postcode'), topic:value('topic'), contactPreference:value('contactPreference') });
  const clearErrors = () => { errorBox.textContent=''; errorBox.classList.add('hidden'); form.querySelectorAll('[data-error]').forEach(el=>el.textContent=''); form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid')); };
  function displayError(message, errors = {}) {
    errorBox.textContent=message; errorBox.classList.remove('hidden');
    for(const [key,text] of Object.entries(errors)) {
      const label=[...form.querySelectorAll('[data-error]')].find(el=>el.dataset.error===key);
      if(label)label.textContent=String(text);
      form.elements[key]?.setAttribute('aria-invalid','true');
    }
    const control=form.querySelector('[aria-invalid="true"]');
    if(control)control.focus();else errorBox.focus();
  }
  function review() {
    const values = [['Vraag',HOUSING_TOPICS[value('topic')]],['Naam',value('name')],['Woning',`${value('street')} ${value('houseNumber')} ${value('addition')}, ${value('postcode')} ${value('city')}`],['Telefoon',value('phone')],['E-mail',value('email')||'Niet opgegeven'],['Voorkeur',CONTACT_PREFERENCES[value('contactPreference')]],['Adviesontvanger',receiver]];
    form.querySelector('#housing-review').innerHTML=values.map(([label,text])=>`<div><dt>${label}</dt><dd>${esc(text)}</dd></div>`).join('');
  }
  function go(step) {
    state.step=step;
    form.querySelectorAll('[data-step]').forEach(el=>el.hidden=Number(el.dataset.step)!==step);
    document.querySelectorAll('.advice-steps li').forEach((el,i)=>{if(i===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
    form.querySelector('[data-back]').hidden=step===0;
    submit.textContent=['Naar contactgegevens →','Controleer mijn aanvraag →','Vraag woningadvies aan'][step];
    form.querySelector('#housing-progress').textContent=`Stap ${step+1} van 3 · nog niets verzonden`;
    if(step===2){review();prepareToken();}
    form.querySelector(`#housing-step-${step}`).focus();
  }
  async function prepareToken() {
    if(state.token)return true;
    if(state.tokenPromise)return state.tokenPromise;
    state.tokenPromise=(async()=>{try {
      const result=await api('/api/form-token');
      if(typeof result.token!=='string'||!result.token)throw new Error('Formulier niet beschikbaar.');
      state.token=result.token;return true;
    }catch(error){if(form.isConnected)displayError(error.message);return false;}finally{state.tokenPromise=null;}})();
    return state.tokenPromise;
  }
  function validateStep() {
    for(const control of form.querySelector(`[data-step="${state.step}"]`).querySelectorAll('input,select,textarea')) {
      if(!control.checkValidity()){control.reportValidity();return false;}
    }
    if(state.step===0) {
      const errors=housingFieldErrors(draft());
      if(Object.keys(errors).length){displayError('Controleer je woninggegevens.',errors);return false;}
    }
    return true;
  }
  form.querySelector('[data-back]').addEventListener('click',()=>{if(!state.pending){clearErrors();go(state.step-1);}});
  form.querySelector('[data-general]').addEventListener('click',()=>{if(!state.pending)onGeneral?.();});
  const changed=()=>{if(state.lastPayload){state.requestId=crypto.randomUUID();state.lastPayload=null;}clearErrors();};
  form.addEventListener('input',changed);form.addEventListener('change',changed);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(state.pending)return;clearErrors();
    if(!validateStep())return;
    if(state.step<2){go(state.step+1);return;}
    state.pending=true;submit.disabled=true;
    if(!await prepareToken()){state.pending=false;submit.disabled=false;return;}
    const payload=state.lastPayload||{...draft(),requestId:state.requestId,formToken:state.token,website:value('website'),
      name:value('name'),phone:value('phone'),email:value('email'),message:value('message'),channel:'phone',
      contactRequested:form.elements.contactRequested.checked,consentVersion:config.housingConsentVersion,
      shareScenario:form.elements.shareScenario.checked,...(form.elements.shareScenario.checked?{scenario:{profile:snapshot}}:{}),sourcePath};
    state.lastPayload=payload;
    const controls=[...form.querySelectorAll('input,select,textarea,button')].filter(el=>!el.disabled);
    controls.forEach(el=>el.disabled=true);submit.textContent='Aanvraag opslaan…';
    try {
      const result=await api('/api/housing-leads',{method:'POST',body:payload});
      if(result.ok!==true||typeof result.reference!=='string')throw new Error('De ontvangst is nog niet bevestigd. Probeer dezelfde aanvraag opnieuw.');
      if(!form.isConnected)return;
      showDialog(`<div class="lead-success-mark" aria-hidden="true">✓</div><span class="badge">Aanvraag ontvangen</span><h2 id="dialog-title">Je woningvraag staat klaar.</h2><p class="dialog-text">Je aanvraag voor ${esc(receiver)} is opgeslagen. Je hebt gevraagd om telefonisch contact.</p><div class="source-card"><strong>Je ontvangstnummer</strong><p class="lead-reference">${esc(result.reference)}</p><p>Bewaar dit nummer voor vragen of intrekking. Een voorkeursmoment is nog geen afspraak.</p></div><p class="dialog-text">Je rekenprofiel is ${payload.shareScenario?'volgens jouw keuze meegestuurd':'niet meegestuurd'}. Je bent niet ingeschreven voor nieuwsbrieven of marketing.</p><button class="button button-primary" data-action="close-dialog">Terug naar mijn inzicht</button>`);
    }catch(error){
      if(!form.isConnected)return;
      const errors=error.data?.fieldErrors||{};
      const keys=Object.keys(errors);
      if(keys.some(key=>['housing','street','houseNumber','addition','city','postcode','topic'].includes(key)))go(0);
      else if(keys.some(key=>['name','phone','email','contactPreference'].includes(key)))go(1);
      if(errors.formToken){state.token=null;state.lastPayload=null;}
      displayError(error.message||'Versturen lukt niet. Je invoer blijft in dit formulier.',errors);
    }finally{
      state.pending=false;controls.forEach(el=>el.disabled=false);
      if(submit.isConnected){submit.disabled=false;submit.textContent=['Naar contactgegevens →','Controleer mijn aanvraag →','Vraag woningadvies aan'][state.step];}
    }
  });
  return true;
}
