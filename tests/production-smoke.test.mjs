import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { observeProduction } from '../scripts/production-smoke.mjs';
import { RELEASE_ID } from '../server/release.mjs';
const landingFiles = {'/kennis':'knowledge','/stroomprijzen':'prices','/slim-stroomverbruik':'planning','/zonnepanelen-2027':'solar-2027','/terugleveren':'export','/thuisbatterij-berekenen':'battery'};
const landingHtml = Object.fromEntries(Object.entries(landingFiles).map(([path,file])=>[path,readFileSync(new URL(`../pages/${file}.html`,import.meta.url),'utf8')]));
const privatePaths = ['/api/admin/readiness','/api/member/profile','/api/admin/operations','/api/admin/privacy/retention','/api/admin/privacy/recovery'];
const htmlResponse = html => new Response(html,{headers:{'Content-Type':'text/html'}});
function stub({release=RELEASE_ID,leak=false,brokenAsset=false,fetchFail=false,responses={}}={}) {
  const calls=[];
  return {calls,fetchImpl:async(url,options)=>{
    calls.push({url,options});if(fetchFail)throw new Error('private diagnostic');
    const path=new URL(url).pathname;
    if(responses[path])return responses[path].clone();
    if(privatePaths.includes(path))return Response.json({error:'Log in om verder te gaan.'},{status:leak?200:401});
    if(path==='/api/health')return Response.json({ok:true,releaseId:release,services:{databaseReady:true,operatorNameMatches:false,operatorContactMatches:true,secret:'never-output'}});
    if(path==='/api/config')return Response.json({leadEnabled:false,operatorConfigured:false,members:{accountsEnabled:false,subscriptionsEnabled:false,dailySendEnabled:false,secret:'never-output'}});
    if(path.endsWith('.css'))return new Response('--zonlio-blue: blue',{status:brokenAsset?404:200,headers:{'Content-Type':'text/css'}});
    if(path==='/src/admin.mjs')return new Response("export const workbench='lead-queue-filter focus-attention state.queue';",{headers:{'Content-Type':'text/javascript'}});
    if(path==='/src/admin-acceptance.mjs')return new Response("export const acceptancePayload='admin-acceptance-form';",{headers:{'Content-Type':'text/javascript'}});
    if(path.endsWith('.mjs'))return new Response('export const ok=true;',{headers:{'Content-Type':'text/javascript'}});
    return htmlResponse(landingHtml[path]||'<title>Mijn Zonlio</title><link href="/src/design-system.css">');
  }};
}
test('public observation reads only known GET routes and distinguishes closed features from broken deployment',async()=>{
  const f=stub();const report=await observeProduction(f);
  assert.equal(report.publicChecksPassed,true);assert.equal(report.productionEndToEndVerified,false);
  assert.equal(report.configuration.accountsEnabled,false);assert.equal(report.configuration.operatorNameMatches,false);
  assert.equal(f.calls.length,23);assert.ok(f.calls.every(call=>call.options.method==='GET'&&call.options.redirect==='manual'&&!call.options.body&&!Object.keys(call.options.headers).some(key=>/^(?:authorization|cookie)$/i.test(key))));
  assert.equal(report.expectedRelease,RELEASE_ID);
  for(const path of Object.keys(landingHtml))assert.deepEqual(report.endpoints[path],{status:200,expectedStatus:200,passed:true,canonicalMatches:true,staticContentPresent:true});
  for(const path of privatePaths)assert.equal(report.endpoints[path].passed,true,path);
  assert.doesNotMatch(JSON.stringify(report),/never-output/);
});
test('old release, publicly accessible private route or missing stylesheet fails the public gate',async()=>{
  for(const options of [{release:'old-release'},{leak:true},{brokenAsset:true},{fetchFail:true}]) {
    const report=await observeProduction(stub(options));assert.equal(report.publicChecksPassed,false);
    assert.doesNotMatch(JSON.stringify(report),/private diagnostic/);
  }
});
test('every static landing must declare its own single canonical in the document head',async()=>{
  for(const [path,html] of Object.entries(landingHtml)){
    const canonical=`<link rel="canonical" href="https://zonlio.nl${path}">`;
    for(const changed of [html.replace(canonical,'<link rel="canonical" href="https://zonlio.nl/">'),html.replace(canonical,canonical+canonical),html.replace(canonical,'').replace('</body>',canonical+'</body>')]){
      const report=await observeProduction(stub({responses:{[path]:htmlResponse(changed)}}));
      assert.equal(report.publicChecksPassed,false,path);assert.equal(report.endpoints[path].canonicalMatches,false,path);
      assert.equal(report.endpoints[path].staticContentPresent,true,path);
    }
    const reordered=html.replace(canonical,`<link href='https://zonlio.nl${path}' rel='canonical'>`);
    assert.equal((await observeProduction(stub({responses:{[path]:htmlResponse(reordered)}}))).publicChecksPassed,true,path);
  }
});
test('a 200 SPA shell or heading-only document does not prove the static consumer landing',async()=>{
  for(const [path,html] of Object.entries(landingHtml)){
    const heading=html.match(/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/i)[0];
    const empty=html.replace(/<main(?:\s[^>]*)?>[\s\S]*?<\/main>/i,`<main>${heading}</main>`);
    const emptyReport=await observeProduction(stub({responses:{[path]:htmlResponse(empty)}}));
    assert.equal(emptyReport.endpoints[path].canonicalMatches,true,path);assert.equal(emptyReport.endpoints[path].staticContentPresent,false,path);assert.equal(emptyReport.publicChecksPassed,false);
    const shell=htmlResponse('<title>Zonlio</title><link href="/src/design-system.css"><div id="app"></div>');
    const shellReport=await observeProduction(stub({responses:{[path]:shell}}));
    assert.equal(shellReport.endpoints[path].passed,false,path);assert.equal(shellReport.publicChecksPassed,false);
  }
});
test('private operations and privacy probes require a 401 JSON error without private fields',async()=>{
  for(const path of privatePaths){
    for(const response of [Response.json({error:'Log in.',privateRecord:'never-echo-private-record'},{status:401}),new Response('never-echo-private-record',{status:401,headers:{'Content-Type':'text/html'}}),Response.json({error:'Log in.'},{status:200})]){
      const report=await observeProduction(stub({responses:{[path]:response}}));
      assert.equal(report.endpoints[path].passed,false,path);assert.equal(report.publicChecksPassed,false);
      assert.doesNotMatch(JSON.stringify(report),/never-echo-private-record/);
    }
  }
});
test('observer does not follow redirects or print arbitrary raw responses',async()=>{
  const report=await observeProduction({fetchImpl:async()=>new Response('sensitive response',{status:302,headers:{Location:'https://external.invalid'}})});
  assert.equal(report.publicChecksPassed,false);assert.doesNotMatch(JSON.stringify(report),/sensitive response|external.invalid/);
  await assert.rejects(observeProduction({origin:'https://user:pass@zonlio.nl'}),/UNSUPPORTED/);
});
test('oversized bodies fail closed with a bounded diagnostic',async()=>{
  const report=await observeProduction({fetchImpl:async()=>new Response('x'.repeat(270000),{headers:{'Content-Type':'application/json'}})});
  assert.equal(report.publicChecksPassed,false);assert.equal(report.endpoints['/api/health'].error,'RESPONSE_TOO_LARGE');
});

test('live workbench script must contain queue controls before declaring release ready',async()=>{
  const noWorkbench=new Response('export const unrelated=true;',{headers:{'Content-Type':'text/javascript'}});
  const result=await observeProduction(stub({responses:{'/src/admin.mjs':noWorkbench}}));
  assert.equal(result.publicChecksPassed,false);
  assert.equal(result.endpoints['/src/admin.mjs'].workbenchPresent,false);
  assert.equal(result.endpoints['/src/admin.mjs'].passed,false);
});

test('production marker and owner acceptance asset distinguish a deployed release from stale application files', async()=>{
  const stale=new Response('export const oldAdmin=true;',{headers:{'Content-Type':'text/javascript'}});
  const report=await observeProduction(stub({responses:{'/src/admin-acceptance.mjs':stale}}));
  assert.equal(report.publicChecksPassed,false);
  assert.equal(report.endpoints['/src/admin-acceptance.mjs'].ownerAcceptanceAssetPresent,false);
  assert.equal(report.endpoints['/src/admin-acceptance.mjs'].passed,false);
  const missing=new Response('Not Found',{status:404,headers:{'Content-Type':'text/plain'}});
  const failed=await observeProduction(stub({responses:{'/src/admin-acceptance.mjs':missing}}));
  assert.equal(failed.publicChecksPassed,false);
});
