import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDayPlan,dueEdition} from '../server/dayplan.mjs';
import {cleanEnergyProfile} from '../src/member-schema.mjs';
function day(date,start,count=96){return {status:'available',date,stale:false,source:{name:'QA'},intervals:Array.from({length:count},(_,i)=>({start:new Date(Date.parse(start)+i*900000).toISOString(),durationMinutes:15,marketEurMWh:i<48?-100:100}))};}
const profile={devices:['washing','dishwasher'],startHour:8,endHour:22};
test('evening and morning scheduler windows follow Amsterdam including DST, not server UTC',()=>{
 assert.equal(dueEdition(Date.parse('2026-11-14T17:00:00Z')).edition,'evening');assert.equal(dueEdition(Date.parse('2026-07-14T16:00:00Z')).edition,'evening');
 assert.equal(dueEdition(Date.parse('2026-11-14T06:00:00Z')).edition,'morning');assert.equal(dueEdition(Date.parse('2026-11-14T20:00:00Z')),null);
});
test('daily plan labels negative market costs, does not invent savings, rejects missing/stale/partial days',()=>{
 const raw=day('2026-11-15','2026-11-15T00:00:00+01:00');const plan=makeDayPlan(raw,profile,Date.parse('2026-11-14T17:00:00Z'));
 assert.equal(plan.status,'available');assert.equal(plan.priceBasis,'market');assert.ok(plan.plans[0].cost<0);assert.equal(plan.savings,undefined);
 assert.equal(makeDayPlan({...raw,stale:true},profile).status,'unavailable');assert.equal(makeDayPlan({...raw,intervals:raw.intervals.slice(1)},profile).status,'unavailable');
 assert.equal(makeDayPlan({status:'not_published',date:'2026-11-15'},profile).status,'unavailable');
});
test('a fixed tariff has no fabricated cheap-hour advantage and hourly contracts use hourly aggregation',()=>{
 const raw=day('2026-11-15','2026-11-15T00:00:00+01:00');const at=Date.parse('2026-11-14T17:00:00Z');
 const fixed=makeDayPlan(raw,{...profile,contract:{type:'fixed',confirmed:true,importRate:.3}},at);assert.equal(fixed.priceBasis,'fixed');assert.ok(Math.abs(fixed.plans[0].cost-.24)<1e-10);assert.match(fixed.basisLabel,/evenveel/);
 const dynamic=makeDayPlan(raw,{...profile,contract:{type:'dynamic',confirmed:true,resolution:'hour',markup:.02,energyTax:.1,vat:.21}},at);assert.equal(dynamic.priceBasis,'contract');assert.equal(new Date(dynamic.plans[0].start).getUTCMinutes(),0);
});
test('92/100-quarter DST days are valid and morning plans never recommend started intervals',()=>{
 for(const [date,start,count] of [['2026-03-29','2026-03-29T00:00:00+01:00',92],['2026-10-25','2026-10-25T00:00:00+02:00',100]]){
  const raw=day(date,start,count),now=Date.parse(start)+7.5*3600000;const result=makeDayPlan(raw,profile,now);assert.equal(result.status,'available');assert.ok(result.plans.every(p=>Date.parse(p.start)>=now));
 }
});
test('profiles strictly validate consent-independent data, no arbitrary contact fields',()=>{
 for(const value of [{name:'QA'},{devices:['unsupported']},{startHour:22,endHour:8},{scenario:{constructor:1}},{contract:{type:'dynamic',confirmed:true,markup:0,energyTax:0,vat:0}}])assert.throws(()=>cleanEnergyProfile(value),TypeError);
 assert.equal(cleanEnergyProfile({scenario:{annualUse:0}}).scenario.annualUse,0);
});
