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
// timing: 'random' = each route starts at an unrelated phase (today's situation);
//         'spread' = the team's 9/27 idea: route k first reaches the focus stop at k·H/K (H = mean headway, K = routes), like 0·4·8 min.
export function createSim(preps,{focus,rule,assignment={},berths=1,speed=15/3.6,dwell=25,seed=1,timing='random'}){
 const random=rng(seed),buses=[];
 const snapped=preps.filter(prep=>prep.stopAt[focus]!==undefined).map(prep=>prep.route.id).sort();
 const meanHeadway=snapped.length?preps.filter(prep=>snapped.includes(prep.route.id)).reduce((sum,prep)=>sum+(prep.route.termMinutes??10)*60,0)/snapped.length:0;
 // Fixed order so the same seed gives the same start positions however the caller lists the routes.
 for(const prep of [...preps].sort((a,b)=>a.route.id.localeCompare(b.route.id))){
  const f=prep.stopAt[focus];
  const headway=(prep.route.termMinutes??10)*60,n=Math.max(1,Math.round(prep.length/(speed*headway))),gap=prep.length/n;
  const k=snapped.indexOf(prep.route.id);
  const phase=timing==='spread'&&k>=0
   ?((f-speed*(k*meanHeadway/snapped.length))%gap+gap)%gap
   :random()*gap;
  for(let i=0;i<n;i++){
   const u=phase+i*gap;
   buses.push({route:prep.route.id,vehicle:i+1,prep,u,state:'run',next:f===undefined?Infinity:f+Math.ceil((u-f)/prep.length)*prep.length});
  }
 }
 const count=rule==='single'?1:Math.max(1,berths);
 return {buses,rule,assignment,speed,dwell,time:0,berthFree:Array(count).fill(0),occupant:Array(count).fill(null),queue:[],log:[],stats:{served:0,waited:0,totalWait:0,maxQueue:0}};
}

function berthFor(sim,bus){
 if(sim.rule==='colored')return sim.assignment[bus.route]??0;
 const t=Math.min(...sim.berthFree);return sim.berthFree.indexOf(t);
}

export function step(sim,dt){
 sim.time+=dt;
 for(const bus of sim.buses){
  if(bus.state==='dwell'&&sim.time>=bus.until){bus.state='run';bus.next+=bus.prep.length;}
  if(bus.state!=='run')continue;
  const u=bus.u+sim.speed*dt;
  if(u>=bus.next){
   bus.u=bus.next;bus.state='queue';bus.since=sim.time;
   // Log who is in the way at arrival: the last bus queued for the same space, else the bus standing in it.
   const berth=berthFor(sim,bus),ahead=sim.queue.filter(other=>sim.rule==='pooled'||berthFor(sim,other)===berth);
   bus.queueOnArrival=ahead.length;
   bus.blockedBy=ahead.length?ahead.at(-1).route:sim.berthFree[berth]>sim.time?sim.occupant[berth]?.route??null:null;
   sim.queue.push(bus);
  }else bus.u=u;
 }
 // FIFO per berth: a bus is admitted once its berth is free; colored buses wait only for their own berth.
 let admitted=true;
 while(admitted){
  admitted=false;
  for(const bus of sim.queue){
   const berth=berthFor(sim,bus);
   if(sim.queue.some(other=>other!==bus&&other.since<bus.since&&berthFor(sim,other)===berth))continue;
   if(sim.berthFree[berth]>sim.time)continue;
   const wait=sim.time-bus.since;
   sim.berthFree[berth]=sim.time+sim.dwell;sim.occupant[berth]=bus;bus.state='dwell';bus.until=sim.time+sim.dwell;bus.berth=berth;
   sim.log.push({arrival:bus.since,route:bus.route,vehicle:bus.vehicle,berth,queueOnArrival:bus.queueOnArrival,wait,blockedBy:wait>0.5?bus.blockedBy:null});
   sim.queue.splice(sim.queue.indexOf(bus),1);
   sim.stats.served++;sim.stats.totalWait+=wait;if(wait>0.5)sim.stats.waited++;
   admitted=true;break;
  }
 }
 sim.stats.maxQueue=Math.max(sim.stats.maxQueue,sim.queue.length);
 return sim;
}

// Runs the same scenario headless for `seconds`; returns the stats plus the per-bus log at the focus stop.
export function runFor(preps,options,seconds=7200){
 const sim=createSim(preps,options);
 for(let t=0;t<seconds;t++)step(sim,1);
 return {...sim.stats,log:sim.log};
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
