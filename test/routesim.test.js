import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRoute,positionAt,createSim,step} from '../src/routesim.js';
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
