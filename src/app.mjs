import { brand } from './brand.mjs';
import { initialProfile, devices } from './data.mjs';
import { priceForContract, compareSelfUse, batteryScenario, findBestWindow } from './domain.mjs';
import { renderPriceChart } from './chart.mjs';
import { api, localDate, addDays, hourlySlots, normalizePrices, futurePriceSlots, safeUrl } from './api.mjs';
import { openLeadForm } from './leads.mjs';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const fmt=(n,d=0)=>new Intl.NumberFormat('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const money=(n,d=0)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const time=iso=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso));
const endTime=iso=>time(iso)==='00:00'?'24:00':time(iso);
const zoneTime=iso=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'shortOffset'}).format(new Date(iso));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconPaths = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  chart:'<path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h3m3 0h2"/>',
  battery:'<rect x="3" y="6" width="17" height="12" rx="3"/><path d="M22 10v4m-8-6-4 5h4l-4 4"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-8z"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sliders:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="3" fill="currentColor" stroke="none"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-18 5h18M9 4v16"/>',
  washing:'<rect x="4" y="3" width="16" height="19" rx="3"/><circle cx="12" cy="14" r="5"/><path d="M7 6h.1M10 6h.1m-3 8c2-2 3 2 5 0s3 2 5 0"/>',
  dishwasher:'<rect x="4" y="3" width="16" height="19" rx="3"/><path d="M4 8h16M7 5.5h.1M10 5.5h.1M8 12v5m4-5v5m4-5v5M7 18h10"/>',
  car:'<path d="m5 7 2-4h10l2 4 2 3v8H3v-8zM3 11h18M6 14h2m8 0h2M5 18v3m14-3v3"/>',
  leaf:'<path d="M20 3C11 2 4 6 4 12a7 7 0 0 0 7 7c7 0 10-7 9-16Z"/><path d="M3 22 15 10"/>',
  cloud:'<path d="M6 18a4 4 0 1 1 .6-8 6 6 0 0 1 11.6-1A4.5 4.5 0 0 1 18 18Z"/>',
};
const icon = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.info}</svg>`;
function hydrateIcons(root=document){$$('[data-icon]',root).forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}


const limits={annualUse:[0,100000],annualSolar:[0,100000],selfUsePct:[0,100],targetPct:[0,100],importRate:[-1,5],exportRate:[-1,5],exportFee:[0,5],investment:[0,100000],extraSolarStored:[0,100000],roundTripEfficiency:[.1,1],annualCosts:[0,10000],lifeYears:[1,50]};
const emptyContract=()=>({type:'dynamic',confirmed:false,exportConfirmed:false,importRate:'',markup:'',energyTax:'',vat:'',exportRate:'',exportFee:''});
const state={view:'overzicht',day:'today',resolution:'hour',mode:'market',selectedIndex:0,selectedStart:null,profile:{...initialProfile},dayContract:emptyContract(),saved:false,device:'dishwasher',startHour:8,endHour:22,savedPlan:null,prices:new Map(),weather:null,weatherRegion:'',config:{leadEnabled:false,analyticsEnabled:false,weatherRegions:[]},configStatus:'loading',pendingMode:null};
try {
  const stored=JSON.parse(localStorage.getItem(brand.storageKey)||'null');
  if(stored?.version===2&&stored.profile&&Object.entries(limits).every(([k,[min,max]])=>Number.isFinite(stored.profile[k])&&stored.profile[k]>=min&&stored.profile[k]<=max)) {
    state.profile={...initialProfile,...Object.fromEntries(Object.keys(limits).map(k=>[k,stored.profile[k]]))};state.saved=true;
    const c=stored.dayContract;
    if(c&&['dynamic','fixed'].includes(c.type)&&c.confirmed===true&&((c.type==='fixed'&&Number.isFinite(c.importRate)&&c.importRate>=-1&&c.importRate<=5)||(c.type==='dynamic'&&['markup','energyTax','vat'].every(k=>Number.isFinite(c[k]))&&c.markup>=-1&&c.markup<=5&&c.energyTax>=0&&c.energyTax<=5&&c.vat>=0&&c.vat<=1))) {
      state.dayContract={...emptyContract(),...Object.fromEntries(Object.keys(emptyContract()).filter(k=>k in c).map(k=>[k,c[k]]))};
      state.dayContract.exportConfirmed=c.exportConfirmed===true&&Number.isFinite(c.exportRate)&&c.exportRate>=-1&&c.exportRate<=5&&Number.isFinite(c.exportFee)&&c.exportFee>=0&&c.exportFee<=5;
    }
  }
}catch{}
function normalizeProfile(){const p=state.profile;const max=p.annualSolar>0?Math.floor(Math.min(100,p.annualUse/p.annualSolar*100)):100;p.selfUsePct=Math.min(Math.round(p.selfUsePct),max);p.targetPct=Math.min(Math.max(Math.round(p.targetPct),p.selfUsePct),max);}
normalizeProfile();
const activeDate=()=>addDays(localDate(),state.day==='tomorrow'?1:0);
const dateLabel=(date=activeDate())=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',weekday:'long',day:'numeric',month:'long'}).format(new Date(date+'T12:00:00Z'));
const currentPrices=()=>state.prices.get(activeDate())||{status:'loading',date:activeDate(),intervals:[]};
const nativeQuarters=()=>currentPrices().intervals?.length>0&&currentPrices().intervals.every(s=>s.durationMinutes===15);
const contract=()=>({...state.dayContract,exportRate:Number(state.dayContract.exportRate)||0,exportFee:Number(state.dayContract.exportFee)||0});
const priceName=()=>state.mode==='market'?'Beursprijs':state.mode==='export'?'Netto terugleverwaarde':'Afnameprijs';
const modeLabel=()=>state.mode==='market'?'Dagmarkt · zonder belastingen en leverancierskosten':state.mode==='export'?'Ingevoerde vergoeding min terugleverkosten':state.dayContract.type==='fixed'?'Vast / variabel tarief · volgens jouw invoer':'Dynamisch tarief · berekend met jouw contractinstellingen';
const plannerBasis=()=>state.dayContract.confirmed?'Afnamekosten volgens jouw contractinstellingen':'Alleen beurskosten · geen volledig consumententarief';
function pricedSlots(resolution=state.resolution,mode=state.mode) {
  const data=currentPrices();
  if(data.status!=='available')return [];
  const slots=resolution==='hour'?hourlySlots(data.intervals):data.intervals;
  return slots.map(s=>{
    const p=state.dayContract.confirmed?priceForContract(s.market,contract()):null;
    const value=mode==='market'?s.market/1000:mode==='export'&&state.dayContract.exportConfirmed?p?.exportNet:mode==='import'?p?.importRate:null;
    return {...s,price:p?.importRate??s.market/1000,displayValue:Number.isFinite(value)?100*value:null,solarKwh:0};
  });
}
function bestWindow({durationHours=3,energyKwh=3,startHour=0,endHour=24,market=false}={}) {
  if(currentPrices().status!=='available'||currentPrices().contiguous===false)return null;
  const slots=futurePriceSlots(pricedSlots('native',market?'market':'import'),activeDate());
  if(slots.length<2)return null;
  try{return findBestWindow(slots.map(s=>({...s,price:market?s.market/1000:s.price})),{durationHours,energyKwh,startHour,endHour,goal:'cost'});}catch{return null;}
}
function selectedSlot(slots) {
  if(!slots.length){state.selectedIndex=0;return null;}
  let index=state.selectedStart?slots.findIndex(s=>Date.parse(state.selectedStart)>=Date.parse(s.start)&&Date.parse(state.selectedStart)<Date.parse(s.start)+s.durationMinutes*60000):-1;
  if(index<0){const now=Date.now();index=slots.findIndex(s=>now>=Date.parse(s.start)&&now<Date.parse(s.start)+s.durationMinutes*60000);}
  state.selectedIndex=index<0?0:index;return slots[state.selectedIndex];
}
function statusMarkup() {
  const data=currentPrices();
  if(!['overzicht','planner'].includes(state.view))return '<span class="status-chip scenario-status">Rekenscenario</span>';
  const label=data.status==='loading'?'Prijzen ophalen':data.status==='available'?(data.stale?'Eerdere brondata':'Gepubliceerde prijzen'):data.status==='not_published'?'Nog niet gepubliceerd':'Bron niet beschikbaar';
  return `<span class="status-chip ${data.status==='available'&&!data.stale?'live-status':'pending-status'}"><span class="dot"></span>${label}</span>`;
}
function intro(eyebrow,title,subtitle){return `<div class="page-intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="intro-right">${statusMarkup()}<span class="date-label">${dateLabel()}</span></div></div>`;}
const note=text=>`<div class="notice-line">${icon('info')}<span>${text}</span></div>`;
const field=(key,label,unit,step=1)=>`<div class="field"><label for="f-${key}">${label}</label><div class="input-unit"><input id="f-${key}" name="${key}" data-profile="${key}" type="number" inputmode="decimal" min="${limits[key][0]}" max="${limits[key][1]}" step="${step}" value="${state.profile[key]}" required><span>${unit}</span></div></div>`;
function dayToggle(){return `<div class="segmented" aria-label="Prijsdag"><button data-day="today" class="${state.day==='today'?'selected':''}" aria-pressed="${state.day==='today'}">Vandaag</button><button data-day="tomorrow" class="${state.day==='tomorrow'?'selected':''}" aria-pressed="${state.day==='tomorrow'}">Morgen</button></div>`;}
function sourceText(source) {
  const url=safeUrl(source?.url);
  return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.name||'Prijsbron')} ↗</a>`:esc(source?.name||'Broninformatie wordt opgehaald');
}
function dataStatusMarkup(data=currentPrices()) {
  if(data.status==='loading')return `<div class="data-empty" role="status"><div class="chart-skeleton" aria-hidden="true">${Array.from({length:16},(_,i)=>`<span style="height:${24+(i%5)*12}%"></span>`).join('')}</div><strong>We halen de prijzen op.</strong><p>Een helder overzicht begint met de juiste gegevens.</p></div>`;
  const unpublished=data.status==='not_published';
  return `<div class="data-empty" role="status"><span class="empty-symbol">${icon(unpublished?'clock':'cloud')}</span><h3>${unpublished?'Deze prijzen komen nog.':'De prijsbron is even niet bereikbaar.'}</h3><p>${esc(data.message||(unpublished?'De dagmarktprijzen voor deze datum zijn nog niet gepubliceerd. Zodra ze er zijn, tonen we de echte waarden.':'We kunnen de prijzen nu niet betrouwbaar tonen. Probeer het straks opnieuw.'))}</p><button class="button button-secondary" data-action="retry-prices">Opnieuw ophalen</button></div>`;
}
function marketSummary(slots) {
  const valid=slots.filter(s=>Number.isFinite(s.displayValue));const minutes=valid.reduce((n,s)=>n+s.durationMinutes,0);
  return minutes?valid.reduce((n,s)=>n+s.displayValue*s.durationMinutes,0)/minutes:null;
}
function weatherMarkup() {
  const regions=state.config.weatherRegions||[];const w=state.weather;
  const hours=(Array.isArray(w?.hours)?w.hours:[]).filter(h=>Number.isFinite(Date.parse(h.start))&&localDate(h.start)===activeDate()&&Number.isFinite(h.temperatureC)&&Number.isFinite(h.cloudPercent));
  const reference=state.day==='today'?Date.now():Date.parse(activeDate()+'T12:00:00Z');
  const near=hours.reduce((best,h)=>!best||Math.abs(Date.parse(h.start)-reference)<Math.abs(Date.parse(best.start)-reference)?h:best,null);
  return `<div class="card-title-row"><h3>Een blik op het weer</h3><span class="icon-tile">${icon('cloud')}</span></div>${regions.length?`<label class="sr-only" for="weather-region">Weerregio</label><select id="weather-region" class="weather-region">${regions.map(r=>`<option value="${esc(r.id)}" ${state.weatherRegion===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select>`:''}
    ${near?`<div class="weather-reading"><span>${fmt(near.temperatureC,0)}<small>°C</small></span><div>${fmt(near.cloudPercent)}% bewolking<small>Verwachting om ${time(near.start)}</small></div></div><p class="weather-note">${w.stale?'Eerder opgehaalde verwachting. ':''}Weer geeft context; dit is geen voorspelling van je zonneopbrengst.</p><div class="source-inline">${sourceText(w.source)}${w.fetchedAt?' · opgehaald '+time(w.fetchedAt):''}</div>`:`<p class="weather-placeholder">${!regions.length?'Regionale weerinformatie is op dit moment niet beschikbaar.':w?.status==='loading'?'We halen de weersverwachting op…':'De weersverwachting is nu niet beschikbaar.'}</p><p class="weather-note">Je zonneopbrengst vraagt ook om gegevens over je dak en verbruik.</p>`}`;
}
function renderOverview() {
  const data=currentPrices();const slots=pricedSlots();const selected=selectedSlot(slots);
  const isConstant=state.mode==='export'||(state.mode==='import'&&state.dayContract.type==='fixed');
  const best=!isConstant?bestWindow({market:state.mode==='market'}):null;const average=marketSummary(slots);
  const bestLabel=isConstant?'Elk uur gelijk':best?`${time(best.start)}–${endTime(best.end)}`:'—';
  return `<div class="page">${intro('Jouw dagelijkse inzicht','Je stroom, op het juiste moment.','Zie de prijzen. Benut je zon. Kijk met vertrouwen vooruit.')}
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">${icon('bolt')}</span><div><div class="stat-label" id="stat-price-label">${priceName()}${selected?' om '+time(selected.start):''}</div><div class="stat-value"><span id="stat-price">${selected&&Number.isFinite(selected.displayValue)?fmt(selected.displayValue,1):'—'}</span><span class="unit">ct/kWh</span></div><div class="stat-note">${state.mode==='market'?'Zonder belasting of leverancierskosten':'Volgens je eigen tariefinstellingen'}</div></div></div>
      <div class="stat-card"><span class="stat-icon mint">${icon('clock')}</span><div><div class="stat-label">${isConstant?'Je ingevoerde tarief':'Voordeligste komende 3 uur'}</div><div class="stat-value">${bestLabel}</div><div class="stat-note ${best?'good':''}">${isConstant?'Geen tariefverschil door de dag':best?`Vanaf ${time(best.start)} · binnen deze prijsdag`:data.status==='available'?'Geen volledig toekomstig blok beschikbaar':'Zodra de prijzen beschikbaar zijn'}</div></div></div>
      <div class="stat-card"><span class="stat-icon amber">${icon('chart')}</span><div><div class="stat-label">Gemiddelde van deze dag</div><div class="stat-value">${average===null?'—':fmt(average,1)}<span class="unit">ct/kWh</span></div><div class="stat-note">${dateLabel()} · ${state.mode==='market'?'beursprijs':'gekozen tarief'}</div></div></div>
    </div>
    <div class="grid grid-main"><section class="panel chart-panel" aria-labelledby="prices-title">
      <div class="chart-head"><div class="chart-heading"><h2 id="prices-title">Stroomprijzen in beeld</h2><p id="chart-price-kind">${modeLabel()}</p></div>${dayToggle()}</div>
      <div class="chart-controls"><div class="mode-toggle" aria-label="Prijssoort">${[['market','Beurs'],['import','Afname'],['export','Terugleveren']].map(([key,label])=>`<button data-mode="${key}" class="${state.mode===key?'selected':''}" aria-pressed="${state.mode===key}">${label}</button>`).join('')}</div><div class="pill-group" aria-label="Tijdseenheid"><button class="pill ${state.resolution==='hour'?'selected':''}" data-resolution="hour" aria-pressed="${state.resolution==='hour'}">Uur</button><button class="pill ${state.resolution==='quarter'?'selected':''}" data-resolution="quarter" aria-pressed="${state.resolution==='quarter'}" ${!nativeQuarters()?'disabled title="Alleen beschikbaar wanneer de bron echte kwartierprijzen levert"':''}>Kwartier</button></div></div>
      ${selected?`<div class="chart-frame" id="price-chart">${renderPriceChart({slots,selectedIndex:state.selectedIndex,mode:state.mode,resolution:state.resolution})}</div><div class="chart-selected-row" id="selected-price">${selectedPriceMarkup(selected)}</div><label class="sr-only" for="hour-slider">Kies een tijdstip in de prijsgrafiek</label><input id="hour-slider" class="chart-slider" type="range" min="0" max="${slots.length-1}" value="${state.selectedIndex}" step="1" aria-valuetext="${esc(zoneTime(selected.start))}, ${fmt(selected.displayValue,1)} cent per kWh">`:dataStatusMarkup(data)}
      ${data.stale?`<div class="inline-status caution">${icon('clock')}<span>Vernieuwen is niet gelukt. Je ziet eerder opgehaalde prijzen voor ${dateLabel(data.date)}${data.fetchedAt?' van '+time(data.fetchedAt):''}.</span><button class="button-text" data-action="retry-prices">Vernieuwen</button></div>`:''}
      <div class="chart-footer"><button data-action="sources">${icon('info')}Bron en berekening</button><span class="small-label">${data.status==='available'?esc(data.source?.name||'Dagmarkt')+(data.fetchedAt?' · '+time(data.fetchedAt):''):dateLabel()}</span><button data-action="table" ${!selected?'disabled':''}>${icon('table')}Tabel</button></div>
    </section>
    <aside class="panel day-card"><div class="sun-emblem"></div><div class="card-eyebrow">${icon('spark')}RUIMTE IN JE DAG</div><h2>${isConstant?'Je eigen verbruik maakt verschil.':best?'Laat je apparaten meebewegen.':'Geef inzicht de ruimte.'}</h2><div class="window">${best?`${time(best.start)}–${endTime(best.end)}`:isConstant?'Jouw ritme telt.':'Vandaag en morgen.'}</div><p class="explain">${isConstant?'Je ingevoerde tarief blijft gelijk. Wat je van je eigen zonnestroom gebruikt, hoef je niet van het net af te nemen.':best?'Dit is het voordeligste aaneengesloten blok van drie uur dat nog moet beginnen. Kies in de planner wat bij je dag past.':'Bekijk de gepubliceerde prijzen en kies een moment dat past. Je kunt ook alvast verkennen wat 2027 voor jouw zonnestroom betekent.'}</p><div class="device-row"><span class="device-chip">${icon('dishwasher')}</span><span class="device-chip">${icon('washing')}</span><span class="device-chip">${icon('car')}</span></div><div class="spacer"></div><a class="button button-primary" href="#planner">Plan een apparaat ${icon('arrow')}</a><div class="micro">${state.mode==='market'?'Beursprijzen zijn geen volledig klanttarief.':'Met jouw eigen tariefinstellingen.'}</div></aside></div>
    <div class="grid grid-bottom section-gap"><section class="panel solar-card weather-card" id="weather-card">${weatherMarkup()}</section><section class="panel future-card"><div class="future-mark" aria-hidden="true">2027</div><div class="card-title-row"><h3>Je zonnepanelen na salderen</h3></div><p>Ontdek wat meer eigen verbruik betekent voor jouw jaarbedrag.</p><a class="button-text" href="#2027">Bekijk mijn scenario ${icon('arrow')}</a></section><section class="panel coach-card"><div class="card-title-row"><h3>Even helder krijgen</h3><span class="coach-badge">${icon('spark')}</span></div><p>Waarom is een negatieve beursprijs niet altijd gratis stroom?</p><button class="button-text" data-action="explain">Zo zit dat ${icon('arrow')}</button></section></div>
    ${note('De grafiek toont gepubliceerde dagmarktprijzen. Afname en teruglevering hangen af van je contract; vul je eigen afspraken in bij <button class="button-text" data-action="profile">Mijn huis</button>.')}
  </div>`;
}
function selectedPriceMarkup(slot) {
  const end=new Date(Date.parse(slot.start)+slot.durationMinutes*60000).toISOString();
  const repeated=currentPrices().intervals?.some(s=>s.start!==slot.start&&time(s.start)===time(slot.start)&&Math.abs(Date.parse(s.start)-Date.parse(slot.start))>=3600000);
  return `<div class="time">${time(slot.start)}–${endTime(end)} <small>${repeated?esc(zoneTime(slot.start)):'Geselecteerd tijdvak'}</small></div><div class="amount ${slot.displayValue<0?'negative':''}">${fmt(slot.displayValue,1)}<small>ct/kWh</small></div>`;
}
function updateChart(index) {
  const target=$('#price-chart');const slots=pricedSlots();if(!target||!slots.length)return;
  state.selectedIndex=Math.min(Math.max(Number(index)||0,0),slots.length-1);const slot=slots[state.selectedIndex];state.selectedStart=slot.start;
  target.innerHTML=renderPriceChart({slots,selectedIndex:state.selectedIndex,mode:state.mode,resolution:state.resolution,width:target.clientWidth});
  $('#selected-price').innerHTML=selectedPriceMarkup(slot);$('#stat-price').textContent=fmt(slot.displayValue,1);$('#stat-price-label').textContent=`${priceName()} om ${time(slot.start)}`;
  const slider=$('#hour-slider');slider.value=state.selectedIndex;slider.setAttribute('aria-valuetext',`${zoneTime(slot.start)}, ${fmt(slot.displayValue,1)} cent per kWh`);
}
async function loadPrices({force=false}={}) {
  const date=activeDate();const previous=state.prices.get(date);
  if(previous?.loading||(!force&&previous?.status==='available'))return;
  state.prices.set(date,previous?.status==='available'?{...previous,loading:true}:{status:'loading',loading:true,date,intervals:[]});
  if(['overzicht','planner'].includes(state.view))render();
  try {
    const result=normalizePrices(await api(`/api/prices?date=${encodeURIComponent(date)}`));
    if(result.date!==date)throw new Error('De bron gaf prijzen voor een andere datum.');
    state.prices.set(date,result);
  } catch(error) {
    state.prices.set(date,previous?.status==='available'?{...previous,loading:false,stale:true,message:error.message}:{status:'unavailable',date,intervals:[],message:error.message});
  }
  if(date===activeDate()&&['overzicht','planner'].includes(state.view)){if(state.resolution==='quarter'&&!nativeQuarters())state.resolution='hour';render();}
}
async function loadWeather() {
  if(!state.weatherRegion)return;
  const region=state.weatherRegion;state.weather={status:'loading',hours:[]};updateWeather();
  try {const data=await api(`/api/weather?region=${encodeURIComponent(region)}`);if(region===state.weatherRegion)state.weather=data;}
  catch(error){if(region===state.weatherRegion)state.weather={status:'unavailable',hours:[],message:error.message};}
  updateWeather();
}
function updateWeather(){if($('#weather-card')){$('#weather-card').innerHTML=weatherMarkup();hydrateIcons($('#weather-card'));}}
function hourOptions(selected,start=0,end=24){return Array.from({length:end-start+1},(_,i)=>i+start).map(h=>`<option value="${h}" ${h===selected?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('');}
function plannerResult(){const d=devices[state.device];return bestWindow({durationHours:d.durationHours,energyKwh:d.energyKwh,startHour:state.startHour,endHour:state.endHour,market:!state.dayContract.confirmed});}
function renderPlanner() {
  const d=devices[state.device];const data=currentPrices();const best=plannerResult();const fixed=state.dayContract.confirmed&&state.dayContract.type==='fixed';
  return `<div class="page">${intro('Slim plannen','Geef je stroom een goed moment.','Jij kiest het apparaat en de tijden. Wij rekenen met gepubliceerde prijzen.')}
    <div class="planner-date"><span>${dateLabel()}</span>${dayToggle()}</div>
    <div class="grid grid-equal"><section class="panel form-card"><h2>Wat wil je plannen?</h2><p class="form-intro">Kies een apparaat en wanneer het klaar moet zijn. Vandaag nemen we alleen tijdvakken mee die nog moeten beginnen.</p><div class="device-grid" aria-label="Apparaat">${Object.entries(devices).map(([key,v])=>`<button data-device="${key}" class="device-option ${key===state.device?'selected':''}" aria-pressed="${key===state.device}">${icon(v.icon)}<span>${v.name}</span><small>${fmt(v.energyKwh,1)} kWh · ${v.durationHours} uur</small></button>`).join('')}</div>
      <div class="form-grid"><div class="field"><label for="start-hour">Mag starten vanaf</label><select id="start-hour" data-planner="startHour">${hourOptions(state.startHour,0,23)}</select></div><div class="field"><label for="end-hour">Moet klaar zijn om</label><select id="end-hour" data-planner="endHour">${hourOptions(state.endHour,1,24)}</select></div></div>
      <div class="detail-box"><strong>${state.dayContract.confirmed?(fixed?'Vast / variabel tarief':'Jouw dynamische tarief'):'Eerst inzicht in de beursprijs'}</strong><br>${fixed?'Het ingevoerde afnametarief is elk uur gelijk. De planner kiest het eerste passende tijdvak.':state.dayContract.confirmed?'We rekenen met de gepubliceerde prijzen en de opslag, belasting en btw die je zelf hebt ingevuld.':'Zonder contractinstellingen zie je alleen beurskosten. Leverancierskosten en belastingen zijn nog niet meegenomen.'} <button class="button-text" data-action="profile">Mijn tarief instellen ${icon('chevron')}</button></div>
      <p class="mini-note">Apparaatverbruik is een aanname, gelijk verdeeld over de draaiuren. Je eigen zonneopwek, teruglevereffecten en aansturing van apparaten zijn niet meegenomen.</p></section>
    <section class="panel planner-hero" aria-live="polite">${data.status!=='available'?dataStatusMarkup(data):best?`<div class="card-eyebrow">${icon('clock')}${fixed?'EEN PASSEND MOMENT':'HET VOORDELIGSTE MOMENT'}</div><h2>${d.name}:<br>klaar op jouw tijd.</h2><div class="planner-time">${time(best.start)}–${endTime(best.end)}</div><p class="planner-summary">${fixed?'Alle toegestane tijdvakken hebben hetzelfde ingevoerde tarief.':'Dit blok heeft de laagste berekende kosten binnen de gekozen tijden.'} ${data.stale?'We gebruiken eerder opgehaalde prijzen.':''}</p><div class="planner-metrics"><div><div class="value">${money(best.gridCost,2)}</div><div class="label">${state.dayContract.confirmed?'berekende afnamekosten':'alleen beurskosten'}</div></div><div><div class="value">${fmt(d.energyKwh,1)} kWh</div><div class="label">aangenomen apparaatverbruik</div></div></div><div class="planning-basis">${plannerBasis()}</div><button class="button button-white" data-action="save-plan">${icon('check')}Zet in mijn dagplan</button><p class="mini-note">Je stelt zelf je apparaat of timer in. Deze planning blijft alleen tijdens deze sessie bewaard.</p>`:`<div class="empty-state"><span class="empty-symbol">${icon('clock')}</span><h3>Dit programma past nu niet.</h3><p>Er is minimaal ${d.durationHours} uur aan opeenvolgende, toekomstige prijsintervallen nodig. Kies ruimere tijden of bekijk morgen.</p></div>`}</section></div>
    ${state.savedPlan?`<div class="chosen-plan">${icon('check')}<div><strong>In je dagplan: ${esc(state.savedPlan.name)}, ${esc(state.savedPlan.window)}</strong><br>${esc(state.savedPlan.date)}. Je zet het apparaat zelf aan of stelt de timer in.</div></div>`:''}
    <section class="panel panel-pad section-gap"><h3>Inzicht dat past bij jouw huis.</h3><div class="explanation-list"><div class="explanation-item"><span class="number-bubble">1</span><div><strong>Jouw dag bepaalt de grenzen</strong><p>Een goedkoop moment is alleen nuttig als je apparaat dan ook kan draaien.</p></div></div><div class="explanation-item"><span class="number-bubble">2</span><div><strong>Je contract maakt de prijs compleet</strong><p>De beursprijs is één deel van je tarief. Neem de andere onderdelen over uit je eigen contract.</p></div></div><div class="explanation-item"><span class="number-bubble">3</span><div><strong>Je eigen zon is een volgende stap</strong><p>Voor plannen met zonnestroom zijn je verwachte opwek én je huishoudvraag nodig. De huidige planner rekent zonder eigen opwek.</p></div></div></div></section></div>`;
}
function ownRange(key,label,min=0){const p=state.profile;const max=p.annualSolar>0?Math.floor(Math.min(100,p.annualUse/p.annualSolar*100)):100;return `<div class="range-field"><div class="range-label"><label for="r-${key}">${label}</label><output id="out-${key}" for="r-${key}">${fmt(p[key])}%</output></div><input id="r-${key}" type="range" data-range="${key}" min="${min}" max="${max}" value="${p[key]}" step="1"><div class="range-ends"><span>${fmt(min)}%</span><span>${fmt(max)}% van je zonnestroom</span></div></div>`;}
function mobileResult(value,label){return `<div class="mobile-result" aria-live="polite"><div><small>${label}</small><strong class="mobile-result-value">${value}</strong></div><button class="button button-soft" data-action="show-result">Bekijk uitkomst ${icon('arrow')}</button></div>`;}
function render2027(){return `<div class="page">${intro('Vooruitkijken naar 2027','Je zon blijft waardevol.','Ontdek wat je zelf kunt veranderen als salderen stopt.')}
  ${mobileResult(money(compareSelfUse(state.profile,state.profile.targetPct).optimized.annualVariableCost)+' / jaar','Jouw 2027-scenario')}<div class="grid grid-equal"><section class="panel form-card"><h2>Begin bij jouw huis</h2><p class="form-intro">Vul je totale jaarverbruik en opwek in, of verken de startwaarden. Je krijgt direct inzicht zonder e-mailadres.</p>
    <div class="form-grid">${field('annualUse','Totaal stroomverbruik','kWh')}${field('annualSolar','Opbrengst zonnepanelen','kWh')}</div>
    <p class="form-helper">Totaal verbruik is alles wat je huis gebruikt, inclusief direct gebruikte zonnestroom. Neem hier niet alleen de netafname van je jaarafrekening over.</p>
    ${ownRange('selfUsePct','Direct eigen verbruik nu')}${ownRange('targetPct','Verken meer eigen verbruik',Math.ceil(state.profile.selfUsePct))}
    <p class="form-helper">De tweede schuif is een scenario. Hoeveel je werkelijk kunt verschuiven hangt af van je apparaten en dagritme.</p>
    <div class="form-section-title">Tarieven voor dit scenario</div><div class="form-grid">${field('importRate','Afname, incl. belastingen','€/kWh',.01)}${field('exportRate','Bruto terugleververgoeding','€/kWh',.01)}${field('exportFee','Variabele terugleverkosten','€/kWh',.01)}</div>
    <div id="profile-error" class="field-error" role="alert"></div>
    <p class="mini-note">Dit zijn aanpasbare rekenaannames, geen vastgesteld 2027-tarief. We rekenen met één gemiddeld tarief per energiestroom en lineaire terugleverkosten.</p>
    <div class="form-actions"><span class="privacy-tag">${icon('lock')}Zonder account</span><button class="compact-link" data-action="reset-profile">Herstel startwaarden</button></div>
  </section><div id="calc-results">${render2027Results()}</div></div>
  <section class="panel panel-pad section-gap"><div class="panel-head"><h2>Een slimme volgorde voor je volgende stap</h2><span class="badge">Jij houdt de regie</span></div><div class="grid grid-bottom"><div class="explanation-item"><span class="number-bubble">1</span><div><strong>Benut eerst je eigen zon</strong><p>Begin met de stroom die je toch al gebruikt, zoals je auto of vaatwasser.</p></div></div><div class="explanation-item"><span class="number-bubble">2</span><div><strong>Bekijk je terugleverafspraken</strong><p>Vergoeding en kosten bepalen samen wat je export waard is.</p></div></div><div class="explanation-item"><span class="number-bubble">3</span><div><strong>Bereken wat opslag toevoegt</strong><p>Een batterij vergelijken we met je situatie ná slimmer verbruiken.</p></div></div></div></section>
  ${note('Salderen stopt per 1 januari 2027. Dit is een variabel energiesaldo, geen volledige jaarrekening: vaste leveringskosten, netbeheerkosten, belastingvermindering, investeringen en eventuele kostenschijven ontbreken. <button class="button-text" data-action="sources">Bekijk de aannames</button>')}
  </div>`;}
function render2027Results(){const p=state.profile;const {baseline,optimized,annualSaving}=compareSelfUse(p,p.targetPct);const share=p.annualSolar?optimized.directUse/p.annualSolar*100:0;return `<section class="panel result-hero"><div class="result-heading"><h2>Jouw 2027-scenario</h2><span class="badge blue">Rekenscenario</span></div><div class="result-label">Variabel jaarsaldo bij ${fmt(p.targetPct)}% eigen verbruik</div><div class="big-result">${money(optimized.annualVariableCost)} <small>/ jaar</small></div><p class="result-caption">Netafname min terugleververgoeding, plus variabele terugleverkosten.</p>
  <div class="energy-bars" role="img" aria-label="${fmt(share)} procent van de zonneopwek zelf gebruikt"><div class="own" style="width:${share}%"></div><div class="export" style="width:${100-share}%"></div></div><div class="energy-legend"><span><b>${fmt(optimized.directUse)} kWh</b> zelf gebruikt</span><span><b>${fmt(optimized.gridExport)} kWh</b> teruggeleverd</span></div>
  <div class="breakdown"><div class="breakdown-row"><span>Netafname · ${fmt(optimized.gridImport)} kWh</span><strong>${money(optimized.gridImport*p.importRate)}</strong></div><div class="breakdown-row"><span>Terugleververgoeding</span><strong class="good">${money(-optimized.gridExport*p.exportRate)}</strong></div><div class="breakdown-row"><span>Terugleverkosten</span><strong>${money(optimized.gridExport*p.exportFee)}</strong></div></div>
  <div class="benefit-box"><div class="benefit-row"><p>Verschil door meer eigen verbruik</p><span class="benefit-number ${annualSaving<0?'negative':''}">${money(annualSaving)}</span></div><small>${money(baseline.annualVariableCost)} → ${money(optimized.annualVariableCost)} per jaar, bij ${fmt(p.selfUsePct)}% → ${fmt(p.targetPct)}% direct eigen verbruik. ${annualSaving<0?'Met deze tarieven verhoogt dit scenario je kosten.':'Dit voordeel hangt af van de haalbaarheid van je scenario.'}</small></div>
  <div class="result-actions"><button class="button button-primary" data-action="report">${icon('download')}Mijn overzicht</button><a class="button button-white" href="#batterij">En een batterij? ${icon('arrow')}</a></div><p class="mini-note">Geen vergelijking met je werkelijke 2026-rekening. We isoleren het effect van je gekozen eigen verbruik binnen hetzelfde 2027-scenario.</p></section>
  <section class="panel panel-pad section-gap"><div class="card-title-row"><h3>Dit betekent jouw uitkomst</h3><span class="coach-badge">${icon('spark')}</span></div><p class="dialog-text">Elke extra kWh die je direct gebruikt is in dit scenario ${fmt((p.importRate-optimized.netExportRate)*100,1)} cent waard: je vermijdt afname en levert die kWh niet meer terug.</p><button class="button-text" data-action="advice">Bespreek mijn mogelijkheden ${icon('arrow')}</button></section>`;}

function batteryResult(){const p=state.profile;return batteryScenario({...p,selfUsePct:p.targetPct});}
function renderBattery(){return `<div class="page">${intro('Opslag in perspectief','Wat voegt een batterij écht toe?','Eerst slimmer verbruiken. Daarna kijken wat opslag kan opleveren.')}
  ${mobileResult(money(batteryResult().annualNetBenefit)+' / jaar','Extra voordeel van opslag')}<div class="grid grid-equal"><section class="panel form-card"><h2>Verken een opslagscenario</h2><p class="form-intro">Een eerste financiële verkenning met je ingevulde jaargegevens. Een passend batterijformaat vraagt later ook om intervaldata.</p>
    <div class="detail-box"><strong>Je vertrekpunt: ${fmt(state.profile.targetPct)}% direct eigen verbruik</strong><br>We vergelijken de batterij met het scenario waarin je al slimmer verbruikt. <a class="button-text" href="#2027">Mijn jaargegevens aanpassen ${icon('chevron')}</a></div>
    <div class="form-section-title">Hoeveel zonnestroom verplaats je?</div><div class="field"><label for="f-extraSolarStored">Zonnestroom die je per jaar opslaat</label><div class="input-unit"><input id="f-extraSolarStored" type="number" inputmode="numeric" data-profile="extraSolarStored" min="0" max="100000" step="100" value="${state.profile.extraSolarStored}"><span>kWh</span></div><small>Dit is energie vóór opslagverlies, geen batterijcapaciteit. De uitkomst begrenst dit op de resterende opwek en afname.</small></div>
    <div class="form-section-title">Kosten en aannames</div><div class="form-grid">${field('investment','Investering, incl. installatie','€',100)}${field('annualCosts','Overige kosten per jaar','€',5)}${field('roundTripEfficiency','Retourrendement','0–1',.01)}${field('lifeYears','Vergelijkingsperiode','jaar',1)}</div>
    <div id="profile-error" class="field-error" role="alert"></div><div class="detail-box"><strong>Bewust één opbrengst tegelijk.</strong><br>We rekenen hier alleen met meer gebruik van je eigen zon. Arbitrage en onbalanshandel zijn niet opgenomen. Ook degradatie, financiering en vervanging zijn nog niet doorgerekend.</div><p class="mini-note">De jaarlijkse energieverschuiving is een aanname, geen gevalideerde voorspelling. Deze check kiest nog geen batterij of capaciteit.</p>
  </section><div id="battery-results">${renderBatteryResults()}</div></div></div>`;}
function renderBatteryResults(){const p=state.profile;const {baseline,optimized}=compareSelfUse(p,p.targetPct);const b=batteryResult();const after=optimized.annualVariableCost-b.annualNetBenefit;return `<section class="panel result-hero"><div class="result-heading"><h2>Extra voordeel van opslag</h2><span class="badge blue">Scenario</span></div><div class="battery-display"><div><div class="result-label">Boven op slimmer verbruiken</div><div class="big-result">${money(b.annualNetBenefit)} <small>/ jaar</small></div><p class="result-caption">Inclusief ${money(p.annualCosts)} overige jaarkosten.<br>Vóór investering en toekomstige veranderingen.</p></div><div class="battery-illustration" aria-hidden="true"><div class="battery-fill"></div></div></div>
  <div class="battery-comparison"><div class="compare-col"><div class="label">Je huidige<br>verbruikspatroon</div><div class="number">${money(baseline.annualVariableCost)}</div><div class="unit">per jaar</div></div><div class="compare-col"><div class="label">Slimmer<br>verbruiken</div><div class="number">${money(optimized.annualVariableCost)}</div><div class="unit">per jaar</div></div><div class="compare-col selected"><div class="label">Slimmer +<br>batterijscenario</div><div class="number">${money(after)}</div><div class="unit">per jaar*</div></div></div>
  <p class="mini-note">* Variabel saldo inclusief overige batterijkosten, exclusief aanschaf. Vergelijking gebruikt dezelfde verbruiks- en tariefaannames.</p>
  <div class="breakdown"><div class="breakdown-row"><span>Zonnestroom naar opslag</span><strong>${fmt(b.solarStored)} kWh/jaar</strong></div><div class="breakdown-row"><span>Nuttig uit de batterij, na verlies</span><strong>${fmt(b.usefulOutput)} kWh/jaar</strong></div><div class="breakdown-row"><span>Eenvoudige terugverdientijd</span><strong>${b.simplePayback===null?'Geen positieve opbrengst':b.paybackWithinLife?`${fmt(b.simplePayback,1)} jaar`:`Niet binnen ${fmt(p.lifeYears)} jaar`}</strong></div></div>
  <div class="warning-box">${b.paybackWithinLife?`<strong>Dit scenario verdient zich rekenkundig terug.</strong> De uitkomst veronderstelt elk jaar hetzelfde voordeel. Voor een aanschafbesluit zijn intervaldata, degradatie en werkelijke productkosten nodig.`:`<strong>Eerst verder rekenen is hier verstandig.</strong> Met deze aannames verdient de investering zich niet binnen ${fmt(p.lifeYears)} jaar terug uit alleen extra eigen zonnestroom.`}</div>
  ${b.solarStored+1e-7<p.extraSolarStored?`<p class="mini-note">De ingevoerde ${fmt(p.extraSolarStored)} kWh is begrensd tot ${fmt(b.solarStored)} kWh, zodat opslag niet meer opwek of afname benut dan in je jaarprofiel beschikbaar is.</p>`:''}
  <div class="result-actions"><button class="button button-primary" data-action="advice">Bespreek mijn batterijscenario ${icon('arrow')}</button><button class="button button-white" data-action="report">Mijn overzicht</button></div></section>`;}

function render() {
  const view=location.hash.slice(1);state.view=['overzicht','planner','2027','batterij'].includes(view)?view:'overzicht';
  $('#main').innerHTML=({overzicht:renderOverview,planner:renderPlanner,'2027':render2027,batterij:renderBattery}[state.view])();
  $$('[data-nav]').forEach(a=>{const active=a.dataset.nav===state.view;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=`${{overzicht:'Actuele stroomprijzen',planner:'Slim plannen','2027':'Zonnepanelen in 2027',batterij:'Thuisbatterij berekenen'}[state.view]} · ${brand.name}`;
  hydrateIcons();if(state.view==='overzicht')updateChart(state.selectedIndex);
}
let dialogReturnFocus=null;
let contractDraft=null;
function showDialog(content){const dialog=$('#app-dialog');if(!dialog.open)dialogReturnFocus=document.activeElement;$('#dialog-content').innerHTML=content;hydrateIcons(dialog);if(!dialog.open)dialog.showModal();dialog.scrollTop=0;}
function closeDialog(){const dialog=$('#app-dialog');dialog.close();contractDraft=null;state.pendingMode=null;if(dialogReturnFocus?.isConnected)dialogReturnFocus.focus();}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function contractField(key,label,unit,{min=-1,max=5,step=.00001,required=true}={}) {
  const value=key==='vat'&&Number.isFinite(contractDraft[key])?contractDraft[key]*100:contractDraft[key];
  return `<div class="field"><label for="c-${key}">${label}</label><div class="input-unit"><input id="c-${key}" name="${key}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${esc(value)}" ${required?'required':''}><span>${unit}</span></div></div>`;
}
function rememberContractDraft(){const form=$('#contract-form');if(!form)return;for(const input of $$('input[name]',form)){if(input.type==='number')contractDraft[input.name]=input.value===''?'':Number(input.value)/(input.name==='vat'?100:1);}}
function showProfile() {
  if(!contractDraft)contractDraft={...state.dayContract};
  const c=contractDraft;
  showDialog(`<h2 id="dialog-title">Mijn huis</h2><p class="dialog-text">Maak de dagprijzen persoonlijk met je eigen contract. Deze instellingen staan los van de aannames in je 2027-scenario.</p>
    <form id="contract-form"><div class="form-section-title">Tarief voor je dagoverzicht</div><div class="segmented contract-type"><button type="button" data-contract="dynamic" class="${c.type==='dynamic'?'selected':''}" aria-pressed="${c.type==='dynamic'}">Dynamisch</button><button type="button" data-contract="fixed" class="${c.type==='fixed'?'selected':''}" aria-pressed="${c.type==='fixed'}">Vast / variabel</button></div>
    <p class="mini-note">${c.type==='dynamic'?'Neem opslag en energiebelasting over uit je actuele contract, vóór btw. We vullen geen belastingbedrag voor je in.':'Neem je actuele afnametarief over, inclusief toepasselijke belastingen en btw. Dit tarief blijft gedurende de dag gelijk.'}</p>
    <div class="form-grid">${c.type==='dynamic'?contractField('markup','Leveranciersopslag, ex. btw','€/kWh')+contractField('energyTax','Energiebelasting, ex. btw','€/kWh',{min:0})+contractField('vat','Btw over afname','%',{min:0,max:100,step:.01}):contractField('importRate','Afnametarief, inclusief','€/kWh')}</div>
    <details class="contract-export" ${state.pendingMode==='export'||c.exportConfirmed?'open':''}><summary>Ook je terugleverwaarde instellen</summary><p class="mini-note">Vul een vast bedrag per kWh in op de voor jou toepasselijke belastingbasis. Een variabele beursformule of kostenschijven worden hier niet nagebootst.</p><div class="form-grid">${contractField('exportRate','Bruto vergoeding','€/kWh',{required:false})}${contractField('exportFee','Variabele terugleverkosten','€/kWh',{min:0,required:false})}</div></details>
    <label class="check-row"><input type="checkbox" name="confirmed" required><span>Ik heb deze tariefonderdelen zelf gecontroleerd in mijn contract. Zonlio kan hiermee mijn dagtarief berekenen.</span></label>
    <div id="contract-error" class="field-error" role="alert"></div><div class="dialog-actions"><button class="button button-primary" type="submit">Gebruik mijn tarief</button><button class="button button-secondary" type="button" data-action="market-only">Alleen beursprijzen</button></div></form>
    <div class="profile-divider"></div><div class="form-section-title">Je jaarprofiel</div><div class="fact-row"><span>Stroomverbruik / zonneopwek</span><strong>${fmt(state.profile.annualUse)} / ${fmt(state.profile.annualSolar)} kWh</strong></div><button class="button-text" data-action="go-2027">Jaargegevens en scenario aanpassen ${icon('arrow')}</button>
    <label class="check-row"><input type="checkbox" id="save-on-device" ${state.saved?'checked':''}><span>Bewaar mijn rekenprofiel en tariefinstellingen op dit apparaat.<small>Alleen je rekengegevens; geen naam of contactgegevens.</small></span></label><div class="profile-storage-actions"><button class="button-text" data-action="forget-profile">Wis bewaard profiel</button><button class="button-text" data-action="close-dialog">Sluiten</button></div>`);
}
function applyContract(form) {
  const fixed=contractDraft.type==='fixed';
  const exportRate=form.elements.exportRate.value;
  const exportFee=form.elements.exportFee.value;
  form.elements.exportRate.required=exportFee!==''||state.pendingMode==='export';
  form.elements.exportFee.required=exportRate!==''||state.pendingMode==='export';
  if(!form.reportValidity())return;
  const c={...emptyContract(),type:contractDraft.type,confirmed:true};
  for(const key of fixed?['importRate']:['markup','energyTax','vat'])c[key]=Number(form.elements[key].value)/(key==='vat'?100:1);
  if(exportRate!==''&&exportFee!==''){c.exportRate=Number(exportRate);c.exportFee=Number(exportFee);c.exportConfirmed=true;}
  state.dayContract=c;
  state.mode=state.pendingMode==='export'&&c.exportConfirmed?'export':'import';state.pendingMode=null;
  maybePersist();closeDialog();render();toast('Je eigen tariefinstellingen zijn toegepast.');
}
function showSources() {
  const data=currentPrices();const w=state.weather;
  showDialog(`<h2 id="dialog-title">Bronnen & berekeningen</h2><p class="dialog-text">Een helder getal heeft een duidelijke herkomst. Marktgegevens en jouw eigen aannames blijven apart herkenbaar.</p>
    <div class="source-card"><strong>Gepubliceerde dagmarktprijzen · ${esc(data.date||activeDate())}</strong><p>${sourceText(data.source)}</p><p>Status: ${data.status==='available'?(data.stale?'eerder opgehaald':'beschikbaar'):data.status==='not_published'?'nog niet gepubliceerd':data.status==='loading'?'wordt opgehaald':'niet beschikbaar'}.${data.fetchedAt?' Opgehaald op '+esc(new Date(data.fetchedAt).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}))+'.':''}${data.publishedAt?' Bronpublicatie: '+esc(new Date(data.publishedAt).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}))+'.':''}</p>${data.source?.license?`<p>Licentie: ${esc(data.source.license)}</p>`:''}${data.source?.attribution?`<p>${esc(data.source.attribution)}</p>`:''}<p>De bron levert euro per MWh. Eén euro per MWh is 0,1 cent per kWh. Uurwaarden zijn naar duur gewogen gemiddelden van de bronintervallen. Kwartieren worden alleen getoond als de bron die werkelijk levert. Bij de klokwissel blijven de twee uren van 02:00 apart.</p></div>
    <div class="source-card"><strong>Jouw dagtarief</strong><p>Dynamische afname = (beursprijs / 1.000 + ingevulde opslag + ingevulde energiebelasting) × (1 + ingevulde btw). Vast/variabel gebruikt je ingevulde afnametarief. Netto terugleverwaarde = ingevulde bruto vergoeding − variabele kosten. Dit is geen volledige jaarrekening en geen automatische controle van jouw leveranciersvoorwaarden.</p></div>
    <div class="source-card"><strong>Regionaal weer</strong><p>${w?.source?sourceText(w.source):'Op dit moment geen weerbron beschikbaar.'}</p>${w?.source?.attribution?`<p>${esc(w.source.attribution)}</p>`:''}<p>Temperatuur en bewolking geven context. We leiden hier geen dakopbrengst of kWh zonnestroom uit af. Daarvoor zijn onder meer je locatie, dakrichting, helling en installatie nodig.</p></div>
    <div class="source-card"><strong>2027 · eenvoudige energiebalans</strong><p>Variabel jaarsaldo = netafname × afnametarief − export × bruto vergoeding + export × variabele terugleverkosten. Direct eigen verbruik is een aandeel van je zonneopwek. De aanpasbare startwaarden zijn rekenaannames, geen vastgestelde 2027-tarieven. Vaste kosten, belastingvermindering en eventuele kostenschijven ontbreken.</p><a href="https://zoek.officielebekendmakingen.nl/stb-2025-17.html" target="_blank" rel="noopener noreferrer">Wet beëindiging salderingsregeling ↗</a></div>
    <div class="source-card"><strong>Batterij · extra eigen zonnestroom</strong><p>Opgeslagen zonnestroom × retourrendement × afnametarief, min gemiste netto exportvergoeding en overige jaarkosten. Het voordeel wordt berekend boven op het gekozen scenario van slimmer verbruiken. Geen arbitrage, onbalanshandel, degradatie, rente, vervanging of capaciteitssimulatie. Een constant jaarvoordeel is een aanname.</p></div>
    <div class="source-card"><strong>Uitleg en voorspellingen</strong><p>De berekeningen volgen vaste, controleerbare rekenregels. De grafiek toont gepubliceerde marktdata; Zonlio doet hier geen AI-prijsvoorspelling voor de dagen daarna.</p></div><div class="dialog-actions"><button class="button button-primary" data-action="close-dialog">Helder</button></div>`);
}
function showPrivacy() {
  showDialog(`<h2 id="dialog-title">Jouw gegevens, jouw keuze.</h2><p class="dialog-text">Je kunt Zonlio gebruiken zonder account en zonder contactgegevens in te vullen.</p><ul class="modal-list"><li><strong>Rekenen gebeurt in je browser.</strong> Alleen als je bij een adviesaanvraag kiest voor delen, stuur je het rekenprofiel mee.</li><li><strong>Lokaal bewaren is optioneel.</strong> Bij Mijn huis kun je het bewaren aanzetten of het bewaarde profiel wissen.</li><li><strong>Een aanvraag is gericht.</strong> Je kiest e-mail of bellen en ziet wie je aanvraag ontvangt. Er is geen automatische inschrijving voor marketing.</li><li><strong>Gebruiksmeting vraagt je keuze.</strong> Met toestemming meten we paginaweergaven en het openen van berekeningen en advies. Deze metingen bevatten geen naam, contactgegevens of rekenprofiel.</li></ul><p class="dialog-text"><a href="/privacy">Lees de volledige privacyverklaring</a> of <a href="/contact">neem contact op</a>.</p>${state.config.analyticsEnabled?`<div class="detail-box">Je keuze voor gebruiksmeting: <strong>${analyticsChoice==='yes'?'toegestaan':analyticsChoice==='no'?'uitgeschakeld':'nog niet gekozen'}</strong>.</div><div class="dialog-actions"><button class="button button-secondary" data-analytics="no">Geen gebruiksmeting</button><button class="button button-secondary" data-analytics="yes">Gebruiksmeting toestaan</button></div>`:''}<button class="button button-text" data-action="close-dialog">Terug naar Zonlio</button>`);
}
function showAdvice() {
  trackCalculation();
  const b=batteryResult();const result=compareSelfUse(state.profile,state.profile.targetPct);
  const summary=state.view==='batterij'?`${money(b.annualNetBenefit)} extra jaarlijks voordeel in je batterijscenario`:`${fmt(state.profile.targetPct)}% eigen verbruik · ${money(result.optimized.annualVariableCost)} variabel jaarsaldo`;
  openLeadForm({config:state.config,profile:state.profile,sourcePath:state.view,summary,showDialog,onOpened:()=>track('advice_open')});
}
function showExplanation() {
  showDialog(`<h2 id="dialog-title">Negatieve beursprijs.<br>Wat betekent dat voor jou?</h2><p class="dialog-text">De beursprijs is één onderdeel van een dynamisch contract. Leveranciersopslag, energiebelasting en btw kunnen je uiteindelijke afnameprijs positief houden.</p><div class="source-card"><strong>Zo lees je de prijs</strong><p>Beurs toont het gepubliceerde markttarief. Afname laat na het instellen van je contract zien wat die marktprijs met jouw ingevoerde kosten betekent. Bij een vast of variabel contract beweegt het ingevulde afnametarief niet per uur mee.</p></div><div class="source-card"><strong>En je zonnestroom?</strong><p>De waarde van terugleveren volgt je contract. Kijk naar de bruto vergoeding én de terugleverkosten. Een lage beursprijs alleen vertelt niet hoeveel jij ontvangt of betaalt.</p></div><div class="dialog-actions"><button class="button button-primary" data-action="profile">Mijn tarief instellen</button><button class="button button-secondary" data-action="close-dialog">Helder</button></div>`);
}
function reportText(){const p=state.profile;const {baseline,optimized,annualSaving}=compareSelfUse(p,p.targetPct);const b=batteryResult();return `${brand.name} — persoonlijk rekenoverzicht\nZonlio ${brand.version} · opgesteld op ${localDate()}\n\nAARD VAN DIT OVERZICHT\nScenario op basis van ingevoerde waarden. Geen actuele prijsvoorspelling, offerte of volledig energieadvies.\n\nJAARPROFIEL\nTotaal stroomverbruik: ${fmt(p.annualUse)} kWh\nZonneopwek: ${fmt(p.annualSolar)} kWh\nDirect eigen verbruik: ${fmt(p.selfUsePct)}% → ${fmt(p.targetPct)}%\nAfname: ${money(p.importRate,2)}/kWh\nBruto terugleververgoeding: ${money(p.exportRate,2)}/kWh\nTerugleverkosten: ${money(p.exportFee,2)}/kWh\n\n2027-SCENARIO\nHuidig patroon: ${money(baseline.annualVariableCost)}/jaar\nMeer eigen verbruik: ${money(optimized.annualVariableCost)}/jaar\nVerschil: ${money(annualSaving)}/jaar\nNetafname: ${fmt(optimized.gridImport)} kWh\nExport: ${fmt(optimized.gridExport)} kWh\nAlleen variabel saldo; geen vaste kosten, belastingvermindering of investeringen.\n\nBATTERIJSCENARIO\nInvestering: ${money(p.investment)}\nExtra zonne-input opslag: ${fmt(b.solarStored)} kWh/jaar\nNuttig geleverd: ${fmt(b.usefulOutput)} kWh/jaar\nOverige jaarkosten: ${money(p.annualCosts)}\nExtra netto voordeel t.o.v. slimmer verbruiken: ${money(b.annualNetBenefit)}/jaar\nEenvoudige terugverdientijd: ${b.simplePayback===null?'geen positieve opbrengst':fmt(b.simplePayback,1)+' jaar'}\nVergelijkingsperiode: ${p.lifeYears} jaar\nGeen dispatchmodel, batterijcapaciteitsadvies, arbitrage, onbalans, degradatie, financiering of vervanging. Constant jaarvoordeel is een aanname.\n\nGEGEVENS\nOp dit apparaat berekend. Geen contactgegevens verzonden.\nWet salderen: https://zoek.officielebekendmakingen.nl/stb-2025-17.html\n`;}
function showReport(){trackCalculation();const p=state.profile;const {baseline,optimized,annualSaving}=compareSelfUse(p,p.targetPct);const b=batteryResult();showDialog(`<div class="report-document"><div class="report-brand">${esc(brand.name)} · Jouw stroom. Helder in beeld.</div><h2 id="dialog-title">Jouw rekenoverzicht</h2><p class="dialog-text">Een persoonlijk scenario met jouw invoer. Je kunt dit overzicht bewaren of afdrukken. Er worden geen gegevens verstuurd.</p><span class="badge">Rekenscenario · geen voorspelling</span><div class="source-card"><strong>Je jaarprofiel</strong><div class="fact-row"><span>Totaal verbruik / zonneopwek</span><strong>${fmt(p.annualUse)} / ${fmt(p.annualSolar)} kWh</strong></div><div class="fact-row"><span>Direct eigen verbruik</span><strong>${fmt(p.selfUsePct)}% → ${fmt(p.targetPct)}%</strong></div><div class="fact-row"><span>Afname / vergoeding / kosten</span><strong>${money(p.importRate,2)} / ${money(p.exportRate,2)} / ${money(p.exportFee,2)} per kWh</strong></div></div><h3>2027 · meer eigen verbruik</h3><div class="big-result">${money(optimized.annualVariableCost)} <small>/ jaar</small></div><p class="dialog-text">Variabel saldo ${money(baseline.annualVariableCost)} → ${money(optimized.annualVariableCost)}. Verschil: ${money(annualSaving)} per jaar. Vaste kosten, belastingvermindering en investeringen ontbreken. De haalbaarheid van het extra eigen verbruik is nog niet vastgesteld.</p><h3>Batterij · extra boven op slim verbruik</h3><p class="dialog-text">${money(b.annualNetBenefit)} per jaar bij ${fmt(b.solarStored)} kWh jaarlijkse zonne-input, ${fmt(p.roundTripEfficiency*100)}% retourrendement, ${money(p.investment)} investering en ${money(p.annualCosts)} overige jaarkosten. ${b.paybackWithinLife?'Eenvoudige terugverdientijd: '+fmt(b.simplePayback,1)+' jaar.':'Geen terugverdientijd binnen de gekozen '+p.lifeYears+' jaar.'}</p><p class="mini-note">Alle tarieven en toekomstige opbrengsten zijn aannames. Geen simulatie op intervaldata, degradatie, rente, vervanging, arbitrage of onbalanshandel. De vaste jaarlijkse opbrengst is niet gegarandeerd.</p><div class="dialog-actions"><button class="button button-primary" data-action="download-report">${icon('download')}Download tekst</button><button class="button button-secondary" data-action="print-report">Afdrukken / PDF</button></div></div>`);}
function downloadReport(){const blob=new Blob([reportText()],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='zonlio-mijn-scenario.txt';($('#dialog-content')||document.body).append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('De download van je rekenoverzicht is gestart.');}

function showTable(){const slots=pricedSlots();showDialog(`<h2 id="dialog-title">Prijzen als tabel</h2><p class="dialog-text">${dateLabel()} · ${modeLabel()}. ${state.resolution==='hour'?'Uurwaarden zijn naar duur gewogen.':'Werkelijke bronintervallen.'}</p><div class="table-scroll"><table><caption class="sr-only">Prijzen voor ${dateLabel()}</caption><thead><tr><th scope="col">Vanaf</th><th scope="col">${priceName()}</th><th scope="col">Eenheid</th></tr></thead><tbody>${slots.map(s=>`<tr><td>${esc(zoneTime(s.start))}</td><td>${fmt(s.displayValue,2)}</td><td>ct/kWh</td></tr>`).join('')}</tbody></table></div><p class="mini-note">${sourceText(currentPrices().source)}</p><div class="dialog-actions"><button class="button button-primary" data-action="close-dialog">Sluiten</button></div>`);}
function maybePersist(){if(state.saved){try{localStorage.setItem(brand.storageKey,JSON.stringify({version:2,profile:state.profile,dayContract:state.dayContract}));}catch{state.saved=false;toast('Bewaren lukt niet. Je berekening blijft in deze sessie beschikbaar.');}}}
function hasInvalidInput(){return $$('[aria-invalid="true"]',$('#main')).length>0;}
function setProfile(key,value,input) {
  const [min,max]=limits[key]||[];
  if(!Number.isFinite(value)||value<min||value>max||input?.value===''){input?.setAttribute('aria-invalid','true');const error=$('#profile-error');if(error)error.textContent=`Vul een getal in tussen ${fmt(min)} en ${fmt(max)}.`;return false;}
  input?.removeAttribute('aria-invalid');state.profile[key]=value;normalizeProfile();maybePersist();const error=$('#profile-error');if(error&&!hasInvalidInput())error.textContent='';return true;
}
let analyticsChoice=null;
let analyticsSession=null;
const calculationTracked=new Set();
try{const choice=localStorage.getItem('zonlio.analytics.v1');analyticsChoice=['yes','no'].includes(choice)?choice:null;}catch{}
function sessionId() {
  if(analyticsSession)return analyticsSession;
  try{analyticsSession=sessionStorage.getItem('zonlio.analytics.session');if(!analyticsSession){analyticsSession=crypto.randomUUID();sessionStorage.setItem('zonlio.analytics.session',analyticsSession);}}catch{analyticsSession=crypto.randomUUID();}
  return analyticsSession;
}
function track(event){if(state.config.analyticsEnabled===true&&analyticsChoice==='yes')api('/api/events',{method:'POST',body:{event,sessionId:sessionId(),consent:true,path:state.view}}).catch(()=>{});}
function trackCalculation(){if(['2027','batterij'].includes(state.view)&&!calculationTracked.has(state.view)){calculationTracked.add(state.view);track('calculator_complete');}}
function renderAnalyticsChoice() {
  let el=$('#analytics-choice');
  if(!state.config.analyticsEnabled||analyticsChoice){el?.remove();return;}
  if(!el){el=document.createElement('aside');el.id='analytics-choice';el.className='analytics-choice';el.setAttribute('aria-label','Keuze voor gebruiksmeting');document.body.append(el);}
  el.innerHTML=`<div><strong>Help Zonlio beter te maken</strong><p>Mogen we meten welke onderdelen je gebruikt? Zonder contactgegevens of rekenprofiel. <button data-action="privacy" class="button-text">Meer informatie</button></p></div><div class="analytics-actions"><button class="button button-secondary" data-analytics="no">Nee, bedankt</button><button class="button button-secondary" data-analytics="yes">Ja, dat mag</button></div>`;
}
function setAnalyticsChoice(choice) {
  analyticsChoice=choice;
  try{localStorage.setItem('zonlio.analytics.v1',choice);if(choice==='no')sessionStorage.removeItem('zonlio.analytics.session');}catch{}
  if(choice==='no')analyticsSession=null;
  renderAnalyticsChoice();if(choice==='yes')track('page_view');
  if($('#app-dialog').open&&$('#dialog-title')?.textContent==='Jouw gegevens, jouw keuze.')showPrivacy();
}
document.addEventListener('click',event=>{
  const target=event.target.closest('button,a,[data-slot]');if(!target)return;
  if(target.dataset.slot!==undefined&&state.view==='overzicht'){updateChart(Number(target.dataset.slot));return;}
  if(target.dataset.analytics){setAnalyticsChoice(target.dataset.analytics);return;}
  if(target.dataset.day){state.day=target.dataset.day;state.selectedStart=null;render();loadPrices();return;}
  if(target.dataset.mode){
    const mode=target.dataset.mode;
    if((mode==='import'&&!state.dayContract.confirmed)||(mode==='export'&&!state.dayContract.exportConfirmed)){state.pendingMode=mode;contractDraft=null;showProfile();return;}
    state.mode=mode;render();return;
  }
  if(target.dataset.resolution){state.resolution=target.dataset.resolution;if(state.resolution==='quarter'&&!nativeQuarters())state.resolution='hour';render();return;}
  if(target.dataset.device){state.device=target.dataset.device;render();return;}
  if(target.dataset.contract){rememberContractDraft();contractDraft.type=target.dataset.contract;showProfile();return;}
  const action=target.dataset.action;if(!action)return;
  if(['report','download-report','print-report','advice'].includes(action)&&hasInvalidInput()){toast('Controleer eerst de gemarkeerde invoer.');$('#main [aria-invalid="true"]')?.focus();return;}
  const actions={
    profile:()=>{contractDraft=null;showProfile();},sources:showSources,privacy:showPrivacy,advice:showAdvice,explain:showExplanation,report:showReport,'download-report':downloadReport,'print-report':()=>window.print(),table:showTable,'close-dialog':closeDialog,'retry-prices':()=>loadPrices({force:true}),
    'go-2027':()=>{closeDialog();location.hash='2027';},
    'market-only':()=>{state.dayContract={...state.dayContract,confirmed:false,exportConfirmed:false};state.mode='market';maybePersist();closeDialog();render();},
    'forget-profile':()=>{try{localStorage.removeItem(brand.storageKey);state.saved=false;const input=$('#save-on-device');if(input)input.checked=false;toast('Bewaard profiel gewist. Je huidige berekening blijft beschikbaar.');}catch{toast('Wissen lukt niet in deze browser.');}},
    'reset-profile':()=>{state.profile={...initialProfile};normalizeProfile();maybePersist();render();toast('De startwaarden voor je scenario zijn hersteld.');},
    'show-result':()=>{const result=$('#calc-results')||$('#battery-results');result?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});},
    'save-plan':()=>{const best=plannerResult();if(best){state.savedPlan={name:devices[state.device].name,window:`${zoneTime(best.start)}–${endTime(best.end)}`,date:dateLabel()};render();toast('Je planning staat klaar voor deze sessie.');}}
  };actions[action]?.();
});
document.addEventListener('submit',event=>{if(event.target.id==='contract-form'){event.preventDefault();applyContract(event.target);}});
document.addEventListener('input',event=>{
  const input=event.target;
  if(input.id==='hour-slider'){updateChart(Number(input.value));return;}
  if(input.dataset.range){const key=input.dataset.range;state.profile[key]=Number(input.value);normalizeProfile();maybePersist();$$('[data-range]').forEach(el=>{el.value=state.profile[el.dataset.range];const output=$('#out-'+el.dataset.range);if(output)output.textContent=fmt(Number(el.value))+'%';});const target=$('[data-range="targetPct"]');if(target)target.min=state.profile.selfUsePct;if($('#calc-results'))$('#calc-results').innerHTML=render2027Results();if($('#battery-results'))$('#battery-results').innerHTML=renderBatteryResults();const mobile=$('.mobile-result-value');if(mobile)mobile.textContent=state.view==='2027'?money(compareSelfUse(state.profile,state.profile.targetPct).optimized.annualVariableCost)+' / jaar':money(batteryResult().annualNetBenefit)+' / jaar';hydrateIcons();return;}
  if(input.dataset.profile)setProfile(input.dataset.profile,input.value===''?NaN:Number(input.value),input);
});
document.addEventListener('change',event=>{
  const input=event.target;
  if(input.dataset.profile&&setProfile(input.dataset.profile,input.value===''?NaN:Number(input.value),input)){if(hasInvalidInput())return;const id=input.id;render();document.getElementById(id)?.focus({preventScroll:true});}
  if(input.dataset.planner){state[input.dataset.planner]=Number(input.value);render();document.getElementById(input.id)?.focus({preventScroll:true});}
  if(input.id==='weather-region'){state.weatherRegion=input.value;loadWeather();}
  if(input.id==='save-on-device'){state.saved=input.checked;if(state.saved){maybePersist();toast('Je rekenprofiel wordt op dit apparaat bewaard.');}else{try{localStorage.removeItem(brand.storageKey);}catch{}toast('Je rekenprofiel wordt niet meer bewaard.');}}
});
$('#app-dialog').addEventListener('click',event=>{if(event.target===$('#app-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
$('#app-dialog').addEventListener('close',()=>{contractDraft=null;state.pendingMode=null;});
window.addEventListener('hashchange',()=>{if($('#app-dialog').open)closeDialog();render();if(['overzicht','planner'].includes(state.view))loadPrices();track('page_view');window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});});
window.addEventListener('resize',()=>{if(state.view==='overzicht'&&$('#price-chart'))updateChart(state.selectedIndex);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['overzicht','planner'].includes(state.view))loadPrices({force:true});});
setInterval(()=>{if(!document.hidden&&['overzicht','planner'].includes(state.view))loadPrices({force:true});},600000);
async function boot() {
  $$('[data-brand]').forEach(el=>el.textContent=brand.name);render();loadPrices();
  try {state.config=await api('/api/config');state.configStatus='ready';state.weatherRegion=state.config.weatherRegions?.[0]?.id||'';loadWeather();renderAnalyticsChoice();track('page_view');}
  catch{state.configStatus='unavailable';}
}
boot();
