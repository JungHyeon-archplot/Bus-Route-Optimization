// Collects every stop within a radius and the routes passing each stop, then writes the public snapshot.
// Usage: npm run collect:area -- [경도] [위도] [반경m]   (기본: 충무로역~동국대 사이 중심, 800m)
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {request} from './collect.mjs';
import {normalizeStations,normalizeRoutesAtStop} from '../src/data/normalize.js';
const [lng='127.0000',lat='37.5595',radius='800']=process.argv.slice(2);
try{
 if(!(Number(radius)>0&&Number(radius)<=1500))throw new Error('반경은 1~1500m로 지정하세요.');
 const fetchedAt=new Date().toISOString();
 const nearby=await request('stationinfo/getStationByPos',{tmX:lng,tmY:lat,radius});
 // arsId "0" = 미정차 가상 지점(예: 터널 요금소). 승객이 탈 수 없으므로 제외한다.
 const items=(nearby.msgBody?.itemList??[]).filter(item=>item.arsId&&item.arsId!=='0')
  .map(item=>({stId:item.stationId,stNm:item.stationNm,arsId:item.arsId,tmX:item.gpsX,tmY:item.gpsY}));
 const dataset=normalizeStations(items,{datasetId:'seoul-area-'+fetchedAt.slice(0,10),
  source:'서울특별시_정류소정보조회 서비스 (공공데이터포털 15000303) getStationByPos · getRouteByStation',fetchedAt,coordinateSystem:'WGS84'});
 const routes=new Map(),raw={fetchedAt,query:{lng,lat,radius},nearby,routesByStop:{}};
 for(const stop of dataset.stops){
  const response=await request('stationinfo/getRouteByStation',{arsId:stop.arsId});
  raw.routesByStop[stop.arsId]=response;
  const list=normalizeRoutesAtStop(response.msgBody?.itemList??[]);
  stop.routes=list.map(route=>route.id);
  for(const route of list)routes.set(route.id,route);
 }
 dataset.query={centerLng:Number(lng),centerLat:Number(lat),radiusMeters:Number(radius)};
 dataset.routes=[...routes.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}));
 const rawDir=fileURLToPath(new URL('../data/raw/',import.meta.url)),pubDir=fileURLToPath(new URL('../data/public/',import.meta.url));
 await mkdir(rawDir,{recursive:true});await mkdir(pubDir,{recursive:true});
 await writeFile(rawDir+'area-'+Date.now()+'.json',JSON.stringify(raw,null,2));
 await writeFile(pubDir+'stations.json',JSON.stringify(dataset,null,2)+'\n');
 console.log(`정규화 완료: 정류장 ${dataset.stops.length}개, 경유 노선 ${dataset.routes.length}개 (반경 ${radius}m). API 호출 ${dataset.stops.length+1}회.`);
}catch(error){console.error(error.message);process.exitCode=1;}
