// Buses moving along real route geometry, queuing only at one focus stop.
// Speed is an assumed average that already includes ordinary stops; only the focus stop's dwell and queue are explicit.
const M_PER_DEG=111320;
function meters([a,b],[c,d]){const x=(d-b)*M_PER_DEG*Math.cos((a+c)/2*Math.PI/180),y=(c-a)*M_PER_DEG;return Math.hypot(x,y);}
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

export function prepareRoute(route){
 const cum=[0];
 for(let i=1;i<route.path.length;i++)cum.push(cum[i-1]+meters(route.path[i-1],route.path[i]));
 // Walk stops in sequence; each snaps to the first close approach ahead of the previous stop,
 // so a two-way road never snaps to the return leg and long highway gaps still work.
 const stopAt={};let index=0;
 const d=(j,stop)=>meters(route.path[j],[stop.lat,stop.lng]);
 for(const stop of route.stops){
  let j=index;
  while(j<cum.length&&d(j,stop)>=150)j++;
  if(j===cum.length)continue;
  while(j+1<cum.length&&d(j+1,stop)<d(j,stop))j++;
  index=j;stopAt[stop.arsId]??=cum[j];
 }
 return {route,cum,length:cum.at(-1),stopAt};
}

export function positionAt(prep,s){
 const {cum,route:{path}}=prep,x=((s%prep.length)+prep.length)%prep.length;
 let lo=0,hi=cum.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(cum[mid]<=x)lo=mid;else hi=mid;}
 const span=cum[hi]-cum[lo]||1,f=(x-cum[lo])/span;
 return [path[lo][0]+(path[hi][0]-path[lo][0])*f,path[lo][1]+(path[hi][1]-path[lo][1])*f];
}

// rule: 'single' | 'pooled' | 'colored'
// overtake: true = 정차면이 서로 독립(뒤차가 앞차를 지나 들어가고 나감). false = 중앙차로처럼 추월차로가 없음:
//   정차면 0이 맨 앞(출구), 맨 뒤가 입구. 줄의 맨 앞 버스만 들어가고, 지나갈 자리가 모두 비어야 그 자리에 닿으며,
//   승하차를 마쳐도 앞자리에 버스가 서 있으면 나가지 못한다.
// dwellJitter: 정차 시간을 dwell×(1±jitter) 사이에서 뽑는다(앞차가 늦어지는 상황). 0이면 항상 dwell.
// meterGap: 진입 간격 통제. 정류장 meterAt m 앞(직전 정류장·신호)에서 버스를 도착 순서대로 meterGap초 간격으로만 내보낸다.
// cascade: 연쇄 지연. 노선의 모든 정류장에서 승하차하고, 정차 시간 = 문 여닫기 + 승하차 × (앞차와의 간격 ÷ 배차간격).
//   늦은 버스는 손님이 쌓여 더 늦어지고 뒤차는 따라붙는다(Daganzo 2009의 몰림 연쇄). 구간마다 속도가 ±noise만큼 흔들린다.
// startJitter: 차고지 출발이 계획 간격에서 ±startJitter/2×간격만큼 어긋난다(실제 첫 배차의 불규칙).
//   평균 운행 시간이 cascade 없을 때와 같도록 정류장 사이 주행 속도를 노선마다 맞춘다(차량 수·배차는 그대로).
// signal: 정류장 signalAt m 앞 교차로 신호(주기 cycle초, 버스 방향 녹색 green초). tsp: 버스우선신호 — 녹색 연장 tspExtend초,
//   적색 단축 tspEarly초.
// holdRatio: 배차간격 유지(BMS). 정류장 holdAt m 앞, 중앙차로에 들어가기 전 정류장에서 같은 노선 앞차가 지나간 지
//   holdRatio×배차간격이 안 됐으면 그때까지 기다린다(Daganzo 2009 간격 기반 대기). 다른 노선은 지나갈 수 있다.
// zones: 분리 정류장 수(1 = 하나의 정류장). zones>1이면 berths는 분리 정류장마다의 정차면 수이고, zoneOf[노선]이 그 노선이 서는
//   분리 정류장(0 = 맨 앞). passing: true = 분리 정류장 사이를 지나갈 공간이 있어 서로 독립(TCQSM 분리 정류장),
//   false = 한 줄 차로라 앞 정류장으로 가는 버스도 뒤 정류장 버스에 막히고, 뒤 정류장 버스도 앞 정류장 버스가 떠나야 나간다.
//   추월 불가(overtake:false)에서만 쓴다.
// timing: 'random' = each route starts at an unrelated phase (today's situation);
//         'spread' = the team's 9/27 idea: route k first reaches the focus stop at k·H/K (H = mean headway, K = routes), like 0·4·8 min.
export function createSim(preps,{focus,rule,assignment={},berths=1,speed=15/3.6,dwell=25,seed=1,timing='random',overtake=true,dwellJitter=0,meterGap=0,meterAt=300,
 zones=1,zoneOf={},passing=false,cascade=false,stopDwell=20,door=6,noise=.15,startJitter=0,signal=false,signalAt=120,cycle=150,green=60,tsp=false,tspExtend=10,tspEarly=10,holdRatio=0,holdAt=1500}){
 const random=rng(seed),buses=[];
 const snapped=preps.filter(prep=>prep.stopAt[focus]!==undefined).map(prep=>prep.route.id).sort();
 const meanHeadway=snapped.length?preps.filter(prep=>snapped.includes(prep.route.id)).reduce((sum,prep)=>sum+(prep.route.termMinutes??10)*60,0)/snapped.length:0;
 const runSpeed=new Map();
 // Fixed order so the same seed gives the same start positions however the caller lists the routes.
 for(const prep of [...preps].sort((a,b)=>a.route.id.localeCompare(b.route.id))){
  const f=prep.stopAt[focus];
  const headway=(prep.route.termMinutes??10)*60,n=Math.max(1,Math.round(prep.length/(speed*headway))),gap=prep.length/n;
  const others=Object.entries(prep.stopAt).filter(([id])=>id!==focus).map(([,at])=>at).sort((a,b)=>a-b);
  const lap=prep.length/speed;
  runSpeed.set(prep,cascade?prep.length/Math.max(lap-others.length*stopDwell,lap*.4):speed);
  const k=snapped.indexOf(prep.route.id);
  const phase=timing==='spread'&&k>=0
   ?((f-speed*(k*meanHeadway/snapped.length))%gap+gap)%gap
   :random()*gap;
  for(let i=0;i<n;i++){
   const u=phase+i*gap+(startJitter?startJitter*gap*(random()-.5):0);
   const bus={route:prep.route.id,vehicle:i+1,prep,headway,others,u,vf:1,state:'run',next:f===undefined?Infinity:f+Math.ceil((u-f)/prep.length)*prep.length};
   buses.push(bus);
  }
 }
 const count=(rule==='single'?1:Math.max(1,berths))*Math.max(1,zones);
 const sim={buses,rule,assignment,zones:Math.max(1,zones),zb:rule==='single'?1:Math.max(1,berths),zoneOf,passing,speed,runSpeed,dwell,overtake,dwellJitter,meterGap,meterAt,cascade,stopDwell,door,noise,signal,signalAt,cycle,green,tsp,tspExtend,tspEarly,holdRatio,holdAt,
  random,lastRelease:-Infinity,lastDep:new Map(),lastPass:new Map(),lastFocus:new Map(),departures:{},time:0,
  berthFree:Array(count).fill(0),occupant:Array(count).fill(null),queue:[],log:[],
  stats:{served:0,waited:0,totalWait:0,maxQueue:0,exitWait:0,hold:0,signalWait:0,delay:0}};
 for(const bus of buses)plan(sim,bus,true);
 return sim;
}

// 이번 바퀴에 지날 지점들(일반 정류장·배차 유지·신호·진입 통제·대상 정류장)을 위치 순서로 만든다.
export function plan(sim,bus,first=false){
 const F=bus.next,len=bus.prep.length,events=[];
 if(F===Infinity){bus.events=[];return;}
 if(sim.cascade)for(const at of bus.others){const p=at+Math.ceil((F-len-at)/len)*len;events.push({at:p<=F-len?p+len:p,kind:'stop',key:bus.route+'|'+at});}
 if(sim.holdRatio)events.push({at:F-sim.holdAt,kind:'hold'});
 if(sim.signal)events.push({at:F-sim.signalAt,kind:'signal'});
 if(sim.meterGap)events.push({at:F-sim.meterAt,kind:'meter'});
 bus.events=events.filter(e=>e.at>F-len&&e.at<F&&(!first||e.at>bus.u)).sort((a,b)=>a.at-b.at);
 bus.events.push({at:F,kind:'focus'});
}

function wait(sim,bus,seconds,kind){
 if(seconds<=0)return false;
 bus.state='hold';bus.releaseAt=sim.time+seconds;
 if(kind==='signal')sim.stats.signalWait+=seconds;else{sim.stats.hold+=seconds;bus.hold=(bus.hold??0)+seconds;}
 return true;
}

// 지점에 닿았을 때. true면 버스가 거기서 멈춘다.
function arrive(sim,bus,e){
 if(e.kind==='stop'){
  const gap=sim.time-(sim.lastDep.get(e.key)??sim.time-bus.headway);
  const d=sim.door+(sim.stopDwell-sim.door)*Math.min(gap/bus.headway,3);
  sim.lastDep.set(e.key,sim.time+d);
  bus.vf=1+sim.noise*(2*sim.random()-1);
  bus.state='hold';bus.releaseAt=sim.time+d;return true;
 }
 if(e.kind==='hold'){
  const target=(sim.lastPass.get(bus.route)??-Infinity)+sim.holdRatio*bus.headway;
  sim.lastPass.set(bus.route,Math.max(sim.time,target));
  return wait(sim,bus,target-sim.time,'hold');
 }
 if(e.kind==='signal'){
  const phase=((sim.time%sim.cycle)+sim.cycle)%sim.cycle;
  if(phase<sim.green||(sim.tsp&&phase<sim.green+sim.tspExtend))return false;
  return wait(sim,bus,Math.max(0,sim.cycle-phase-(sim.tsp?sim.tspEarly:0)),'signal');
 }
 if(e.kind==='meter'){
  bus.releaseAt=Math.max(sim.time,sim.lastRelease+sim.meterGap);sim.lastRelease=bus.releaseAt;
  return wait(sim,bus,bus.releaseAt-sim.time,'hold');
 }
 // focus
 bus.state='queue';bus.since=sim.time;
 if(!sim.overtake){
  // 한 줄 차로: 바로 앞에 줄 선 버스, 없으면 입구 쪽 자리를 막고 있는 버스.
  bus.queueOnArrival=sim.queue.length;
  bus.blockedBy=sim.queue.at(-1)?.route??sim.occupant.findLast(Boolean)?.route??null;
 }else{
  // Log who is in the way at arrival: the last bus queued for the same space, else the bus standing in it.
  const berth=berthFor(sim,bus),ahead=sim.queue.filter(other=>sim.rule==='pooled'||berthFor(sim,other)===berth);
  bus.queueOnArrival=ahead.length;
  bus.blockedBy=ahead.length?ahead.at(-1).route:sim.berthFree[berth]>sim.time?sim.occupant[berth]?.route??null:null;
 }
 sim.queue.push(bus);
 return true;
}

function dwellFor(sim,bus){
 let d=sim.dwell;
 if(sim.cascade){const gap=sim.time-(sim.lastFocus.get(bus.route)??sim.time-bus.headway);d=sim.door+(sim.dwell-sim.door)*Math.min(gap/bus.headway,3);}
 return sim.dwellJitter?d*(1+sim.dwellJitter*(2*sim.random()-1)):d;
}

function depart(sim,bus){
 (sim.departures[bus.route]??=[]).push(sim.time);sim.lastFocus.set(bus.route,sim.time);
 bus.state='run';bus.next+=bus.prep.length;plan(sim,bus);
}

// 추월 불가: 맨 뒤(입구)부터 이어서 비어 있는 자리만 닿을 수 있다. 빈 곳 아무 데나는 그중 가장 앞자리로 간다.
// 막힘을 따지는 범위: 지나갈 공간이 있는 분리 정류장은 자기 정류장 안, 그 밖에는 정류장 전체.
function segment(sim,berth){
 if(sim.zones>1&&sim.passing){const z=Math.floor(berth/sim.zb);return [z*sim.zb,(z+1)*sim.zb];}
 return [0,sim.occupant.length];
}
function reachable(sim,berth){const [,end]=segment(sim,berth);for(let b=berth;b<end;b++)if(sim.occupant[b])return false;return true;}
// 그 버스가 설 수 있는 자리 중 닿을 수 있는 가장 앞자리.
function target(sim,bus){
 if(sim.zones===1&&sim.rule==='colored')return sim.assignment[bus.route]??0;
 const z=sim.zones>1?(sim.zoneOf[bus.route]??0):0,lo=sim.zones>1?z*sim.zb:0,hi=sim.zones>1?lo+sim.zb:sim.occupant.length;
 for(let b=lo;b<hi;b++)if(reachable(sim,b))return b;
 return -1;
}

function berthFor(sim,bus){
 if(sim.rule==='colored')return sim.assignment[bus.route]??0;
 const t=Math.min(...sim.berthFree);return sim.berthFree.indexOf(t);
}

export function step(sim,dt){
 sim.time+=dt;
 for(const bus of sim.buses){
  if(sim.overtake&&bus.state==='dwell'&&sim.time>=bus.until)depart(sim,bus);
  if(bus.state==='hold'&&sim.time>=bus.releaseAt)bus.state='run';
  if(bus.state!=='run')continue;
  const u=bus.u+sim.runSpeed.get(bus.prep)*bus.vf*dt;
  let stopped=false;
  while(bus.events.length&&bus.events[0].at<=u){
   const e=bus.events.shift();bus.u=e.at;
   if(arrive(sim,bus,e)){stopped=true;break;}
  }
  if(!stopped)bus.u=u;
 }
 if(!sim.overtake)return stepLane(sim);
 // FIFO per berth: a bus is admitted once its berth is free; colored buses wait only for their own berth.
 let admitted=true;
 while(admitted){
  admitted=false;
  for(const bus of sim.queue){
   const berth=berthFor(sim,bus);
   if(sim.queue.some(other=>other!==bus&&other.since<bus.since&&berthFor(sim,other)===berth))continue;
   if(sim.berthFree[berth]>sim.time)continue;
   const dwell=dwellFor(sim,bus);
   sim.berthFree[berth]=sim.time+dwell;admit(sim,bus,berth,dwell);
   admitted=true;break;
  }
 }
 sim.stats.maxQueue=Math.max(sim.stats.maxQueue,sim.queue.length);
 return sim;
}

function total(sim){sim.stats.delay=sim.stats.totalWait+sim.stats.exitWait+sim.stats.hold+sim.stats.signalWait;}

function admit(sim,bus,berth,dwell){
 const wait=sim.time-bus.since;
 sim.occupant[berth]=bus;bus.state='dwell';bus.until=sim.time+dwell;bus.berth=berth;
 bus.entry={arrival:bus.since,route:bus.route,vehicle:bus.vehicle,berth,queueOnArrival:bus.queueOnArrival,wait,blockedBy:wait>0.5?bus.blockedBy:null,hold:bus.hold??0,exitWait:0};
 sim.log.push(bus.entry);bus.hold=0;
 sim.queue.splice(sim.queue.indexOf(bus),1);
 sim.stats.served++;sim.stats.totalWait+=wait;if(wait>0.5)sim.stats.waited++;
 total(sim);
}

// 추월 불가 정류장: 앞자리부터 나가고(앞이 막히면 대기), 줄의 맨 앞 버스만 닿을 수 있는 자리로 들어간다.
function stepLane(sim){
 let moved=true;
 while(moved){
  moved=false;
  for(let b=0;b<sim.occupant.length;b++){
   const bus=sim.occupant[b];
   if(!bus||sim.time<bus.until)continue;
   if(sim.occupant.slice(segment(sim,b)[0],b).some(Boolean)){bus.state='blocked';continue;}
   const stuck=sim.time-bus.until;bus.entry.exitWait=stuck;sim.stats.exitWait+=stuck;
   sim.occupant[b]=null;depart(sim,bus);moved=true;
  }
  // 한 줄이면 맨 앞 버스만, 지나갈 공간이 있는 분리 정류장이면 정류장마다 그 정류장 줄의 맨 앞 버스가 들어간다.
  const heads=sim.zones>1&&sim.passing
   ?[...new Set(sim.queue.map(bus=>sim.zoneOf[bus.route]??0))].map(z=>sim.queue.find(bus=>(sim.zoneOf[bus.route]??0)===z))
   :sim.queue.slice(0,1);
  for(const head of heads){
   const berth=target(sim,head);
   if(berth>=0&&reachable(sim,berth)){admit(sim,head,berth,dwellFor(sim,head));moved=true;}
  }
 }
 total(sim);
 sim.stats.maxQueue=Math.max(sim.stats.maxQueue,sim.queue.length);
 return sim;
}

// 승객 대기시간: 승객이 아무 때나 정류장에 온다면 평균 대기 = Σh² / (2Σh) (h = 같은 노선 버스가 떠난 간격).
// 배차가 고르면 h/2, 몰리면 커진다. warmup초 이전에 시작한 간격은 뺀다.
// planned는 같은 간격들이 계획 배차 H로 왔을 때의 값이다(2시간에 한 번도 안 오는 긴 배차 노선은 양쪽에서 함께 빠진다).
export function passengerWait(departures,headways={},warmup=1200){
 let sq=0,sum=0,planSq=0,planSum=0;
 for(const [route,times] of Object.entries(departures)){
  const t=[...times].sort((a,b)=>a-b),H=headways[route];
  for(let i=1;i<t.length;i++)if(t[i-1]>=warmup){
   const h=t[i]-t[i-1];sq+=h*h;sum+=h;
   if(H){planSq+=H*H;planSum+=H;}
  }
 }
 return {actual:sum?sq/(2*sum):0,planned:planSum?planSq/(2*planSum):0};
}

// Runs the same scenario headless for `seconds`; returns the stats plus the per-bus log at the focus stop.
export function runFor(preps,options,seconds=7200){
 const sim=createSim(preps,options);
 for(let t=0;t<seconds;t++)step(sim,1);
 // 승객 대기는 이 정류장에 서는 노선만 센다.
 const headways=Object.fromEntries(sim.buses.filter(bus=>bus.next!==Infinity).map(bus=>[bus.route,bus.headway]));
 return {...sim.stats,log:sim.log,departures:sim.departures,passenger:passengerWait(sim.departures,headways)};
}

// Where the waiting came from: per route, and per blocking pair (who stood in front of whom).
export function summarizeLog(log){
 const byRoute={},pairs={};
 for(const entry of log){
  const r=byRoute[entry.route]??={arrivals:0,waited:0,totalWait:0};
  r.arrivals++;
  if(entry.wait>0.5){
   r.waited++;r.totalWait+=entry.wait;
   const key=(entry.blockedBy??'?')+'>'+entry.route;
   const p=pairs[key]??={blocker:entry.blockedBy,blocked:entry.route,count:0,totalWait:0};
   p.count++;p.totalWait+=entry.wait;
  }
 }
 return {byRoute,pairs:Object.values(pairs).sort((a,b)=>b.totalWait-a.totalWait)};
}
