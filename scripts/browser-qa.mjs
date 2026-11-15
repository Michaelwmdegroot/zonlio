/** Isolated browser acceptance: synthetic source data, in-memory SQLite and a fake SMTP transport.
 * No production credentials, DNS, source API calls or real messages are used.
 * npm run test:browser -- chromium | webkit (install browsers with npx playwright install first).
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit,expect} from '@playwright/test';
import {createAppServer} from '../server.mjs';
import {createBackend} from '../server/backend.mjs';
import {hashPassword} from '../server/auth.mjs';
import {OPERATOR} from '../server/operator.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const engine=process.argv[2]||'chromium';
if(!['chromium','webkit'].includes(engine))throw new Error('Choose chromium or webkit.');
const directory=resolve(root,'.artifacts/browser',engine);await mkdir(directory,{recursive:true});
const checks=[],errors=[],messages=[],events=[];
const now=Date.parse('2026-11-14T12:00:00Z');
const port=Number(process.env.ZONLIO_BROWSER_QA_PORT||4179);const base=`http://127.0.0.1:${port}`;
const password='synthetic-browser-only-password';
const env={NODE_ENV:'test',SQLITE_PATH:':memory:',PUBLIC_URL:base,ADMIN_EMAIL:'admin@example.invalid',ADMIN_PASSWORD_HASH:await hashPassword(password),SESSION_SECRET:'synthetic-browser-session-secret-32-characters',CRON_SECRET:'synthetic-browser-cron-secret-32-characters',LEAD_CONTROLLER_NAME:OPERATOR.name,LEAD_CONTROLLER_CONFIRMED:'true',LEAD_ENABLED:'true',HOUSING_ADVICE_ENABLED:'true',MEMBER_ACCOUNTS_ENABLED:'true',DAYMAIL_SIGNUP_ENABLED:'true',DAYMAIL_SEND_ENABLED:'false',PORTAL_EXPORT_ENABLED:'false',SMTP_DAILY_LIMIT:'100',SMTP_USER:'sender@example.invalid',LEAD_NOTIFY_TO:'team@example.invalid'};
const market={getDay:async date=>({status:'available',date,timeZone:'Europe/Amsterdam',stale:false,fetchedAt:new Date(now).toISOString(),source:{name:'Synthetic browser QA',attribution:'Synthetic browser QA only',license:'QA'},intervals:Array.from({length:96},(_,i)=>({start:new Date(Date.parse(date+'T00:00:00+01:00')+i*900000).toISOString(),durationMinutes:15,marketEurMWh:(i%16)*10-20}))}),getStatus:()=>({status:'ready',lastSuccessAt:new Date(now).toISOString()})};
const weather={getRegion:async()=>({status:'unavailable',hours:[]}),getStatus:()=>({status:'idle'})};
const mailTransport={verify:async()=>true,sendMail:async message=>{messages.push(message);return {accepted:[message.to],rejected:[]};}};
const backend=await createBackend({env,now:()=>now,mailTransport,market,weather,logger:()=>{}});
const originalEvent=backend.store.recordEvent.bind(backend.store);backend.store.recordEvent=async data=>{events.push(data);return originalEvent(data);};
const server=await createAppServer({preferDist:false,env,backend,market,weather});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});
let browser,activePage;
function check(ok,message,details){checks.push({pass:Boolean(ok),message,...(details?{details}:{})});if(!ok)throw new Error(message+' '+JSON.stringify(details));}
async function overflow(page,label){
 const dimensions=await page.evaluate(()=>({viewport:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth,
  dialogs:[...document.querySelectorAll('dialog[open]')].map(el=>{const box=el.getBoundingClientRect();return {id:el.id,left:box.left,right:box.right,client:el.clientWidth,scroll:el.scrollWidth};}),
  offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right>innerWidth+2&&getComputedStyle(el).position!=='fixed';}).slice(0,6).map(el=>{
   const selector=node=>node?node.tagName+(node.id?'#'+node.id:'')+(typeof node.className==='string'&&node.className?'.'+node.className.trim().replace(/\s+/g,'.'):''):null;const r=el.getBoundingClientRect();
   return {element:selector(el),parent:selector(el.parentElement),ancestor:selector(el.parentElement?.parentElement),left:r.left,right:r.right,width:r.width};
  })}));
 check(dimensions.html<=dimensions.viewport+1&&dimensions.body<=dimensions.viewport+1&&dimensions.dialogs.every(dialog=>dialog.left>=-1&&dialog.right<=dimensions.viewport+1&&dialog.scroll<=dialog.client+1),label,dimensions);
}
async function newPage(context){const page=await context.newPage();activePage=page;page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));await page.clock.setFixedTime(new Date(now));return page;}
try{
 const executable=process.env.ZONLIO_BROWSER_EXECUTABLE;
 browser=await ({chromium,webkit})[engine].launch({headless:true,...(executable?{executablePath:executable}:{})});
 for(const width of [320,375,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await newPage(context);
  for(const route of ['/kennis','/stroomprijzen','/slim-stroomverbruik','/zonnepanelen-2027','/terugleveren','/thuisbatterij-berekenen','/#overzicht','/#planner','/#2027','/#batterij','/mijn','/admin']){
   await page.goto(base+route);await page.waitForLoadState('networkidle');await overflow(page,`${width}px ${route} has no horizontal overflow`);
   check(await page.locator('h1').count()===1,`${width}px ${route} has one H1`);
  }
  await page.goto(base+'/#2027');await page.locator('[data-action="report"]').click();await page.getByRole('heading',{name:'Jouw woningplan',exact:true}).waitFor();await overflow(page,`${width}px home plan dialog has no overflow`);
  check(await page.locator('#dialog-content input[name="email"]').count()===0,`${width}px home plan is visible before contact input`);
  if(width===390||width===1440)await page.screenshot({path:`${directory}/woningplan-${width}.png`});
  await page.keyboard.press('Escape');await expect(page.locator('#app-dialog')).not.toHaveAttribute('open','');check(await page.locator('#app-dialog').evaluate(e=>!e.open),`${width}px Escape closes home plan`);
  await page.goto(base+'/kennis');if(width===390||width===1440)await page.screenshot({path:`${directory}/kennis-${width}.png`,fullPage:true});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await newPage(context);
 await page.goto(base+'/#2027');await page.waitForLoadState('networkidle');events.length=0;
 await page.locator('#f-annualUse').fill('4200');await page.locator('#f-annualUse').press('Tab');await page.waitForTimeout(80);check(events.length===0,'No interaction analytics before consent');
 await page.locator('[data-analytics="no"]').click();await page.locator('#f-annualUse').fill('4300');await page.locator('#f-annualUse').press('Tab');await page.waitForTimeout(80);check(events.length===0,'No interaction analytics after refusal');
 await page.locator('.app-footer [data-action="privacy"]').click();await page.locator('[data-analytics="yes"]').click();await page.locator('#dialog-content [data-action="close-dialog"]').click();await page.locator('#f-annualUse').fill('4400');await page.locator('#f-annualUse').press('Tab');await expect.poll(()=>events.some(x=>x.event==='calculator_complete'&&x.path==='2027')).toBe(true);check(true,'Meaningful calculation is counted after consent despite earlier refusal');
 check(events.every(x=>Object.keys(x).every(k=>['event','sessionHash','path'].includes(k))),'Stored analytics contains only allowlisted type, module and pseudonym');
 await page.locator('.app-footer [data-action="privacy"]').click();await page.locator('[data-analytics="no"]').click();await page.locator('#dialog-content [data-action="close-dialog"]').click();const before=events.length;await page.locator('#f-annualUse').fill('4500');await page.locator('#f-annualUse').press('Tab');await page.waitForTimeout(80);check(events.length===before,'Withdrawal stops new interaction events');
 await page.locator('[data-action="profile"]').first().click();await page.locator('#c-markup').fill('0.02');await page.locator('#c-energyTax').fill('0.1');await page.locator('#c-vat').fill('21');await page.locator('[name="confirmed"]').check();check(await page.locator('#contract-resolution').evaluate(el=>!el.checkValidity()),'Settlement period requires an explicit choice');await page.locator('#contract-resolution').selectOption('hour');await page.locator('#contract-form button[type="submit"]').click();check(await page.locator('#app-dialog').evaluate(e=>!e.open),'Confirmed hourly contract is applied');
 await page.evaluate(()=>{location.hash='planner';});await page.locator('[data-day="tomorrow"]').click();await page.locator('.planner-time').waitFor();check((await page.locator('.planner-time').innerText()).includes(':00'),'Hourly contract produces a whole-hour plan');await page.locator('[data-action="save-plan"]').click();check(await page.locator('.chosen-plan').count()===1,'Chosen plan remains visible without contact fields');
 // One synthetic housing dossier passes through the actual API, SQLite and fake SMTP.
 await page.evaluate(()=>{location.hash='batterij';});await page.locator('[data-action="advice"]').first().click();await page.locator('#housing-postcode').fill('1234 AB');await page.locator('#housing-houseNumber').fill('10');await page.locator('#housing-street').fill('Synthetische Teststraat');await page.locator('#housing-city').fill('Testplaats');await page.locator('#housing-submit').click();await page.locator('#housing-name').fill('Synthetische Browsertest');await page.locator('#housing-phone').fill('0612345678');await page.locator('#housing-email').fill('housing@example.invalid');await page.locator('#housing-submit').click();await page.locator('#housing-form [name="contactRequested"]').check();await page.locator('#housing-submit').click();await page.getByRole('heading',{name:'Je woningvraag staat klaar.'}).waitFor();check(true,'Synthetic housing route confirms actual SQLite persistence');
 await expect.poll(()=>messages.filter(m=>String(m.subject).includes('adviesaanvraag')).length).toBe(2);check(true,'Two simulated SMTP messages are accepted for one housing dossier');
 const rows=await backend.store.listLeads({limit:10});check(rows.leads.length===1,'Exactly one synthetic lead is stored');
 const lead=rows.leads[0];check(lead.shareScenario===false,'Scenario is not shared by default');
 // Real test admin session, CSRF update, narrow layouts and status persistence.
 await page.goto(base+'/admin');await page.locator('#admin-email').fill('admin@example.invalid');await page.locator('#admin-password').fill(password);await page.locator('#login-form button').click();await page.getByRole('heading',{name:'De aanvragen',exact:true}).waitFor();await expect(page.locator('#ops-title')).toBeVisible();await expect(page.getByRole('heading',{name:'Bewaren en herstellen',exact:true})).toBeVisible();check(true,'Operations and privacy controls are visible in authenticated administration');
 for(const width of [320,375,390,1440]){await page.setViewportSize({width,height:900});await overflow(page,`${width}px authenticated admin no page overflow`);}
 await page.locator('[data-open-lead]').first().click();await expect(page.locator('#admin-dialog')).toContainText('Verzending voor dit dossier');
 await expect(page.locator('#admin-dialog')).toContainText('Interne NIVO-melding');
 await expect(page.locator('#admin-dialog')).toContainText('Bevestiging aan aanvrager');
 check(true,'Admin can inspect both stored SMTP queue results without exposing message body');
 await page.locator('#detail-status').selectOption('contacted');await page.locator('#detail-note').fill('Synthetische QA-notitie, geen productiecontact.');await page.locator('#lead-status-form button[type="submit"]').click();await expect.poll(async()=> (await backend.store.getLead(lead.id)).lead.status).toBe('contacted');
 // The selected value exists before saving; the history note proves that openLead finished rendering the saved revision.
 await expect(page.locator('#admin-dialog .lead-history')).toContainText('Synthetische QA-notitie, geen productiecontact.');await expect(page.locator('#detail-status')).toHaveValue('contacted');check(true,'Admin status and synthetic note persist through authenticated API');
 await page.setViewportSize({width:320,height:900});await page.locator('#admin-dialog').getByText('Contactgegevens corrigeren',{exact:true}).click();await page.locator('#privacy-name').fill('Gecorrigeerde synthetische browsertest');await page.locator('#lead-correction-form [name="requestVerified"]').check();await expect(page.locator('#lead-correction-form button[type="submit"]')).toBeEnabled();await overflow(page,'320px contact correction dialog and content have no horizontal overflow');await page.locator('#lead-correction-form button[type="submit"]').click();await expect.poll(async()=> (await backend.store.getLead(lead.id)).lead.name).toBe('Gecorrigeerde synthetische browsertest');
 await expect(page.locator('#admin-dialog-title')).toHaveText('Gecorrigeerde synthetische browsertest');check((await backend.store.getLead(lead.id)).lead.contactRequested===true,'Verified correction preserves existing contact consent');await page.locator('#admin-dialog').getByText('Persoonsgegevens uit dit dossier wissen',{exact:true}).click();await page.locator('#erasure-reference').fill(lead.reference);await page.locator('#lead-erasure-form [name="requestVerified"]').check();await expect(page.locator('#lead-erasure-form button[type="submit"]')).toBeEnabled();await overflow(page,'320px verified erasure dialog and content have no horizontal overflow');await page.locator('#lead-erasure-form button[type="submit"]').click();await expect.poll(async()=> (await backend.store.getLead(lead.id)).lead.contactRequested).toBe(false);const erased=(await backend.store.getLead(lead.id)).lead;check(erased.status==='withdrawn'&&!erased.email&&!erased.phone&&erased.name==='[Gegevens verwijderd]','Verified synthetic erasure removes contact data and stops the dossier');await expect(page.locator('#admin-dialog')).toContainText('Persoonsgegevens zijn gewist');await overflow(page,'320px erased dossier has no horizontal overflow');await page.keyboard.press('Escape');
 await page.locator('[data-admin-action="logout"]').click();await page.locator('#login-form').waitFor();check(true,'Admin logout returns to protected login');
 // Real magic link through fake mail, explicit POST confirmation and profile/session persistence.
 let verificationPosts=0;page.on('request',request=>{if(request.method()==='POST'&&request.url()===base+'/api/member/verify')verificationPosts++;});
 await page.goto(base+'/mijn');await page.locator('#email').fill('member@example.invalid');await page.locator('#member-login button').click();await expect.poll(()=>messages.some(m=>m.to==='member@example.invalid')).toBe(true);
 const memberMessage=messages.find(m=>m.to==='member@example.invalid');const token=memberMessage.text.match(/#bevestig=([A-Za-z0-9_.-]+)/)?.[1];check(Boolean(token),'Fake inbox contains a member link');
 // A link opened from a mail client loads a document. A hash-only goto from /mijn would keep the old page running.
 await page.goto('about:blank');await page.goto(base+'/mijn#bevestig='+token);await expect(page.locator('[data-member-action="confirm-token"]')).toBeVisible();await expect(page).toHaveURL(base+'/mijn');
 const beforeConfirmation=await page.evaluate(async()=> (await fetch('/api/member/session')).json());check(verificationPosts===0&&beforeConfirmation.authenticated===false&&await page.locator('#member-profile').count()===0,'External mail-link document load awaits confirmation without creating a session');
 // A copied mail link must also work in an already open Mijn Zonlio document.
 await page.goto('about:blank');await page.goto(base+'/mijn');await page.locator('#member-login').waitFor();await page.goto(base+'/mijn#bevestig='+token);await expect(page.locator('[data-member-action="confirm-token"]')).toBeVisible();await expect(page).toHaveURL(base+'/mijn');
 const beforeHashConfirmation=await page.evaluate(async()=> (await fetch('/api/member/session')).json());check(verificationPosts===0&&beforeHashConfirmation.authenticated===false&&await page.locator('#member-profile').count()===0,'Same-document mail-link navigation awaits confirmation without creating a session');await page.locator('[data-member-action="confirm-token"]').click();await page.locator('#member-profile').waitFor();check(verificationPosts===1,'One explicit click sends exactly one member verification POST');
 await page.locator('#annualUse').fill('4000');await page.locator('#annualSolar').fill('3500');await page.locator('#member-profile input[name="devices"][value="washing"]').check();await page.locator('#member-profile button:not([type])').click();await expect(page.locator('#member-notice')).toContainText('opgeslagen');await expect(page.locator('#member-plan')).toContainText('Wasmachine');check(true,'Profile save reloads its dayplan immediately');
 for(const width of [320,375,390,1440]){await page.setViewportSize({width,height:900});await overflow(page,`${width}px authenticated member no page overflow`);}
 await page.locator('#annualUse').fill('4321');await page.locator('#member-preferences [name="consent"]').check();await page.locator('#member-preferences button[value="active"]').click();await expect(page.locator('#member-notice')).toContainText('mailvoorkeuren');check(await page.locator('#annualUse').inputValue()==='4321','Subscription change preserves unsaved profile input');await page.locator('#member-preferences button[value="paused"]').click();await expect(page.locator('#member-preferences')).toContainText('Gepauzeerd');await page.locator('#member-preferences button[value="unsubscribed"]').click();await expect(page.locator('#member-preferences')).toContainText('Afgemeld');check(true,'Dayplan can activate, pause and unsubscribe through actual test APIs');
 await page.reload();await page.locator('#member-profile').waitFor();check(await page.locator('#annualUse').inputValue()==='4000','Only explicitly saved profile input persists after reload');
 // A default-closed public configuration is a separate UI state, never a production flag change.
 await page.route('**/api/member/config',route=>route.fulfill({json:{accountsEnabled:false,subscriptionsEnabled:false}}));await page.route('**/api/member/session',route=>route.fulfill({json:{authenticated:false}}));await page.reload();await page.locator('#member-login').waitFor();check(await page.locator('#member-login button').isDisabled()&&await page.locator('#member-subscribe button').isDisabled(),'Closed public services retain disabled intake controls');
 check(errors.length===0,'No browser JavaScript errors',errors);await context.close();
}catch(error){errors.push(String(error.message));console.error(String(error.message));if(activePage&&!activePage.isClosed())try{await activePage.screenshot({path:`${directory}/failure.png`,fullPage:true});}catch{/* Keep the original assertion as the failure reason. */}}
finally{
 if(browser)await browser.close();await new Promise(done=>{server.close(done);server.closeAllConnections();});
 await writeFile(resolve(directory,'results.json'),JSON.stringify({engine,scope:'Local synthetic API, actual SQLite, fake SMTP; no production proof',checks,errors},null,2));
 console.log(JSON.stringify({engine,checks:checks.length,passed:checks.filter(x=>x.pass).length,errors}));if(errors.length)process.exitCode=1;
}
