// Summarizes observed stop passes. Compares short gaps with what independent (random) arrivals at the same rate would give.
export function summarizeObservation(obs,{window=60}={}){
 const times=obs.passes.map(pass=>Date.parse(pass.time)).sort((a,b)=>a-b);
 const span=(Date.parse(obs.endedAt)-Date.parse(obs.startedAt))/1000;
 const gaps=times.slice(1).map((t,i)=>(t-times[i])/1000);
 const byRoute={};
 for(const route of obs.routes){
  const own=obs.passes.filter(pass=>pass.route===route.name).map(pass=>Date.parse(pass.time)).sort((a,b)=>a-b);
  byRoute[route.name]={count:own.length,planned:route.termMinutes,headways:own.slice(1).map((t,i)=>(t-own[i])/60000)};
 }
 const rate=span>0?times.length/span:0;
 return {passes:times.length,spanMinutes:span/60,gaps,within:gaps.filter(gap=>gap<=window).length,
  expectedShare:gaps.length?1-Math.exp(-rate*window):0,byRoute};
}
