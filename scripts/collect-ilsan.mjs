// 일산 중앙로 BRT의 중앙정류장(centerYn=Y)과 그곳에 서는 노선의 경로·경유 정류장·배차를 경기도 버스 API로 모아
// 서울 자료와 같은 형식으로 data/public/ilsan/ 에 쓴다.
// Usage: npm run collect:ilsan   (.env 의 GYEONGGI_BUS_SERVICE_KEY 필요)
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {request as seoul} from './collect.mjs';
const key=process.env.GYEONGGI_BUS_SERVICE_KEY;
const round=v=>Math.round(Number(v)*1e6)/1e6;
// 대화역~백석동 중앙로를 따라 찍은 지점. 각 지점 반경 안의 정류장 중 중앙차로 정류장만 남긴다.
const POINTS=[[126.7473,37.6760],[126.7575,37.6740],[126.7612,37.6702],[126.7660,37.6675],[126.7745,37.6585],[126.7776,37.6524],[126.7820,37.6475],[126.7880,37.6430]];
// 예약·심야·출퇴근 전용은 낮 시간 몰림 분석에서 뺀다.
const SPECIAL=/예약|심야|출근|퇴근|^N/;
const stopKey=s=>String(s.mobileNo??'').trim()||'G'+s.stationId;

async function call(path,params){
 const url=new URL('https://apis.data.go.kr/6410000/'+path);
 url.searchParams.set('serviceKey',decodeURIComponent(key));url.searchParams.set('format','json');
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 const response=await fetch(url);
 if(!response.ok)throw new Error(`경기도 API ${path} 응답 ${response.status}`);
 const body=await response.json(),head=body.response?.msgHeader;
 // 4 = 결과 없음. 그 밖의 0이 아닌 코드는 오류다.
 if(head&&head.resultCode!==0&&head.resultCode!==4)throw new Error(`경기도 API ${path}: ${head.resultMessage}`);
 return body.response?.msgBody??{};
}
const list=v=>Array.isArray(v)?v:v?[v]:[];

try{
 if(!key)throw new Error('GYEONGGI_BUS_SERVICE_KEY가 필요합니다.');
 const fetchedAt=new Date().toISOString(),stations=new Map();let calls=0;
 for(const [x,y] of POINTS){
  const body=await call('busstationservice/v2/getBusStationAroundListv2',{x,y});calls++;
  for(const s of list(body.busStationAroundList))if(s.centerYn==='Y')stations.set(s.stationId,s);
 }
 const routes=new Map(),stops=[];
 for(const s of stations.values()){
  const body=await call('busstationservice/v2/getBusStationViaRouteListv2',{stationId:s.stationId});calls++;
  const ids=[];
  for(const r of list(body.busRouteList)){
   const name=String(r.routeName);if(SPECIAL.test(name))continue;
   ids.push(String(r.routeId));
   routes.set(String(r.routeId),{id:String(r.routeId),name,type:r.routeTypeName,typeCode:'G'+r.routeTypeCd,end:r.routeDestName});
  }
  stops.push({id:String(s.stationId),arsId:stopKey(s),name:s.stationName,lat:round(s.y),lng:round(s.x),routes:[...new Set(ids)]});
 }
 const withPaths=[];
 for(const route of routes.values()){
  const info=(await call('busrouteservice/v2/getBusRouteInfoItemv2',{routeId:route.id})).busRouteInfoItem??{};
  const via=list((await call('busrouteservice/v2/getBusRouteStationListv2',{routeId:route.id})).busRouteStationList);
  const line=list((await call('busrouteservice/v2/getBusRouteLineListv2',{routeId:route.id})).busRouteLineList);
  calls+=3;
  // 배차간격: 평시(nPeekAlloc), 없으면 첨두(peekAlloc), 그다음 평일·토요일 값. 서울 자료의 기본 배차간격과 맞춘다.
  route.termMinutes=['nPeekAlloc','peekAlloc','weNPeekAlloc','wePeekAlloc','satNPeekAlloc','satPeekAlloc'].map(k=>Number(info[k])).find(v=>v>0)??null;
  // 일산을 지나는 서울 버스(노선 ID 1001…)는 경기도 API에 배차가 없어 서울시 노선정보조회(15000193)에서 가져온다.
  if(!route.termMinutes&&route.id.startsWith('1001')){
   const item=(await seoul('busRouteInfo/getRouteInfo',{busRouteId:route.id})).msgBody?.itemList?.[0];calls++;
   route.termMinutes=Number(item?.term)||null;route.start??=item?.stStationNm;
  }
  route.start??=info.startStationName;
  const path=line.sort((a,b)=>a.lineSeq-b.lineSeq).map(p=>[round(p.y),round(p.x)]);
  const routeStops=via.sort((a,b)=>a.stationSeq-b.stationSeq).map(s=>({seq:s.stationSeq,arsId:stopKey(s),stationId:String(s.stationId),name:s.stationName,lat:round(s.y),lng:round(s.x),turn:s.turnYn==='Y',center:s.centerYn==='Y'}));
  if(path.length<2||!routeStops.length){console.warn(`${route.name}번은 경로가 비어 뺍니다.`);continue;}
  if(path.some(([lat,lng])=>!(lat>33&&lat<39&&lng>124&&lng<132)))throw new Error(`${route.name} 좌표가 WGS84 범위를 벗어났습니다.`);
  withPaths.push({...route,path,stops:routeStops});
 }
 const kept=new Set(withPaths.map(r=>r.id));
 for(const stop of stops)stop.routes=stop.routes.filter(id=>kept.has(id));
 const source='경기도_정류소 조회(15080666) · 경기도_버스노선 조회(15080662), 공공데이터포털';
 const dir=fileURLToPath(new URL('../data/public/ilsan/',import.meta.url));
 await mkdir(dir,{recursive:true});
 const area={datasetId:'gyeonggi-ilsan-'+fetchedAt.slice(0,10),source,fetchedAt,coordinateSystem:'WGS84',
  query:{corridor:'일산 중앙로 BRT 중앙정류장',points:POINTS},stops,routes:withPaths.map(({path,stops,...r})=>r).sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}))};
 await writeFile(dir+'stations.json',JSON.stringify(area,null,2)+'\n');
 await writeFile(dir+'routes.json',JSON.stringify({source,fetchedAt,coordinateSystem:'WGS84',routes:withPaths})+'\n');
 console.log(`중앙정류장 ${stops.length}곳, 노선 ${withPaths.length}개 저장. API 호출 ${calls}회.`);
}catch(error){console.error(error.message);process.exitCode=1;}
