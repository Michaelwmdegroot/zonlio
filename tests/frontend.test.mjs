import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePrices,hourlySlots,futurePriceSlots,localDate,addDays} from '../src/api.mjs';
import {renderPriceChart} from '../src/chart.mjs';
import {consumerPriceSlots} from '../src/planner-prices.mjs';

function response(date,intervals) {
  return {status:'available',date,timeZone:'Europe/Amsterdam',source:{name:'Test fixture'},intervals};
}
function interval(start,durationMinutes,marketEurMWh) {
  return {start,durationMinutes,marketEurMWh};
}
function quarterDay(date,start,count) {
  return response(date,Array.from({length:count},(_,index)=>interval(
    new Date(Date.parse(start)+index*900000).toISOString(),15,index-50
  )));
}

test('frontend accepts the server start contract and keeps negative and zero prices',()=>{
  const source=response('2026-11-14',[
    interval('2026-11-13T23:00:00Z',15,-125),
    interval('2026-11-13T23:15:00Z',15,0)
  ]);
  source.intervals.forEach(Object.freeze);Object.freeze(source.intervals);Object.freeze(source);
  const data=normalizePrices(source);
  assert.equal(data.intervals[0].start,'2026-11-13T23:00:00.000Z');
  assert.equal(data.intervals[0].market,-125);
  assert.equal(data.intervals[1].market,0);
  assert.equal(data.intervals[0].hour,0);
  assert.equal(data.contiguous,true);
  assert.equal(source.intervals[0].marketEurMWh,-125);
  const chart=renderPriceChart({slots:data.intervals.map(slot=>({...slot,displayValue:slot.market/10})),mode:'market',resolution:'quarter',width:290,selectedIndex:1});
  assert.match(chart,/viewBox="0 0 290 220"/);
  assert.match(chart,/#72b6a1/);
  assert.match(chart,/zero-line/);
  assert.doesNotMatch(chart,/NaN|Infinity/);
});

test('frontend also accepts the originally documented startISO field',()=>{
  const data=normalizePrices(response('2026-11-14',[
    {startISO:'2026-11-13T23:00:00+00:00',durationMinutes:15,marketEurMWh:42}
  ]));
  assert.equal(data.intervals[0].start,'2026-11-13T23:00:00.000Z');
  assert.equal(data.intervals[0].market,42);
});

test('bad prices are rejected and unpublished days never become zero-price data',()=>{
  assert.throws(()=>normalizePrices(response('2026-11-14',[interval('2026-11-13T23:00:00Z',15,NaN)])));
  assert.throws(()=>normalizePrices(response('2026-11-14',[interval('2026-11-13T23:00:00',15,25)])));
  assert.throws(()=>normalizePrices(response('2026-11-14',[interval('2026-11-13T23:00:00Z',0,25)])));
  assert.deepEqual(normalizePrices({status:'not_published',date:'2026-11-15'}).intervals,[]);
});

test('hour aggregation weights duration and retains partial coverage without filling a gap',()=>{
  const data=normalizePrices(response('2026-11-14',[
    interval('2026-11-14T00:00:00Z',15,-120),
    interval('2026-11-14T00:15:00Z',45,40),
    interval('2026-11-14T01:00:00Z',15,-60),
    interval('2026-11-14T01:45:00Z',15,-100)
  ]));
  assert.equal(data.contiguous,false);
  const hours=hourlySlots(data.intervals);
  assert.equal(hours.length,2);
  assert.equal(hours[0].market,0);
  assert.equal(hours[0].durationMinutes,60);
  assert.equal(hours[1].market,-80);
  assert.equal(hours[1].durationMinutes,30);
});

test('an interval crossing the hour boundary contributes its actual minutes to both hours',()=>{
  const data=normalizePrices(response('2026-11-14',[
    interval('2026-11-14T00:00:00Z',45,0),
    interval('2026-11-14T00:45:00Z',30,120),
    interval('2026-11-14T01:15:00Z',45,40)
  ]));
  const hours=hourlySlots(data.intervals);
  assert.deepEqual(hours.map(hour=>hour.market),[30,60]);
  assert.deepEqual(hours.map(hour=>hour.durationMinutes),[60,60]);
});

test('Dutch spring and autumn delivery days keep 23 and 25 separate hours',()=>{
  const spring=hourlySlots(normalizePrices(quarterDay('2026-03-29','2026-03-28T23:00:00Z',92)).intervals);
  const autumn=hourlySlots(normalizePrices(quarterDay('2026-10-25','2026-10-24T22:00:00Z',100)).intervals);
  assert.equal(spring.length,23);
  assert.equal(spring.filter(hour=>hour.hour===2).length,0);
  assert.equal(autumn.length,25);
  const repeated=autumn.filter(hour=>hour.hour===2);
  assert.equal(repeated.length,2);
  assert.notEqual(repeated[0].start,repeated[1].start);
  assert.equal(Date.parse(repeated[1].start)-Date.parse(repeated[0].start),3600000);
  assert.equal(spring[0].market,-48.5);
  assert.equal(autumn[0].durationMinutes,60);
});

test('planner excludes an already-started interval and other Dutch delivery days',()=>{
  const slots=[
    {start:'2026-11-13T22:45:00Z'},
    {start:'2026-11-14T10:00:00Z'},
    {start:'2026-11-14T10:15:00Z'},
    {start:'2026-11-14T23:00:00Z'}
  ];
  const now=Date.parse('2026-11-14T10:07:00Z');
  assert.deepEqual(futurePriceSlots(slots,'2026-11-14',now).map(slot=>slot.start),['2026-11-14T10:15:00Z']);
  assert.deepEqual(futurePriceSlots(slots,'2026-11-15',now).map(slot=>slot.start),['2026-11-14T23:00:00Z']);
  assert.deepEqual(futurePriceSlots(slots,'2026-11-13',now),[]);
  assert.equal(futurePriceSlots(slots,'2026-11-14',Date.parse('2026-11-14T10:00:00Z'))[0].start,'2026-11-14T10:00:00Z');
});

test('planner compares actual instants through the repeated autumn clock hour',()=>{
  const slots=[
    {start:'2026-10-25T00:15:00Z'},
    {start:'2026-10-25T00:45:00Z'},
    {start:'2026-10-25T01:00:00Z'}
  ];
  assert.deepEqual(futurePriceSlots(slots,'2026-10-25',Date.parse('2026-10-25T00:30:00Z')).map(slot=>slot.start),[
    '2026-10-25T00:45:00Z','2026-10-25T01:00:00Z'
  ]);
  assert.equal(localDate('2026-11-13T23:00:00Z'),'2026-11-14');
  assert.equal(addDays('2026-03-29',1),'2026-03-30');
});

test('quarter graph keeps confirmed hourly contract settlement instead of inventing intra-hour savings',()=>{
  const data=normalizePrices(response('2026-11-14',[0,100,200,300].map((market,i)=>interval(new Date(Date.parse('2026-11-14T08:00:00Z')+i*900000).toISOString(),15,market))));
  const contract={type:'dynamic',confirmed:true,resolution:'hour',markup:.02,energyTax:.1,vat:.21};
  const quarters=consumerPriceSlots(data.intervals,contract,{resolution:'quarter',mode:'import'});
  assert.deepEqual(quarters.map(s=>Number(s.price.toFixed(4))),[.3267,.3267,.3267,.3267]);
  const hours=consumerPriceSlots(data.intervals,contract,{resolution:'hour',mode:'import'});
  assert.equal(hours.length,1);assert.equal(hours[0].price,quarters[0].price);
  assert.deepEqual(consumerPriceSlots(data.intervals,contract,{resolution:'quarter',mode:'market'}).map(s=>s.displayValue),[0,10,20,30]);
  const native=consumerPriceSlots(data.intervals,{...contract,resolution:'quarter'},{resolution:'quarter',mode:'import'});
  assert.notEqual(native[0].price,native[1].price);
});

test('missing settlement confirmation cannot display a personal import tariff',()=>{
  const data=normalizePrices(response('2026-11-14',[interval('2026-11-14T08:00:00Z',60,100),interval('2026-11-14T09:00:00Z',60,200)]));
  const old={type:'dynamic',confirmed:true,markup:.02,energyTax:.1,vat:.21};
  assert.ok(consumerPriceSlots(data.intervals,old,{mode:'import'}).every(s=>s.displayValue===null));
  const fixed={type:'fixed',confirmed:true,importRate:.31};
  assert.deepEqual(consumerPriceSlots(data.intervals,fixed,{mode:'import'}).map(s=>s.price),[.31,.31]);
});

test('hourly contract prices preserve separate repeated Dutch autumn hours',()=>{
  const data=normalizePrices(response('2026-10-25',Array.from({length:8},(_,i)=>interval(new Date(Date.parse('2026-10-25T00:00:00Z')+i*900000).toISOString(),15,i<4?100:200))));
  const contract={type:'dynamic',confirmed:true,resolution:'hour',markup:0,energyTax:0,vat:0};
  assert.deepEqual(consumerPriceSlots(data.intervals,contract,{resolution:'quarter',mode:'import'}).map(s=>s.price),[.1,.1,.1,.1,.2,.2,.2,.2]);
});
