import test from 'node:test';
import assert from 'node:assert/strict';
import { observeProduction } from '../scripts/production-smoke.mjs';
import { RELEASE_ID } from '../server/release.mjs';
function stub({release=RELEASE_ID,leak=false,brokenAsset=false,fetchFail=false}={}) {
  const calls=[];
  return {calls,fetchImpl:async(url,options)=>{
    calls.push({url,options});if(fetchFail)throw new Error('private diagnostic');
    const path=new URL(url).pathname;
    if(path==='/api/admin/readiness'||path==='/api/member/profile')return new Response('{}',{status:leak?200:401,headers:{'Content-Type':'application/json'}});
    if(path==='/api/health')return Response.json({ok:true,releaseId:release,services:{databaseReady:true,operatorNameMatches:false,operatorContactMatches:true,secret:'never-output'}});
    if(path==='/api/config')return Response.json({leadEnabled:false,operatorConfigured:false,members:{accountsEnabled:false,subscriptionsEnabled:false,dailySendEnabled:false,secret:'never-output'}});
    if(path.endsWith('.css'))return new Response('--zonlio-blue: blue',{status:brokenAsset?404:200,headers:{'Content-Type':'text/css'}});
    if(path.endsWith('.mjs'))return new Response('export const ok=true;',{headers:{'Content-Type':'text/javascript'}});
    return new Response('<title>Mijn Zonlio</title><link href="/src/design-system.css">',{headers:{'Content-Type':'text/html'}});
  }};
}
test('public observation reads only known GET routes and distinguishes closed features from broken deployment',async()=>{
  const f=stub();const report=await observeProduction(f);
  assert.equal(report.publicChecksPassed,true);assert.equal(report.productionEndToEndVerified,false);
  assert.equal(report.configuration.accountsEnabled,false);assert.equal(report.configuration.operatorNameMatches,false);
  assert.equal(f.calls.length,12);assert.ok(f.calls.every(call=>call.options.method==='GET'&&call.options.redirect==='manual'&&!call.options.body&&!call.options.headers.Authorization));
  assert.doesNotMatch(JSON.stringify(report),/never-output/);
});
test('old release, inaccessible private route or missing stylesheet fails the public gate',async()=>{
  for(const options of [{release:'old-release'},{leak:true},{brokenAsset:true},{fetchFail:true}]) {
    const report=await observeProduction(stub(options));assert.equal(report.publicChecksPassed,false);
    assert.doesNotMatch(JSON.stringify(report),/private diagnostic/);
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
