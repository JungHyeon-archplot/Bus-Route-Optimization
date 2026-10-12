// Stop–route overlap from a dataset whose stops carry route IDs. Counts shared stops only; says nothing about timing.
export function overlapSummary(dataset){
 const routes=new Map((dataset.routes??[]).map(route=>[route.id,route]));
 const busiestStops=dataset.stops.filter(stop=>stop.routes?.length)
  .map(stop=>({stop,routes:stop.routes.map(id=>routes.get(id)).filter(Boolean)}))
  .sort((a,b)=>b.routes.length-a.routes.length||a.stop.arsId.localeCompare(b.stop.arsId));
 const pairs=new Map();
 for(const stop of dataset.stops){
  const ids=[...new Set(stop.routes??[])].sort();
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const key=ids[i]+'|'+ids[j];pairs.set(key,(pairs.get(key)??0)+1);
  }
 }
 const sharedPairs=[...pairs].map(([key,count])=>{const [a,b]=key.split('|').map(id=>routes.get(id)).sort((x,y)=>(x?.name??'').localeCompare(y?.name??'','ko',{numeric:true}));return {a,b,sharedStops:count};})
  .filter(pair=>pair.a&&pair.b).sort((x,y)=>y.sharedStops-x.sharedStops||x.a.name.localeCompare(y.a.name)||x.b.name.localeCompare(y.b.name));
 return {busiestStops,sharedPairs};
}
