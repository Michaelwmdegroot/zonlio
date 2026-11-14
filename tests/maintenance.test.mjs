import test from 'node:test';
import assert from 'node:assert/strict';
import {runMaintenance} from '../scripts/maintenance.mjs';
const env={NODE_ENV:'production',APP_URL:'https://zonlio.nl',CRON_SECRET:'synthetic-cron-secret-longer-than-32',SESSION_SECRET:'different-session-secret-longer-than-32'};
test('cron sends only a protected POST to canonical origin and reports bounded successful evidence',async()=>{
  const calls=[];
  const result=await runMaintenance({env,fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return Response.json({ok:true,maintenanceCompleted:true,processed:2,sent:1,failed:1,members:{sent:{accepted:1}},private:'not-logged'});}});
  assert.equal(calls[0].url,'https://zonlio.nl/api/tasks/maintenance');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.Authorization,`Bearer ${env.CRON_SECRET}`);assert.equal(result.memberAccepted,1);assert.doesNotMatch(JSON.stringify(result),/not-logged|synthetic-cron/);
});
test('cron rejects wrong origin, credentials in URLs, shared secret and HTTP200 without a completion',async()=>{
  for(const patch of [{APP_URL:'https://elsewhere.example.invalid'},{APP_URL:'https://user:password@zonlio.nl'},{PUBLIC_URL:'https://zonlio.nl',APP_URL:'https://elsewhere.example.invalid'},{CRON_SECRET:env.SESSION_SECRET},{CRON_SECRET:'short'}])await assert.rejects(runMaintenance({env:{...env,...patch},fetchImpl:async()=>assert.fail('No request for invalid config')}));
  await assert.rejects(runMaintenance({env,fetchImpl:async()=>Response.json({ok:true})}),/MAINTENANCE_NOT_CONFIRMED/);
  assert.equal((await runMaintenance({env,fetchImpl:async()=>Response.json({status:'busy'},{status:202})})).status,'busy');
});
