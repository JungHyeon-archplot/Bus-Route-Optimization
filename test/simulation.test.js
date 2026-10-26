import test from 'node:test';
import assert from 'node:assert/strict';
import {scenario,validateScenario} from '../src/scenario.js';
import {simulate,uniformWait,busPosition,eventsCsv} from '../src/simulation.js';
test('disconnected final edge is rejected',()=>{const s=structuredClone(scenario);s.edges[5].to='B';assert.throws(()=>validateScenario(s));});
test('station names do not affect assignments or metrics',()=>{
 const s=structuredClone(scenario);s.stops.forEach((p,i)=>p.name='rename'+i);
 for(const mode of ['baseline','staggered'])assert.deepEqual(simulate(s,mode).metrics,simulate(scenario,mode).metrics);
});
test('same fleet, all six stops, no service removal and FIFO reservations',()=>{
 for(const mode of ['baseline','staggered']){
  const r=simulate(scenario,mode);assert.equal(new Set(r.events.map(e=>e.busId)).size,3);
  for(const stop of scenario.stops){
   const events=r.events.filter(e=>e.stopId===stop.id).sort((a,b)=>a.arrival-b.arrival||a.busId-b.busId);
   assert.ok(r.byStop.find(p=>p.id===stop.id).visits>0);
   for(let i=1;i<events.length;i++)assert.ok(events[i].start>=events[i-1].end);
  }
  for(let bus=0;bus<3;bus++){
   const events=r.events.filter(e=>e.busId===bus);
   for(let i=1;i<events.length;i++)assert.ok(events[i].arrival>=events[i-1].end+90);
  }
 }
});
test('reference baseline and staggered queue outcomes',()=>{
 const a=simulate(scenario,'baseline'),b=simulate(scenario,'staggered');
 assert.ok(a.metrics.meanBusDelay>0);assert.equal(b.metrics.meanBusDelay,0);
 assert.equal(a.metrics.maxQueue,2);assert.equal(b.metrics.maxQueue,0);
 assert.equal(a.metrics.visits,b.metrics.visits);
 assert.ok(b.metrics.theoreticalPassengerWait<a.metrics.theoreticalPassengerWait);
});
test('uniform waiting uses next service beyond right boundary',()=>{
 assert.equal(uniformWait([0,720,1440],0,720),360);
 assert.equal(uniformWait([0,240,480,720],0,720),120);
 assert.equal(uniformWait([0,720],600,660),90);
 assert.equal(uniformWait([0],0,720),null);
});
test('playback speed cannot change simulated events or positions at equal simulated time',()=>{
 const r=simulate(scenario,'baseline');
 const sample=(speed)=>{let time=0;for(let i=0;i<600/speed;i++)time+=speed;return busPosition(r,scenario,0,r.windowStart+time);};
 assert.deepEqual(sample(1),sample(15));assert.deepEqual(sample(1),sample(50));
 assert.ok(eventsCsv(r).includes('arrival,start,end,delay'));
});
test('delayed vehicle cannot depart before returning',()=>{
 const s=structuredClone(scenario);s.dwellSec=100;
 const r=simulate(s,'baseline');
 const firsts=r.events.filter(e=>e.busId===0&&e.stopId==='A');
 assert.ok(firsts[1].arrival-firsts[0].arrival>=1140);
});

