function text(value,label){if(typeof value!=='string'||!value.trim())throw new Error(`Missing ${label}`);return value.trim();}
function provenance(meta){
 const fetchedAt=meta.fetchedAt??null;
 if(fetchedAt!==null&&(typeof fetchedAt!=='string'||!Number.isFinite(Date.parse(fetchedAt))))throw new Error('Invalid fetchedAt');
 return {source:text(meta.source,'source'),fetchedAt};
}
export function normalizeStations(items,meta){
 if(meta.coordinateSystem!=='WGS84')throw new Error('Expected WGS84');
 if(!Array.isArray(items))throw new Error('Expected station array');
 const ids=new Set();
 const stops=items.map(item=>{
  const id=text(item.stId,'stId'),name=text(item.stNm,'stNm'),arsId=text(item.arsId,'arsId');
  const lng=Number(text(String(item.tmX??''),'longitude')),lat=Number(text(String(item.tmY??''),'latitude'));
  if(!Number.isFinite(lng)||!Number.isFinite(lat)||lng<124||lng>132||lat<33||lat>39)throw new Error('Coordinates outside supported Korean WGS84 area');
  if(ids.has(id))throw new Error('Duplicate station ID');ids.add(id);
  return {id,arsId,name,lat,lng};
 });
 return {datasetId:text(meta.datasetId,'datasetId'),...provenance(meta),coordinateSystem:'WGS84',stops};
}
// Route adapter is unit-tested; actual route-service authentication remains a separate task.
export function normalizeRoute(items,meta){
 const sequences=new Set();
 const stops=items.map(item=>{
  const sequence=Number(item.seq);
  if(!Number.isInteger(sequence)||sequence<1||sequences.has(sequence))throw new Error('Invalid route sequence');
  sequences.add(sequence);
  return {stopId:text(item.station,'station'),sequence,direction:item.direction?text(item.direction,'direction'):null};
 }).sort((a,b)=>a.sequence-b.sequence);
 return {routeId:text(meta.routeId,'routeId'),...provenance(meta),stops};
}
const routeTypes={'0':'공용','1':'공항','2':'마을','3':'간선','4':'지선','5':'순환','6':'광역','7':'인천','8':'경기','9':'폐지'};
// getRouteByStation items → routes passing one stop. term is the agency's nominal headway in minutes, not an observation.
export function normalizeRoutesAtStop(items){
 if(!Array.isArray(items))throw new Error('Expected route array');
 return items.map(item=>{
  const term=Number(item.term);
  return {id:text(item.busRouteId,'busRouteId'),name:text(item.busRouteNm,'busRouteNm'),type:routeTypes[item.busRouteType]??'미상',typeCode:String(item.busRouteType??''),
   termMinutes:Number.isFinite(term)&&term>0?term:null,start:item.stBegin?.trim()||null,end:item.stEnd?.trim()||null};
 });
}
