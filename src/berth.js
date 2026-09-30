// One curbside stop, deterministic arrivals from nominal headways plus seeded jitter.
// Compares the same arrivals under three berth rules so space and assignment effects stay separate.
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

export function arrivals(routes,{duration=7200,seed=1,jitter=90}={}){
 const random=rng(seed),list=[];
 for(const route of routes){
  const headway=(route.termMinutes??10)*60,phase=random()*headway;
  for(let t=phase;t<duration;t+=headway)list.push({route:route.id,time:Math.max(0,t+(random()*2-1)*jitter)});
 }
 return list.sort((a,b)=>a.time-b.time||a.route.localeCompare(b.route));
}

// berthOf(route) → berth index, or null for "any free berth".
export function simulateStop(list,{berths,berthOf=()=>null,dwell=25}){
 const free=Array(berths).fill(0),events=[];
 for(const bus of list){
  const fixed=berthOf(bus.route);
  const berth=fixed??free.indexOf(Math.min(...free));
  if(berth<0||berth>=berths)throw new Error('Invalid berth');
  const start=Math.max(bus.time,free[berth]);
  free[berth]=start+dwell;
  events.push({...bus,berth,start,wait:start-bus.time});
 }
 const waits=events.map(event=>event.wait);
 let maxQueue=0;
 for(const event of events){
  const queued=events.filter(other=>other.berth===event.berth&&other.time<=event.time&&other.start>event.time).length;
  maxQueue=Math.max(maxQueue,queued);
 }
 return {events,served:events.length,meanWait:waits.reduce((s,w)=>s+w,0)/(waits.length||1),
  maxWait:Math.max(0,...waits),delayed:waits.filter(w=>w>0).length,maxQueue};
}

export function compareBerths(routes,assignment,colors,options={}){
 const list=arrivals(routes,options),k=Math.max(1,colors),dwell=options.dwell??25;
 return {
  arrivals:list.length,berths:k,
  single:simulateStop(list,{berths:1,dwell}),
  pooled:simulateStop(list,{berths:k,dwell}),
  colored:simulateStop(list,{berths:k,dwell,berthOf:route=>assignment[route]})
 };
}
