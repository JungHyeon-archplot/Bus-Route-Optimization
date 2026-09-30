import {voronoiCells} from '/src/voronoi.js';
import {mountMap} from '/public/map.js';
const svg=document.querySelector('#voronoi');
const points=[{id:'A',x:90,y:90},{id:'B',x:290,y:50},{id:'C',x:470,y:120},{id:'D',x:460,y:290},{id:'E',x:280,y:340},{id:'F',x:80,y:270}];
const colors=['#dae9fa','#fde6cf','#d4eee6','#eadff3','#fae4e4','#e5eacb'];
const ns='http://www.w3.org/2000/svg';
for(const [i,cell] of voronoiCells(points,{minX:0,minY:0,maxX:560,maxY:390}).entries()){
 const polygon=document.createElementNS(ns,'polygon');
 polygon.setAttribute('points',cell.polygon.map(p=>`${p.x},${p.y}`).join(' '));polygon.setAttribute('fill',colors[i]);polygon.setAttribute('stroke','#71828c');svg.append(polygon);
 const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',points[i].x);dot.setAttribute('cy',points[i].y);dot.setAttribute('r','5');dot.setAttribute('fill','#172b39');svg.append(dot);
 const label=document.createElementNS(ns,'text');label.setAttribute('x',points[i].x+10);label.setAttribute('y',points[i].y);label.textContent=cell.id;svg.append(label);
}
const status=document.querySelector('#map-status');
let dataset={stops:[]},mapHandle,mapPending=false,dataReady=false;
const field=document.querySelector('#field-view');
const retry=document.querySelector('#map-retry');
async function connectMap(){
 if(mapPending||field.hidden||!dataReady)return;
 if(mapHandle){mapHandle.resize();return;}
 mapPending=true;retry.hidden=true;document.querySelector('#map-error').textContent='지도 연결 중…';
 try{
  const response=await fetch('/config.json');
  if(!response.ok)throw new Error('지도 설정을 읽지 못했습니다.');
  mapHandle=await mountMap(document.querySelector('#real-map'),dataset,await response.json());
  document.querySelector('#map-error').textContent='';
 }catch(error){document.querySelector('#map-error').textContent=error.message+' 아래 정류장 목록과 가상 실험은 계속 이용할 수 있습니다.';retry.hidden=false;}
 finally{mapPending=false;}
}
retry.addEventListener('click',connectMap);
const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectTab(tab){
 for(const other of tabs){const selected=other===tab;other.setAttribute('aria-selected',String(selected));other.tabIndex=selected?0:-1;document.getElementById(other.getAttribute('aria-controls')).hidden=!selected;}
 if(!field.hidden)connectMap();
}
for(const tab of tabs){
 tab.addEventListener('click',()=>selectTab(tab));
 tab.addEventListener('keydown',event=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const target=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs.find(item=>item!==tab);target.focus();selectTab(target);}
 });
}
async function init(){
 try{
  const response=await fetch('/stations.json');
  if(response.ok){
   dataset=await response.json();
   const collected=dataset.fetchedAt?new Date(dataset.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST':'시각 미상';
   status.textContent=`서울특별시 정류소정보조회 · ${dataset.stops.length}개 정류장 · 수집 ${collected}`;
  }else if(response.status===404)status.textContent='정류장 데이터 수집 전입니다. 지도만 표시하며 가상 정류장을 실제 위치로 표시하지 않습니다.';
  else throw new Error('정류장 데이터를 읽지 못했습니다.');
  const list=document.querySelector('#station-list');
  if(!dataset.stops.length){const li=document.createElement('li');li.textContent='표시할 정류장 데이터가 없습니다.';list.append(li);}
  for(const stop of dataset.stops){const li=document.createElement('li');li.textContent=`${stop.name} · ARS ${stop.arsId} · ID ${stop.id}`;list.append(li);}
 }catch{dataset={stops:[]};status.textContent='정류장 데이터를 읽지 못했습니다. 가상 실험은 계속 이용할 수 있습니다.';}
 try{
  const response=await fetch('/hub-models.json');if(!response.ok)throw new Error('거점 목록 불러오기 실패');
  const models=await response.json(),select=document.querySelector('#hub-model');
  const render=()=>{
   const model=models.find(item=>item.id===select.value),list=document.querySelector('#hub-list');list.replaceChildren();
   for(const hub of model.hubs){const li=document.createElement('li');li.textContent=hub.name;list.append(li);}
   document.querySelector('#hub-note').textContent=model.kind==='study-area'?'정적 좌표와 노선 연결성을 조사할 범위입니다. 실제 정류장 ID 매칭은 별도입니다.':'아래 보로노이와 가상 계산에 쓰는 설명용 거점입니다. 실제 좌표가 아닙니다.';
  };select.addEventListener('change',render);render();
 }catch{document.querySelector('#hub-note').textContent='거점 목록을 읽지 못했습니다. 다시 새로고침해 주세요.';}
 dataReady=true;
 if(location.hash==='#field-study')selectTab(tabs[1]);
 else if(!field.hidden)connectMap();
}
init();
