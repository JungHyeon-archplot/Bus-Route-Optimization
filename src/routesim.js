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
export function createSim(preps,{focus,rule,assignment={},berths=1,speed=15/3.6,dwell=25,seed=1}){
 const random=rng(seed),buses=[];
 for(const prep of preps){
  const f=prep.stopAt[focus];
  const headway=(prep.route.termMinutes??10)*60,n=Math.max(1,Math.round(prep.length/(speed*headway))),gap=prep.length/n,phase=random()*gap;
  for(let i=0;i<n;i++){
   const u=phase+i*gap;
   buses.push({route:prep.route.id,prep,u,state:'run',next:f===undefined?Infinity:f+Math.ceil((u-f)/prep.length)*prep.length});
  }
 }
 const count=rule==='single'?1:Math.max(1,berths);
 return {buses,rule,assignment,speed,dwell,time:0,berthFree:Array(count).fill(0),queue:[],stats:{served:0,waited:0,totalWait:0,maxQueue:0}};
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
  if(u>=bus.next){bus.u=bus.next;bus.state='queue';bus.since=sim.time;sim.queue.push(bus);}else bus.u=u;
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
   sim.berthFree[berth]=sim.time+sim.dwell;bus.state='dwell';bus.until=sim.time+sim.dwell;bus.berth=berth;
   sim.queue.splice(sim.queue.indexOf(bus),1);
   sim.stats.served++;sim.stats.totalWait+=wait;if(wait>0.5)sim.stats.waited++;
   admitted=true;break;
  }
 }
 sim.stats.maxQueue=Math.max(sim.stats.maxQueue,sim.queue.length);
 return sim;
}
