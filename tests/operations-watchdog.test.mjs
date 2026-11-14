import test from 'node:test';
import assert from 'node:assert/strict';
import {observeOperations} from '../scripts/operations-watchdog.mjs';
const health={ok:true,services:{databaseReady:true},operations:{cronExpected:true,cronStatus:'current'},sources:{prices:{status:'ready'},weather:{status:'ready'}}};
test('watchdog separates expected cron, source readiness and actual database status without mutation or secrets',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});return Response.json({...health,password:'private-response'});};
  const report=await observeOperations({fetchImpl});assert.equal(report.ok,true);assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.Authorization,undefined);assert.doesNotMatch(JSON.stringify(report),/private-response/);
  for(const patch of [{operations:{cronExpected:true,cronStatus:'overdue'}},{services:{databaseReady:false}},{sources:{prices:{status:'degraded'}}},{operations:undefined}])assert.equal((await observeOperations({fetchImpl:async()=>Response.json({...health,...patch})})).ok,false);
  assert.equal((await observeOperations({fetchImpl:async()=>Response.json({...health,operations:{cronExpected:false,cronStatus:'not_required'},sources:{}})})).ok,true);
  await assert.rejects(observeOperations({origin:'https://zonlio.nl?secret=value'}),/UNSUPPORTED/);
});
test('watchdog emits only a bounded code after network/response errors',async()=>{
  const report=await observeOperations({fetchImpl:async()=>{throw new Error('private-network-diagnostic');}});assert.equal(report.ok,false);assert.equal(report.error,'HEALTH_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(report),/private-network/);
});
