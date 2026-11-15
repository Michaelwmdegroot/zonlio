import test from 'node:test';
import assert from 'node:assert/strict';
import {observeOperations} from '../scripts/operations-watchdog.mjs';
const health={ok:true,services:{databaseReady:true},operations:{cronExpected:true,cronStatus:'current'},sources:{prices:{status:'ready'},weather:{status:'ready'}}};
test('watchdog separates expected cron, source readiness and actual database status without mutation or secrets',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});return Response.json({...health,password:'private-response'});};
  const report=await observeOperations({fetchImpl});assert.equal(report.ok,true);assert.equal(report.maintenanceRecorded,false);assert.equal(report.lastMaintenanceAt,null);assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.Authorization,undefined);assert.doesNotMatch(JSON.stringify(report),/private-response/);
  for(const patch of [{operations:{cronExpected:true,cronStatus:'overdue'}},{services:{databaseReady:false}},{sources:{prices:{status:'degraded'}}},{operations:undefined}])assert.equal((await observeOperations({fetchImpl:async()=>Response.json({...health,...patch})})).ok,false);
  assert.equal((await observeOperations({fetchImpl:async()=>Response.json({...health,operations:{cronExpected:false,cronStatus:'not_required'},sources:{}})})).ok,true);
  await assert.rejects(observeOperations({origin:'https://zonlio.nl?secret=value'}),/UNSUPPORTED/);
});
test('watchdog emits only a bounded code after network/response errors',async()=>{
  const report=await observeOperations({fetchImpl:async()=>{throw new Error('private-network-diagnostic');}});assert.equal(report.ok,false);assert.equal(report.error,'HEALTH_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(report),/private-network/);
});

test('independent watch reports persisted maintenance without activating cron or exposing config',async()=>{
  const at='2026-11-14T20:30:00.000Z';
  const fetchImpl=async()=>Response.json({...health,operations:{cronExpected:false,cronStatus:'not_required',lastMaintenanceAt:at}});
  const report=await observeOperations({fetchImpl,now:()=>Date.parse('2026-11-14T20:35:00.000Z')});
  assert.equal(report.ok,true);assert.equal(report.cronExpected,false);
  assert.equal(report.maintenanceRecorded,true);assert.equal(report.lastMaintenanceAt,at);
  assert.equal(report.maintenanceAgeMinutes,5);
  const bad=await observeOperations({fetchImpl:async()=>Response.json({...health,operations:{cronExpected:false,cronStatus:'not_required',lastMaintenanceAt:'private-token'}})});
  assert.equal(bad.maintenanceRecorded,false);assert.equal(bad.lastMaintenanceAt,null);
  assert.doesNotMatch(JSON.stringify(bad),/private-token/);
});


test('independent cron monitor detects stalled proven cron even while ops expectation flag remains off',async()=>{
  const at='2026-11-15T00:20:02.212Z';
  const clock=minutes=>()=>Date.parse(at)+minutes*60000;
  const get=timestamp=>observeOperations({now:clock(timestamp),
    fetchImpl:async()=>Response.json({...health,
      operations:{cronExpected:false,cronStatus:'not_required',lastMaintenanceAt:at}})});
  const fresh=await get(18);
  assert.equal(fresh.ok,true);
  assert.equal(fresh.cronExpected,false);
  assert.equal(fresh.cronStatus,'not_required');
  assert.equal(fresh.heartbeatTracked,true);
  assert.equal(fresh.heartbeatFresh,true);
  assert.equal(fresh.monitoredCronStatus,'current');
  const stale=await get(21);
  assert.equal(stale.ok,false);
  assert.equal(stale.cronExpected,false);
  assert.equal(stale.cronStatus,'not_required');
  assert.equal(stale.heartbeatTracked,true);
  assert.equal(stale.heartbeatFresh,false);
  assert.equal(stale.monitoredCronStatus,'overdue');
  const newInstall=await observeOperations({now:clock(21),
    fetchImpl:async()=>Response.json({...health,operations:{cronExpected:false,cronStatus:'not_required',lastMaintenanceAt:null}})});
  assert.equal(newInstall.ok,true);
  assert.equal(newInstall.heartbeatTracked,false);
  assert.equal(newInstall.monitoredCronStatus,'not_required');
  const future=await observeOperations({now:clock(0),
    fetchImpl:async()=>Response.json({...health,operations:{cronExpected:false,cronStatus:'not_required',lastMaintenanceAt:new Date(clock(5)()).toISOString()}})});
  assert.equal(future.ok,false,'future timestamps beyond two minutes cannot mask a stalled cron');
  assert.doesNotMatch(JSON.stringify(stale),/secret|token|password/i);
});
