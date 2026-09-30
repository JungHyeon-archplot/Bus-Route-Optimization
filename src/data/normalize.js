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
