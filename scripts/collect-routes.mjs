// Fetches stop sequence and road geometry for the daytime routes serving the busiest stops in data/public/stations.json.
// Usage: npm run collect:routes -- [정류장 수=12]
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {request} from './collect.mjs';
import {overlapSummary} from '../src/network.js';
import {NON_DAYTIME} from '../src/coloring.js';
const round=value=>Math.round(Number(value)*1e6)/1e6;
try{
 const pub=fileURLToPath(new URL('../data/public/',import.meta.url)),raw=fileURLToPath(new URL('../data/raw/',import.meta.url));
 const area=JSON.parse(await readFile(pub+'stations.json','utf8'));
 const count=Number(process.argv[2]??12);
 const ids=new Set();
 for(const {routes} of overlapSummary(area).busiestStops.slice(0,count))for(const route of routes)if(!NON_DAYTIME.has(route.typeCode))ids.add(route.id);
 const fetchedAt=new Date().toISOString(),routes=[],rawAll={fetchedAt};
 for(const route of area.routes.filter(item=>ids.has(item.id))){
  const stations=await request('busRouteInfo/getStaionByRoute',{busRouteId:route.id});
  const path=await request('busRouteInfo/getRoutePath',{busRouteId:route.id});
  rawAll[route.id]={stations,path};
  const points=(path.msgBody?.itemList??[]).sort((a,b)=>Number(a.no)-Number(b.no)).map(p=>[round(p.gpsY),round(p.gpsX)]);
  const stops=(stations.msgBody?.itemList??[]).sort((a,b)=>Number(a.seq)-Number(b.seq))
   .map(s=>({seq:Number(s.seq),arsId:s.arsId,stationId:s.station,name:s.stationNm,lat:round(s.gpsY),lng:round(s.gpsX),direction:s.direction,turn:s.transYn==='Y'}));
  if(points.length<2||!stops.length)throw new Error(`${route.name} 경로 또는 정류장 응답이 비었습니다.`);
  if(points.some(([lat,lng])=>!(lat>33&&lat<39&&lng>124&&lng<132)))throw new Error(`${route.name} 좌표가 WGS84 범위를 벗어났습니다.`);
  routes.push({...route,path:points,stops});
 }
 await mkdir(raw,{recursive:true});await writeFile(raw+'routes-'+Date.now()+'.json',JSON.stringify(rawAll));
 await writeFile(pub+'routes.json',JSON.stringify({source:'서울특별시_노선정보조회 서비스 (공공데이터포털 15000193) getStaionByRoute · getRoutePath',fetchedAt,coordinateSystem:'WGS84',routes})+'\n');
 console.log(`노선 ${routes.length}개 경로·정류장 저장. API 호출 ${routes.length*2}회.`);
}catch(error){console.error(error.message);process.exitCode=1;}
