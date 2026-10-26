// 중앙정류장 하나에 버스가 실제로 언제 지나가는지 잰다. 끝나면 시뮬레이터와 같은 지표(버스 간격, 1분 안 연달아 비율, 승객 대기)를 낸다.
// 서울: 정류소정보조회 getStationByUid 한 번에 그 정류장 모든 노선의 첫 도착 차량이 온다. 첫 차량 ID가 바뀌면 앞차가 지나간 것으로 보고,
//       지나간 시각 = 마지막으로 본 시각 + 그때 남은 도착 시간(traTime1), 단 지금보다 늦지 않게.
// 일산: 경기도 버스위치정보(노선별)로 차량의 정류장 순번이 이 정류장 순번을 넘는 순간을 지나간 것으로 본다(조회 간격만큼 오차).
//       하루 호출 한도(기능별 1,000회) 안에 들도록 배차가 짧은 노선부터 고른다.
// Usage: node --env-file=.env scripts/observe-stop.mjs seoul 03003 [분=90] [간격초=20]
//        node --env-file=.env scripts/observe-stop.mjs ilsan 20227 [분=90] [간격초=60]
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {request} from './collect.mjs';
import {summarizeObservation} from '../src/observation.js';
import {passengerWait} from '../src/routesim.js';
const [area='seoul',arsId='03003',minutes='90',every=area==='ilsan'?'60':'20']=process.argv.slice(2);
const LIMIT=900; // 하루 1,000회 중 여유를 남긴다
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function gyeonggi(routeId){
 const url=new URL('https://apis.data.go.kr/6410000/buslocationservice/v2/getBusLocationListv2');
 url.searchParams.set('serviceKey',decodeURIComponent(process.env.GYEONGGI_BUS_SERVICE_KEY??''));url.searchParams.set('routeId',routeId);url.searchParams.set('format','json');
 const body=(await (await fetch(url)).json()).response;
 if(body?.msgHeader?.resultCode!==0&&body?.msgHeader?.resultCode!==4)throw new Error(body?.msgHeader?.resultMessage??'경기도 API 오류');
 const list=body?.msgBody?.busLocationList;return Array.isArray(list)?list:list?[list]:[];
}

try{
 const dir=fileURLToPath(new URL(`../data/public/${area==='ilsan'?'ilsan/':''}`,import.meta.url));
 const stations=JSON.parse(await readFile(dir+'stations.json','utf8')),{routes:all}=JSON.parse(await readFile(dir+'routes.json','utf8'));
 const stop=stations.stops.find(s=>s.arsId===arsId);if(!stop)throw new Error('수집한 정류장이 아닙니다: '+arsId);
 const polls=Math.ceil(Number(minutes)*60/Number(every));
 let routes=all.filter(r=>stop.routes.includes(r.id));
 if(area==='ilsan'){
  // 이 정류장의 노선별 순번. 같은 정류장을 두 번 지나는 노선은 첫 번째를 쓴다.
  routes=routes.map(r=>({...r,seq:r.stops.find(s=>s.stationId===stop.id)?.seq})).filter(r=>r.seq)
   .sort((a,b)=>(a.termMinutes??99)-(b.termMinutes??99)).slice(0,Math.max(1,Math.floor(LIMIT/polls)));
 }else if(polls>LIMIT)throw new Error(`호출 ${polls}회는 하루 한도에 비해 많습니다.`);
 const out={source:area==='ilsan'?'경기도_버스위치정보 조회 (공공데이터포털 15080648) getBusLocationListv2':'서울특별시_정류소정보조회 서비스 (공공데이터포털 15000303) getStationByUid',
  area,stop:{arsId,id:stop.id,name:stop.name},routes:routes.map(({id,name,termMinutes})=>({id,name,termMinutes})),
  pollSeconds:Number(every),startedAt:new Date().toISOString(),endedAt:null,polls:0,failedPolls:0,passes:[]};
 const outDir=fileURLToPath(new URL('../data/public/observations/',import.meta.url));await mkdir(outDir,{recursive:true});
 const file=`${outDir}${area}-${arsId}-${out.startedAt.slice(0,16).replace(/[-:T]/g,'')}.json`;
 const seen=new Map(); // 서울: 노선 → {veh, at, eta} / 일산: 차량 → 마지막 순번
 for(let i=0;i<polls;i++){
  const now=Date.now();
  if(area==='ilsan'){
   for(const route of routes){
    try{
     for(const bus of await gyeonggi(route.id)){
      const key=route.id+'|'+bus.vehId,was=seen.get(key);
      if(was!==undefined&&was<route.seq&&bus.stationSeq>=route.seq)out.passes.push({route:route.name,vehId:String(bus.vehId),plainNo:bus.plateNo,time:new Date(now).toISOString()});
      seen.set(key,bus.stationSeq);
     }
    }catch{out.failedPolls++;}
   }
  }else{
   try{
    for(const item of (await request('stationinfo/getStationByUid',{arsId})).msgBody?.itemList??[]){
     const was=seen.get(item.busRouteId),veh=item.vehId1;
     if(was&&was.veh!=='0'&&was.veh!==veh)out.passes.push({route:item.rtNm,vehId:was.veh,time:new Date(Math.min(now,was.at+was.eta*1000)).toISOString()});
     seen.set(item.busRouteId,{veh,at:now,eta:Number(item.traTime1)||0});
    }
   }catch{out.failedPolls++;}
  }
  out.polls++;out.endedAt=new Date().toISOString();
  out.passes.sort((a,b)=>a.time.localeCompare(b.time));
  await writeFile(file,JSON.stringify(out,null,2)+'\n');
  if(i<polls-1)await sleep(Math.max(0,Number(every)*1000-(Date.now()-now)));
 }
 // 시뮬레이터와 같은 지표로 요약한다.
 const summary=summarizeObservation(out);
 const departures={},headways={};
 for(const p of out.passes)(departures[p.route]??=[]).push(Date.parse(p.time)/1000);
 for(const r of out.routes)if(r.termMinutes)headways[r.name]=r.termMinutes*60;
 const wait=passengerWait(departures,headways,0);
 out.summary={passes:summary.passes,minutes:Math.round(summary.spanMinutes),withinMinuteShare:summary.gaps.length?summary.within/summary.gaps.length:null,
  randomShare:summary.expectedShare,passengerWaitMin:wait.actual/60,plannedWaitMin:wait.planned/60};
 await writeFile(file,JSON.stringify(out,null,2)+'\n');
 console.log(`${stop.name}(${arsId}) ${out.summary.minutes}분 관측: 통과 ${summary.passes}회, 실패 ${out.failedPolls}회`);
 console.log(`1분 안 연달아 ${(out.summary.withinMinuteShare*100).toFixed(0)}% (무작위라면 ${(summary.expectedShare*100).toFixed(0)}%) · 승객 대기 ${out.summary.passengerWaitMin.toFixed(2)}분 (계획대로면 ${out.summary.plannedWaitMin.toFixed(2)}분)`);
 console.log('저장: '+file);
}catch(error){console.error(error.message);process.exitCode=1;}
