// Observes when buses of chosen routes pass one stop, using the bus position API.
// A pass = the first poll where a vehicle's lastStnId becomes the stop; its time is the vehicle's own dataTm.
// Resolution ≈ poll interval + the ~20 s the vehicles take between reports.
// Usage: npm run observe -- 02151 421,463,507 [간격초=20] [분=40]
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {request} from './collect.mjs';
const [arsId='02151',names='421,463,507',every='20',minutes='40']=process.argv.slice(2);
const kst=tm=>new Date(`${tm.slice(0,4)}-${tm.slice(4,6)}-${tm.slice(6,8)}T${tm.slice(8,10)}:${tm.slice(10,12)}:${tm.slice(12,14)}+09:00`).toISOString();
try{
 const pub=fileURLToPath(new URL('../data/public/',import.meta.url));
 const area=JSON.parse(await readFile(pub+'stations.json','utf8')),{routes:all}=JSON.parse(await readFile(pub+'routes.json','utf8'));
 const stop=area.stops.find(item=>item.arsId===arsId);if(!stop)throw new Error('수집한 정류장이 아닙니다: '+arsId);
 const routes=names.split(',').map(name=>all.find(route=>route.name===name)??(()=>{throw new Error('수집한 노선이 아닙니다: '+name);})());
 const polls=Math.ceil(Number(minutes)*60/Number(every));
 if(polls*routes.length>600)throw new Error(`호출 ${polls*routes.length}회는 하루 한도(1,000회)에 비해 많습니다. 간격을 늘리거나 시간을 줄이세요.`);
 const out={source:'서울특별시_버스위치정보조회 서비스 (공공데이터포털 15000332) getBusPosByRtid',stop:{arsId,id:stop.id,name:stop.name},
  routes:routes.map(({id,name,termMinutes})=>({id,name,termMinutes})),pollSeconds:Number(every),startedAt:new Date().toISOString(),endedAt:null,polls:0,failedPolls:0,passes:[]};
 await mkdir(pub+'observations',{recursive:true});
 const file=`${pub}observations/arrivals-${arsId}-${out.startedAt.slice(0,16).replace(/[-:T]/g,'')}.json`;
 const last=new Map();
 for(let i=0;i<polls;i++){
  for(const route of routes){
   try{
    const items=(await request('buspos/getBusPosByRtid',{busRouteId:route.id})).msgBody?.itemList??[];
    for(const bus of items){
     const key=route.id+bus.vehId,was=last.get(key);
     if(bus.lastStnId===stop.id&&was!==undefined&&was!==stop.id)out.passes.push({route:route.name,vehId:bus.vehId,plainNo:bus.plainNo,time:kst(bus.dataTm)});
     last.set(key,bus.lastStnId);
    }
   }catch{out.failedPolls++;}
  }
  out.polls++;out.endedAt=new Date().toISOString();
  out.passes.sort((a,b)=>a.time.localeCompare(b.time));
  await writeFile(file,JSON.stringify(out,null,2)+'\n');await writeFile(pub+'observations/latest.json',JSON.stringify(out,null,2)+'\n');
  if(i<polls-1)await new Promise(resolve=>setTimeout(resolve,Number(every)*1000));
 }
 console.log(`관측 끝: ${out.passes.length}회 통과 기록, 실패 ${out.failedPolls}회 → ${file}`);
}catch(error){console.error(error.message);process.exitCode=1;}
