import {loadSdk} from '/public/map.js';
import {prepareRoute,positionAt,createSim,step,runFor} from '/src/routesim.js';
const $=id=>document.getElementById(id);
const GREY='#7b858c';
let liveInterval=15,maps,map,routesData,preps=new Map(),layers=[],busOverlays=[],liveOverlays=[],sim,params,rule='single',timing='random',tableTimer,playing=false,rate=30,last=0,liveTimer;

function clear(list){for(const item of list)item.setMap(null);list.length=0;}
function dot(className,color,title){const el=document.createElement('span');el.className=className;el.style.background=color;el.title=title;return el;}

function rebuildSim(){
 const {focus,routeIds,assignment,colors,dwell,palette}=params;
 const list=routeIds.map(id=>preps.get(id)).filter(Boolean);
 sim=createSim(list,{focus,rule,assignment,berths:colors,dwell,seed:1,timing});
 clear(busOverlays);
 for(const bus of sim.buses){
  const color=rule==='colored'?palette[assignment[bus.route]]:GREY;
  const el=dot('bus-dot',color,bus.prep.route.name);
  bus.el=el;
  const overlay=new maps.CustomOverlay({position:new maps.LatLng(...positionAt(bus.prep,bus.u)),content:el,xAnchor:.5,yAnchor:.5,zIndex:3});
  overlay.setMap(map);bus.overlay=overlay;busOverlays.push(overlay);
 }
 const skipped=list.filter(prep=>prep.stopAt[focus]===undefined).map(prep=>prep.route.name);
 $('sim-skipped').textContent=skipped.length?`${skipped.join(', ')}번은 이 정류장 위치를 경로에 맞추지 못해 움직이기만 하고 줄 계산에서는 빠집니다.`:'';
 draw();
 clearTimeout(tableTimer);tableTimer=setTimeout(()=>renderTable(list),30);
}

// Same simulation, run headless for 2 hours under each way of stopping, so the table matches what the map shows.
function renderTable(list){
 const {focus,assignment,colors,dwell}=params,body=$('result-table');
 const rows=[['single','설 자리 1곳'],['pooled',`${colors}곳, 빈 곳 아무 데나`],['colored',`${colors}곳, 노선별 지정`]];
 body.replaceChildren();
 for(const [key,label] of rows){
  const s=runFor(list,{focus,rule:key,assignment,berths:colors,dwell,seed:1,timing});
  const tr=document.createElement('tr');if(key===rule)tr.className='current';
  for(const value of [label,`${s.waited}대 / ${s.served}대`,`${Math.round(s.totalWait/60)}분 ${Math.round(s.totalWait%60)}초`,`${s.maxQueue}대`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
  body.append(tr);
 }
 $('result-note').textContent=`${timing==='spread'?'노선끼리 간격 두기':'지금처럼 제각각'}, 한 대 ${dwell}초 정차, 난수 seed 1. 굵은 줄이 지도에서 보고 있는 조건입니다.`;
}

function draw(){
 for(const bus of sim.buses){
  bus.overlay.setPosition(new maps.LatLng(...positionAt(bus.prep,bus.u)));
  bus.el.classList.toggle('queued',bus.state==='queue');
 }
 const {served,waited,totalWait}=sim.stats;
 $('sim-clock').textContent=`${Math.floor(sim.time/60)}분`;
 $('sim-stats').textContent=`이 정류장에 선 버스 ${served}대 · 기다린 버스 ${waited}대 · 지금 줄 ${sim.queue.length}대`;
}

function frame(now){
 if(!playing)return;
 const elapsed=Math.min(0.25,(now-(last||now))/1000)*rate;last=now;
 for(let t=0;t<elapsed;t+=1)step(sim,Math.min(1,elapsed-t));
 draw();requestAnimationFrame(frame);
}

async function refreshLive(){
 clear(liveOverlays);
 const responses=await Promise.all(params.routeIds.map(id=>fetch('/live/buspos?routeId='+id).then(async r=>({ok:r.ok,body:await r.json()})).catch(()=>null)));
 clear(liveOverlays);
 let count=0,stamp='',quota;
 for(const response of responses.filter(Boolean)){
  const result=response.body;
  if(result.dailyLimit)quota=result;
  if(!response.ok)continue;
  const name=preps.get(result.routeId)?.route.name??'';
  for(const bus of result.buses){
   const overlay=new maps.CustomOverlay({position:new maps.LatLng(bus.lat,bus.lng),content:dot('live-dot',params.palette[params.assignment[result.routeId]]??GREY,`${name}번 ${bus.plainNo}`),xAnchor:.5,yAnchor:.5,zIndex:4});
   overlay.setMap(map);liveOverlays.push(overlay);count++;stamp=result.fetchedAt;
  }
 }
 const left=quota?Math.max(0,quota.dailyLimit-quota.callsToday):0;
 const minutes=Math.floor(left/params.routeIds.length*liveInterval/60);
 const budget=quota?` · 오늘 호출 ${quota.callsToday}/${quota.dailyLimit}회, 이 간격이면 약 ${minutes}분 더 볼 수 있음`:'';
 if(quota&&left===0){stopLive();$('live-toggle').checked=false;$('live-status').textContent=`오늘 실시간 위치 호출 한도(${quota.dailyLimit}회)에 닿아 멈췄습니다. 시뮬레이션은 계속 쓸 수 있습니다.`;return;}
 $('live-status').textContent=count?`실제 버스 ${count}대 · ${new Date(stamp).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'})} 기준 · ${liveInterval}초마다 갱신${budget}`:'실시간 위치를 받지 못했습니다. 잠시 뒤 다시 켜 보세요.';
}
function stopLive(){clearInterval(liveTimer);liveTimer=undefined;}
function startLive(){stopLive();if(!map)return;refreshLive();liveTimer=setInterval(refreshLive,liveInterval*1000);}

export async function updateRouteMap(next){
 params=next;
 try{
  if(!map){
   const [config,data]=await Promise.all([fetch('/config.json').then(r=>r.json()),fetch('/routes.json').then(r=>{if(!r.ok)throw new Error('노선 경로 자료가 없습니다. npm run collect:routes 로 먼저 수집하세요.');return r.json();})]);
   if(!config.kakaoJsKey)throw new Error('지도 키가 설정되지 않았습니다.');
   await loadSdk(config.kakaoJsKey);maps=window.kakao.maps;routesData=data;
   for(const route of data.routes)preps.set(route.id,prepareRoute(route));
   map=new maps.Map($('route-map'),{center:new maps.LatLng(37.56,126.995),level:4});
   map.addControl(new maps.ZoomControl(),maps.ControlPosition.RIGHT);
   addEventListener('resize',()=>{map.relayout();map.setCenter(new maps.LatLng(params.stop.lat,params.stop.lng));});
   $('route-map-error').textContent='';
  }
  clear(layers);
  const stop=params.stop;
  for(const id of params.routeIds){
   const route=preps.get(id)?.route;if(!route)continue;
   layers.push(new maps.Polyline({map,path:route.path.map(([lat,lng])=>new maps.LatLng(lat,lng)),strokeWeight:4,strokeColor:params.palette[params.assignment[id]],strokeOpacity:.45}));
  }
  const label=document.createElement('span');label.className='focus-stop';label.textContent=stop.name;
  layers.push(new maps.CustomOverlay({map,position:new maps.LatLng(stop.lat,stop.lng),content:label,yAnchor:1.6,zIndex:5}));
  layers.push(new maps.Circle({map,center:new maps.LatLng(stop.lat,stop.lng),radius:40,strokeWeight:2,strokeColor:'#1d2328',fillColor:'#ffb000',fillOpacity:.9}));
  map.relayout();map.setCenter(new maps.LatLng(stop.lat,stop.lng));map.setLevel(4);
  $('sim-source').textContent=`노선 경로·정류장 순서: 서울시 노선정보조회, ${new Date(routesData.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} 수집.`;
  rebuildSim();
  if(liveTimer)refreshLive();
 }catch(error){$('route-map-error').textContent=error.message+' 오른쪽 결과표는 계속 볼 수 있습니다.';}
}

for(const input of document.querySelectorAll('input[name=rule],input[name=timing]'))input.addEventListener('change',()=>{
 rule=document.querySelector('input[name=rule]:checked').value;timing=document.querySelector('input[name=timing]:checked').value;
 if(sim)rebuildSim();
});
$('sim-play').addEventListener('click',()=>{
 if(!sim)return;
 playing=!playing;$('sim-play').textContent=playing?'멈춤':'재생';
 if(playing){last=0;requestAnimationFrame(frame);}
});
$('sim-reset').addEventListener('click',()=>{if(sim)rebuildSim();});
$('sim-rate').addEventListener('input',event=>{rate=Number(event.target.value);});
$('live-toggle').addEventListener('change',event=>{
 stopLive();clear(liveOverlays);$('live-status').textContent='';
 if(event.target.checked)startLive();
});
$('live-interval').addEventListener('input',event=>{liveInterval=Number(event.target.value);if(liveTimer)startLive();});
