import {validateScenario} from './scenario.js';
import {colorGraph} from './graph.js';
export function phasesFor(s,mode) {
  if(mode==='baseline') return Array(s.vehicles).fill(0);
  if(mode!=='staggered')throw new Error('알 수 없는 모드');
  const nodes=Array.from({length:s.vehicles},(_,i)=>String(i));
  const conflicts=nodes.flatMap((u,i)=>nodes.slice(i+1).map(v=>[u,v]));
  const {colors,count}=colorGraph(nodes,conflicts);
  return nodes.map(n=>colors[n]*s.headwaySec/count);
}
export function simulate(s, mode, options={}) {
  validateScenario(s);
  const windowStart=options.windowStart??3*s.headwaySec, duration=options.duration??3600;
  if(!Number.isFinite(windowStart)||windowStart<0||!Number.isFinite(duration)||duration<=0||duration>86400)throw new Error('관측창 오류');
  const windowEnd=windowStart+duration, until=windowEnd+2*s.headwaySec;
  const phases=phasesFor(s,mode), queue=phases.map((time,busId)=>({time,busId,trip:0,stop:0}));
  const free=Object.fromEntries(s.stops.map(p=>[p.id,0])), events=[];
  while(queue.length){
    queue.sort((a,b)=>a.time-b.time||a.busId-b.busId);
    const e=queue.shift();if(e.time>until)break;
    const stop=s.stops[e.stop], start=Math.max(e.time,free[stop.id]), end=start+s.dwellSec;
    free[stop.id]=end;
    events.push({busId:e.busId,trip:e.trip,stopId:stop.id,stopIndex:e.stop,arrival:e.time,start,end,delay:start-e.time});
    const arrival=end+s.edges[e.stop].lengthM/s.speedMps;
    if(e.stop+1<s.stops.length)queue.push({...e,time:arrival,stop:e.stop+1});
    else queue.push({time:Math.max(arrival,phases[e.busId]+(e.trip+1)*s.headwaySec),busId:e.busId,trip:e.trip+1,stop:0});
    if(events.length>200000)throw new Error('실험 크기 제한');
  }
  const records=events.filter(e=>e.arrival>=windowStart&&e.arrival<windowEnd);
  const byStop=s.stops.map(stop=>{
    const visits=records.filter(e=>e.stopId===stop.id);
    return {id:stop.id,name:stop.name,visits:visits.length,
      meanBusDelay:mean(visits.map(e=>e.delay)),maxQueue:maxQueue(events.filter(e=>e.stopId===stop.id),windowStart,windowEnd),
      theoreticalPassengerWait:uniformWait(events.filter(e=>e.stopId===stop.id).map(e=>e.start),windowStart,windowEnd)};
  });
  return {mode,phases,windowStart,windowEnd,events,byStop,
    metrics:{visits:records.length,meanBusDelay:mean(records.map(e=>e.delay)),
      totalBusDelay:records.reduce((n,e)=>n+e.delay,0),maxQueue:Math.max(...byStop.map(p=>p.maxQueue)),
      theoreticalPassengerWait:byStop.some(p=>p.theoreticalPassengerWait===null)?null:mean(byStop.map(p=>p.theoreticalPassengerWait))}};
}
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
export function uniformWait(times,a,b) {
  const departures=[...new Set(times)].sort((x,y)=>x-y);
  let cursor=a,area=0;
  for(const next of departures){
    if(next<cursor)continue;
    const right=Math.min(next,b);
    if(right>cursor)area+=next*(right-cursor)-(right*right-cursor*cursor)/2;
    cursor=right;
    if(cursor>=b)return area/(b-a);
  }
  return null; // No next service: do not silently omit censored passengers.
}
export function maxQueue(events,a,b) {
  const changes=[];
  for(const e of events)if(e.start>e.arrival&&e.arrival<b&&e.start>a){
    changes.push([Math.max(a,e.arrival),1],[Math.min(b,e.start),-1]);
  }
  changes.sort((x,y)=>x[0]-y[0]||x[1]-y[1]);
  let n=0,max=0;for(const [,delta] of changes){n+=delta;max=Math.max(max,n);}return max;
}
export function busPosition(result,s,busId,time) {
  const records=result.events.filter(e=>e.busId===busId);
  const point=e=>s.stops[e.stopIndex];
  let previous=null;
  for(const e of records){
    if(time<e.arrival){
      if(!previous)return {...s.stops[0],state:'출발 대기'};
      const a=point(previous),b=point(e);
      // At the end of a loop the vehicle returns to A, then holds for its scheduled departure.
      const travel=s.edges[previous.stopIndex].lengthM/s.speedMps;
      const f=Math.max(0,Math.min(1,(time-previous.end)/travel));
      return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,state:f===1?'출발 대기':'이동'};
    }
    if(time<e.start)return {...point(e),state:'진입 대기'};
    if(time<e.end)return {...point(e),state:'정차'};
    previous=e;
  }
  return previous?{...point(previous),state:'계산 범위 끝'}:{...s.stops[0],state:'대기'};
}
export function eventsCsv(result) {
  const keys=['busId','trip','stopId','arrival','start','end','delay'];
  return [keys.join(','),...result.events.filter(e=>e.arrival>=result.windowStart&&e.arrival<result.windowEnd)
    .map(e=>keys.map(k=>JSON.stringify(e[k])).join(','))].join('\n');
}

