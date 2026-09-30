import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRoute,positionAt,createSim,step,runFor,summarizeLog} from '../src/routesim.js';
// A 2 km out-and-back line; the stop sits on the outbound leg only.
const line=Array.from({length:21},(_,i)=>[37.56,127+i*0.00113]);
const path=[...line,...line.slice(0,-1).reverse()];
const route=(id,term=10)=>({id,termMinutes:term,path,stops:[{arsId:'X',lat:37.56,lng:127+10*0.00113},{arsId:'END',lat:37.56,lng:127+20*0.00113}]});
test('stops snap to the outbound leg and positions interpolate along the path',()=>{
 const prep=prepareRoute(route('a'));
 assert.ok(Math.abs(prep.length-4000)<30);
 assert.ok(prep.stopAt.X<prep.length/2);
 const [lat,lng]=positionAt(prep,prep.stopAt.X);assert.ok(Math.abs(lng-(127+10*0.00113))<1e-6&&lat===37.56);
});
test('one berth: two buses reaching the stop together are served one dwell apart; pooled berths serve both at once',()=>{
 const run=rule=>{
  const preps=[prepareRoute(route('a')),prepareRoute(route('b'))];
  const sim=createSim(preps,{focus:'X',rule,berths:2,speed:10,dwell:25,seed:3});
  for(const bus of sim.buses){bus.u=bus.next-5;} // everyone arrives in the same second
  for(let t=0;t<120;t++)step(sim,1);
  return sim.stats;
 };
 const single=run('single'),pooled=run('pooled');
 assert.equal(single.served,pooled.served);
 assert.ok(single.waited>=1&&single.totalWait>=24);
 assert.equal(pooled.waited,0);
});
test('bus count follows route length, speed and headway',()=>{
 const sim=createSim([prepareRoute(route('a',2))],{focus:'X',rule:'single',speed:10});
 assert.equal(sim.buses.length,Math.round(4000/(10*120)));
});
test('spread timing: equal-headway routes reach the stop k·H/K apart, so one berth never queues',()=>{
 const preps=['a','b','c'].map(id=>prepareRoute(route(id,6)));
 const random=runFor(preps,{focus:'X',rule:'single',speed:10,dwell:60,seed:2},3600);
 const spread=runFor(preps,{focus:'X',rule:'single',speed:10,dwell:60,timing:'spread'},3600);
 assert.ok(Math.abs(spread.served-random.served)<=3); // same buses; only where the 1-hour window cuts differs
 assert.equal(spread.waited,0);
 assert.ok(random.waited>0);
});
test('log: every bus at the stop is recorded, waits add up, and the blocker is the bus in front',()=>{
 const preps=[prepareRoute(route('a')),prepareRoute(route('b'))];
 const sim=createSim(preps,{focus:'X',rule:'single',speed:10,dwell:25});
 const [first,second]=sim.buses.filter(bus=>bus.route==='a').slice(0,1).concat(sim.buses.filter(bus=>bus.route==='b').slice(0,1));
 first.u=first.next-5;second.u=second.next-15; // a arrives 1 s before b
 for(let t=0;t<60;t++)step(sim,1);
 const late=sim.log.find(entry=>entry.route==='b');
 assert.equal(late.blockedBy,'a');assert.ok(late.wait>=23&&late.wait<=25);assert.equal(late.queueOnArrival,0);
 assert.equal(sim.log.find(entry=>entry.route==='a').blockedBy,null);
 const run=runFor(preps,{focus:'X',rule:'single',speed:10,dwell:60,seed:2},3600);
 assert.equal(run.log.length,run.served);
 assert.ok(Math.abs(run.log.reduce((sum,entry)=>sum+entry.wait,0)-run.totalWait)<1e-6);
 const summary=summarizeLog(run.log);
 assert.equal(Object.values(summary.byRoute).reduce((sum,r)=>sum+r.waited,0),run.waited);
 assert.ok(summary.pairs.every(pair=>pair.blocker&&pair.blocker!=='?'));
});
test('results do not depend on the order the routes are listed in',()=>{
 const preps=['a','b','c'].map(id=>prepareRoute(route(id,5)));
 const one=runFor(preps,{focus:'X',rule:'single',speed:10,dwell:40,seed:4},3600);
 const other=runFor([...preps].reverse(),{focus:'X',rule:'single',speed:10,dwell:40,seed:4},3600);
 assert.deepEqual(one,other);
});
