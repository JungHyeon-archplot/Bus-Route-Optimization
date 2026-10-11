import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRoute,positionAt,createSim,step,runFor,summarizeLog,passengerWait,plan} from '../src/routesim.js';
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
// 추월 불가 차로: 3대가 같은 순간 도착, 자리 2곳.
const lane=(rule,options={})=>{
 const preps=['a','b','c'].map(id=>prepareRoute(route(id)));
 const sim=createSim(preps,{focus:'X',rule,berths:2,speed:10,dwell:25,overtake:false,assignment:{a:0,b:1,c:0},...options});
 const firsts=['a','b','c'].map(id=>sim.buses.find(bus=>bus.route===id));
 firsts.forEach((bus,i)=>{bus.u=bus.next-5-10*i;}); // a, b, c 순서로 1초 간격 도착
 for(const bus of sim.buses)if(!firsts.includes(bus))bus.u=bus.next-3000;
 for(let t=0;t<200;t++)step(sim,1);
 return sim;
};
test('추월 불가: 빈 곳 아무 데나는 앞자리부터 채우고, 뒷자리 버스는 앞차가 떠나야 나간다',()=>{
 const sim=lane('pooled',{dwellJitter:0});
 const a=sim.log.find(e=>e.route==='a'),b=sim.log.find(e=>e.route==='b'),c=sim.log.find(e=>e.route==='c');
 assert.equal(a.berth,0);assert.equal(b.berth,1);assert.equal(c.wait>=23,true);
 assert.equal(sim.stats.delay,sim.stats.totalWait+sim.stats.exitWait+sim.stats.hold);
});
test('추월 불가: 앞차 정차가 길어지면 뒤차는 승하차를 마쳐도 갇힌다',()=>{
 const preps=['a','b'].map(id=>prepareRoute(route(id)));
 const sim=createSim(preps,{focus:'X',rule:'pooled',berths:2,speed:10,dwell:25,overtake:false});
 const [a,b]=['a','b'].map(id=>sim.buses.find(bus=>bus.route===id));
 for(const bus of sim.buses)bus.u=bus.next-3000;
 a.u=a.next-5;b.u=b.next-15;
 step(sim,1);step(sim,1);a.until=sim.time+60; // 앞차(a, 0번 자리)만 60초 정차
 for(let t=0;t<120;t++)step(sim,1);
 const entry=sim.log.find(e=>e.route==='b');
 assert.ok(entry.exitWait>=30,'b는 a가 떠날 때까지 갇혀야 함: '+entry.exitWait);
});
test('추월 불가 + 노선별 지정: 뒷자리 버스가 서 있으면 앞자리 배정 버스는 들어가지 못한다',()=>{
 const preps=['a','b'].map(id=>prepareRoute(route(id)));
 const sim=createSim(preps,{focus:'X',rule:'colored',assignment:{a:1,b:0},berths:2,speed:10,dwell:25,overtake:false});
 const [a,b]=['a','b'].map(id=>sim.buses.find(bus=>bus.route===id));
 for(const bus of sim.buses)bus.u=bus.next-3000;
 a.u=a.next-5;b.u=b.next-15; // a가 뒷자리(1)에 먼저 섬, b는 앞자리(0) 배정
 for(let t=0;t<80;t++)step(sim,1);
 assert.ok(sim.log.find(e=>e.route==='b').wait>=23);
});
test('진입 간격 통제: 몰려 온 버스를 간격을 두고 내보내 정류장 앞 줄은 없어지고 기다림은 상류로 옮겨진다',()=>{
 const preps=['a','b','c'].map(id=>prepareRoute(route(id,6)));
 const base={focus:'X',rule:'single',speed:10,dwell:30,seed:2,overtake:false};
 const free=runFor(preps,base,3600),metered=runFor(preps,{...base,meterGap:35},3600);
 assert.ok(metered.totalWait<free.totalWait);
 assert.ok(metered.hold>0);
 assert.ok(metered.maxQueue<=free.maxQueue);
});
test('승객 대기: 간격이 고르면 h/2, 몰리면 더 길다',()=>{
 assert.equal(passengerWait({a:[0,600,1200,1800]},{a:600},0).actual,300);
 const bunched=passengerWait({a:[0,60,1200,1260,2400]},{a:600},0).actual;
 assert.ok(bunched>500,'몰리면 대기 증가: '+bunched);
});
test('연쇄 지연: 모든 정류장에서 승하차하고, 평균 운행 시간은 그대로 유지된다',()=>{
 const stops=Array.from({length:9},(_,i)=>({arsId:'S'+i,lat:37.56,lng:127+(i*2+1)*0.00113}));
 const r=id=>({...route(id,6),stops:[...stops.slice(0,5),{arsId:'X',lat:37.56,lng:127+10*0.00113},...stops.slice(5)]});
 const preps=['a','b'].map(id=>prepareRoute(r(id)));
 const base={focus:'X',rule:'pooled',berths:2,speed:10,dwell:30,seed:3,overtake:false};
 const plain=runFor(preps,base,3600),cascade=runFor(preps,{...base,cascade:true},3600);
 assert.ok(Math.abs(cascade.served-plain.served)<=3,`같은 차량이 비슷하게 돈다: ${plain.served} vs ${cascade.served}`);
 assert.ok(cascade.passenger.actual>0&&cascade.passenger.planned===180);
});
test('버스우선신호: 신호 대기가 줄어든다',()=>{
 const preps=['a','b','c'].map(id=>prepareRoute(route(id,5)));
 const base={focus:'X',rule:'pooled',berths:2,speed:10,dwell:30,seed:2,overtake:false,signal:true};
 const off=runFor(preps,base,3600),on=runFor(preps,{...base,tsp:true},3600);
 assert.ok(off.signalWait>0&&on.signalWait<off.signalWait);
});
test('배차간격 유지: 같은 노선 앞차와 너무 붙으면 기다린다',()=>{
 const preps=[prepareRoute(route('a',2))];
 const sim=createSim(preps,{focus:'X',rule:'single',speed:10,dwell:20,holdRatio:.8,holdAt:500});
 const [b1,b2]=sim.buses;
 for(const bus of sim.buses){bus.u=bus.next-3000;plan(sim,bus,true);}
 b1.u=b1.next-505;b2.u=b2.next-515; // 1초 차이로 통제 지점 도착
 for(let t=0;t<3;t++)step(sim,1);
 assert.equal(b2.state,'hold');assert.ok(b2.releaseAt-sim.time>80); // 배차 120초의 0.8
});
test('분리 정류장: 지나갈 공간이 있으면 뒤 정류장 버스가 앞 정류장 버스를 막지 않는다',()=>{
 const run=passing=>{
  const preps=['a','b'].map(id=>prepareRoute(route(id)));
  const sim=createSim(preps,{focus:'X',rule:'pooled',berths:1,zones:2,zoneOf:{a:1,b:0},passing,speed:10,dwell:25,overtake:false});
  const [a,b]=['a','b'].map(id=>sim.buses.find(bus=>bus.route===id));
  for(const bus of sim.buses)bus.u=bus.next-3000;
  a.u=a.next-5;b.u=b.next-15; // 뒤 정류장(1) 버스 a가 먼저 서고, 앞 정류장(0) 버스 b가 1초 뒤 도착
  for(let t=0;t<80;t++)step(sim,1);
  return sim.log.find(e=>e.route==='b').wait;
 };
 assert.ok(run(true)<1,'추월 공간 있음: 바로 앞 정류장에 섬');
 assert.ok(run(false)>=23,'추월 공간 없음: 뒤 정류장 버스가 떠날 때까지 기다림');
});
