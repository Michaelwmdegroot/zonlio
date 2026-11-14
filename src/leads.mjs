import { api } from './api.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const topics={battery:'Past een thuisbatterij bij mij?',solar:'Meer eigen zonnestroom gebruiken',contract:'Mijn stroomcontract begrijpen',other:'Een andere vraag over verduurzaming'};
const fields=['annualUse','annualSolar','selfUsePct','targetPct','importRate','exportRate','exportFee','investment','extraSolarStored','roundTripEfficiency','annualCosts','lifeYears'];

export function openLeadForm({config,profile,sourcePath,summary,showDialog,onOpened=()=>{}}) {
  const receiver=config?.controller?.name||'Thuisbatterij Team B.V.';
  if(config?.leadEnabled!==true||typeof config.contactTexts?.email!=='string'||typeof config.contactTexts?.phone!=='string') {
    showDialog(`<span class="badge">Persoonlijk advies</span><h2 id="dialog-title">Stel je vraag aan Zonlio.</h2><p class="dialog-text">Het aanvraagformulier is op dit moment niet beschikbaar. Je kunt ons bereiken via <a href="mailto:info@zonlio.nl">info@zonlio.nl</a>.</p><div class="detail-box">Je berekening blijft beschikbaar. Er is geen aanvraag verzonden.</div><div class="dialog-actions"><button class="button button-primary" data-action="close-dialog">Terug naar mijn inzicht</button><a class="button button-secondary" href="/contact">Contactgegevens</a></div>`);
    return;
  }
  onOpened();
  const snapshot=Object.fromEntries(fields.filter(key=>Number.isFinite(profile[key])).map(key=>[key,profile[key]]));
  const state={channel:'email',topic:sourcePath==='batterij'?'battery':sourcePath==='2027'?'solar':'contract',requestId:crypto.randomUUID(),token:null,pending:false,lastPayload:null};
  showDialog(`<div class="lead-heading"><span class="badge blue">Persoonlijk advies</span><h2 id="dialog-title">Een volgende stap die bij je past.</h2><p class="dialog-text">Stel je vraag aan ${esc(receiver)} en kies hoe je contact wilt.</p></div>
    <div class="lead-snapshot"><span>Jouw vertrekpunt</span><strong>${esc(summary)}</strong><small>Een rekenscenario op basis van je invoer; geen offerte of vastgesteld besparingsadvies.</small></div>
    <form id="lead-form" novalidate>
      <div class="field"><label for="lead-topic">Waar wil je over praten?</label><select id="lead-topic" name="topic">${Object.entries(topics).map(([key,label])=>`<option value="${key}" ${key===state.topic?'selected':''}>${esc(label)}</option>`).join('')}</select></div>
      <fieldset class="channel-choice"><legend>Hoe mogen we je benaderen?</legend><label><input type="radio" name="channel" value="email" checked><span>Per e-mail<small>Antwoord in je inbox</small></span></label><label><input type="radio" name="channel" value="phone"><span>Telefonisch<small>Een persoonlijk gesprek</small></span></label></fieldset>
      <div class="form-grid"><div class="field"><label for="lead-name">Naam</label><input id="lead-name" name="name" autocomplete="name" required maxlength="100"><small class="field-error" data-error="name"></small></div><div class="field"><label for="lead-postcode">Postcode <span class="optional">(optioneel)</span></label><input id="lead-postcode" name="postcode" autocomplete="postal-code" maxlength="7" placeholder="1234 AB" pattern="[1-9][0-9]{3}\\s?[A-Za-z]{2}"><small class="field-error" data-error="postcode"></small></div></div>
      <div class="field" id="lead-email-field"><label for="lead-email">E-mailadres</label><input id="lead-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required><small class="field-error" data-error="email"></small></div>
      <div class="field hidden" id="lead-phone-field"><label for="lead-phone">Telefoonnummer</label><input id="lead-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="25" disabled><small class="field-error" data-error="phone"></small></div>
      <div class="field"><label for="lead-message">Je vraag <span class="optional">(optioneel)</span></label><textarea id="lead-message" name="message" rows="3" maxlength="2000" placeholder="Wat zou je graag willen weten?"></textarea><small>Vermeld hier geen gevoelige gegevens.</small></div>
      <div class="form-trap" aria-hidden="true"><label for="lead-website">Website</label><input id="lead-website" name="website" tabindex="-1" autocomplete="off"></div>
      <label class="check-row lead-check"><input type="checkbox" name="shareScenario"><span>Deel ook mijn rekenprofiel, zodat de adviseur mijn uitgangspunt kan bekijken.<small>Jaarverbruik, opwek, tarieven en gekozen batterijaannames. Deze keuze is vrijwillig.</small></span></label>
      <label class="check-row lead-check"><input type="checkbox" name="contactRequested" required><span id="lead-contact-text">${esc(config.contactTexts.email)}</span></label>
      <p class="lead-privacy">Je schrijft je niet in voor marketing. Lees hoe we je aanvraag verwerken in de <a href="/privacy" target="_blank" rel="noopener">privacyverklaring</a>.</p>
      <div id="lead-error" class="form-message error hidden" role="alert"></div><p id="lead-token-status" class="mini-note" role="status">Formulier wordt klaargezet…</p>
      <button id="lead-submit" class="button button-primary lead-submit" type="submit" disabled>Verstuur mijn aanvraag</button>
      <p class="mini-note">Je krijgt een ontvangstnummer zodra de aanvraag is opgeslagen.</p>
    </form>`);
  const form=document.querySelector('#lead-form');
  const submit=form.querySelector('#lead-submit');
  const errorBox=form.querySelector('#lead-error');
  const tokenStatus=form.querySelector('#lead-token-status');
  function setError(message) {errorBox.textContent=message;errorBox.classList.toggle('hidden',!message);}
  async function prepareToken() {
    try {
      const result=await api('/api/form-token');
      if(typeof result.token!=='string'||!result.token)throw new Error('Het formulier kan nu niet worden klaargezet.');
      state.token=result.token;
      tokenStatus.textContent='';
      submit.disabled=state.pending;
    } catch(error) {
      state.token=null;
      tokenStatus.innerHTML='Het formulier kon niet worden klaargezet. <button type="button" class="button-text" id="retry-form-token">Opnieuw proberen</button>';
      form.querySelector('#retry-form-token')?.addEventListener('click',prepareToken);
      setError(error.message);
    }
  }
  form.addEventListener('change',event=>{
    if(event.target.name==='channel') {
      state.channel=event.target.value;
      const email=state.channel==='email';
      form.querySelector('#lead-email-field').classList.toggle('hidden',!email);
      form.querySelector('#lead-phone-field').classList.toggle('hidden',email);
      form.elements.email.disabled=!email;form.elements.email.required=email;
      form.elements.phone.disabled=email;form.elements.phone.required=!email;
      form.elements.contactRequested.checked=false;
      form.querySelector('#lead-contact-text').textContent=config.contactTexts[state.channel];
    }
  });
  form.addEventListener('input',()=>{
    if(state.lastPayload){state.requestId=crypto.randomUUID();state.lastPayload=null;}
    setError('');
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(state.pending)return;
    form.querySelectorAll('[data-error]').forEach(el=>el.textContent='');
    if(!form.reportValidity())return;
    if(!state.token){await prepareToken();if(!state.token)return;}
    const values=new FormData(form);
    const payload=state.lastPayload||{
      requestId:state.requestId,formToken:state.token,website:String(values.get('website')||''),
      name:String(values.get('name')||'').trim(),channel:state.channel,
      ...(state.channel==='email'?{email:String(values.get('email')||'').trim()}:{phone:String(values.get('phone')||'').trim()}),
      postcode:String(values.get('postcode')||'').trim(),topic:String(values.get('topic')),
      message:String(values.get('message')||'').trim(),contactRequested:values.has('contactRequested'),
      consentVersion:config.consentVersion,shareScenario:values.has('shareScenario'),
      ...(values.has('shareScenario')?{scenario:{profile:snapshot}}:{}),sourcePath
    };
    state.lastPayload=payload;state.pending=true;submit.disabled=true;submit.textContent='Aanvraag versturen…';
    const lockedControls=[...form.querySelectorAll('input,select,textarea')].filter(control=>!control.disabled);
    lockedControls.forEach(control=>{control.disabled=true;});
    setError('');
    try {
      const result=await api('/api/leads',{method:'POST',body:payload});
      if(result.ok!==true||typeof result.reference!=='string')throw new Error('We konden de ontvangst nog niet bevestigen. Probeer dezelfde aanvraag opnieuw.');
      showDialog(`<div class="lead-success-mark" aria-hidden="true">✓</div><span class="badge">Aanvraag ontvangen</span><h2 id="dialog-title">Goed, we hebben je vraag.</h2><p class="dialog-text">Je aanvraag voor ${esc(receiver)} is opgeslagen. Je hebt gekozen voor contact ${payload.channel==='email'?'per e-mail':'per telefoon'}.</p><div class="source-card"><strong>Je ontvangstnummer</strong><p class="lead-reference">${esc(result.reference)}</p><p>Bewaar dit nummer als je later een vraag hebt. De melding aan het adviesteam wordt verwerkt.</p></div><p class="dialog-text">Je bent niet aangemeld voor marketing. Je rekenprofiel is ${payload.shareScenario?'meegestuurd volgens jouw keuze':'niet meegestuurd'}.</p><div class="dialog-actions"><button class="button button-primary" data-action="close-dialog">Terug naar mijn inzicht</button></div>`);
    } catch(error) {
      setError(error.message||'Versturen is niet gelukt. Je invoer staat nog klaar.');
      for(const [key,message] of Object.entries(error.data?.fieldErrors||{})) {
        const output=[...form.querySelectorAll('[data-error]')].find(el=>el.dataset.error===key);
        if(output)output.textContent=Array.isArray(message)?message.join(' '):String(message);
      }
      if(error.data?.fieldErrors?.formToken||error.status===403) {
        state.lastPayload=null;await prepareToken();
      }
      errorBox.focus();
    } finally {
      state.pending=false;
      lockedControls.forEach(control=>{control.disabled=false;});
      if(submit.isConnected){submit.disabled=!state.token;submit.textContent='Verstuur mijn aanvraag';}
    }
  });
  prepareToken();
}
