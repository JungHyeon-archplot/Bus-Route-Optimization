// Checks how far the simulator's results can be trusted. Prints a report and writes data/public/validation.json.
// Usage: npm run validate
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {prepareRoute,runFor,summarizeLog} from '../src/routesim.js';
import {conflictGraph,colorGraph} from '../src/coloring.js';
import {summarizeObservation} from '../src/observation.js';

const read=async file=>JSON.parse(await readFile(fileURLToPath(new URL('../'+file,import.meta.url)),'utf8'));
const area=await read('data/public/stations.json'),{routes}=await read('data/public/routes.json');
const observation=await read('data/public/observations/latest.json'),counts=await read('data/public/observations/vehicle-counts-20260930.json');
const RULES=['single','pooled','colored'];
const mean=values=>values.reduce((sum,v)=>sum+v,0)/values.length;
const sd=values=>{const m=mean(values);return Math.sqrt(mean(values.map(v=>(v-m)**2)));};
const report={generatedAt:new Date().toISOString(),stops:{}};

function setup(arsId,minShared=3){
 const graph=conflictGraph(area,arsId,{minShared}),{colors,assignment}=colorGraph(graph.nodes,graph.edges);
 const preps=routes.filter(route=>graph.nodes.some(node=>node.id===route.id)).map(prepareRoute);
 return {graph,colors,assignment,preps};
}
const run=(s,rule,options={})=>runFor(s.preps,{focus:options.arsId,rule,assignment:s.assignment,berths:s.colors,dwell:40,seed:1,timing:'random',...options},options.seconds??7200);

for(const arsId of ['02151','02163']){
 const s=setup(arsId),out=report.stops[arsId]={name:s.graph.stop.name,routes:s.graph.nodes.length,berths:s.colors};
 const base=Object.fromEntries(RULES.map(rule=>[rule,run(s,rule,{arsId})]));

 // 1. Conservation: the same buses reach the stop under every rule, every arrival is logged once, waits add up.
 out.conservation=RULES.every(rule=>base[rule].served===base.single.served&&base[rule].log.length===base[rule].served
  &&Math.abs(base[rule].log.reduce((sum,e)=>sum+e.wait,0)-base[rule].totalWait)<1e-6);

 // 2. Seeds: 20 different start positions. Does the order single > colored > pooled hold every time?
 const seeds=Array.from({length:20},(_,i)=>i+1).map(seed=>Object.fromEntries(RULES.map(rule=>[rule,run(s,rule,{arsId,seed}).totalWait])));
 out.seeds={n:20,...Object.fromEntries(RULES.map(rule=>{const v=seeds.map(x=>x[rule]);return [rule,{mean:Math.round(mean(v)),sd:Math.round(sd(v)),min:Math.round(Math.min(...v)),max:Math.round(Math.max(...v))}];})),
  orderHeld:seeds.filter(x=>x.single>x.colored&&x.colored>=x.pooled).length};

 // 3. Length of the run: 2 h vs 6 h, compared per hour.
 out.duration=Object.fromEntries(RULES.map(rule=>[rule,{per_hour_2h:Math.round(base[rule].totalWait/2),per_hour_6h:Math.round(run(s,rule,{arsId,seconds:21600}).totalWait/6)}]));

 // 4. Dwell time 20–60 s (no field measurement yet).
 out.dwell=[20,30,40,50,60].map(dwell=>({dwell,...Object.fromEntries(RULES.map(rule=>[rule,Math.round(run(s,rule,{arsId,dwell}).totalWait)]))}));

 // 5. Average speed 12/15/18 km/h (15 is the assumption).
 out.speed=[12,15,18].map(kmh=>({kmh,...Object.fromEntries(RULES.map(rule=>[rule,Math.round(run(s,rule,{arsId,speed:kmh/3.6}).totalWait)]))}));

 // 6. "Run together" threshold k = 2..5: berths needed and the colored rule's wait.
 out.threshold=[2,3,4,5].map(minShared=>{const t=setup(arsId,minShared);return {minShared,berths:t.colors,colored:Math.round(runFor(t.preps,{focus:arsId,rule:'colored',assignment:t.assignment,berths:t.colors,dwell:40,seed:1},7200).totalWait)};});

 // 7. Share of waiting between graph-linked pairs (does the graph predict who blocks whom?).
 const links=new Set(s.graph.edges.flatMap(e=>[e.a+'|'+e.b,e.b+'|'+e.a]));
 const pairs=summarizeLog(base.single.log).pairs,total=pairs.reduce((a,p)=>a+p.totalWait,0);
 const n=s.graph.nodes.length;
 out.linkedShare={wait:Math.round(pairs.filter(p=>links.has(p.blocker+'|'+p.blocked)).reduce((a,p)=>a+p.totalWait,0)/total*100),pairsLinked:Math.round(s.graph.edges.length/(n*(n-1)/2)*100)};
}

// 8. Against reality at 02151 for the observed routes 421·463·507.
{
 const s=setup('02151'),names=['421','463','507'],ids=s.preps.filter(p=>names.includes(p.route.name)).map(p=>p.route.id);
 const nameOf=Object.fromEntries(s.preps.map(p=>[p.route.id,p.route.name]));
 // 8a. Vehicle count: N = route length / (15 km/h × planned headway) vs buses actually running.
 report.vehicles=names.map(name=>{
  const prep=s.preps.find(p=>p.route.name===name),h=prep.route.termMinutes,km=prep.length/1000;
  return {route:name,km:Math.round(km*10)/10,headway:h,simulated:Math.round(km/(15*h/60)),actual:counts.counts[name],impliedKmh:Math.round(km/(counts.counts[name]*h/60)*10)/10};
 });
 // 8b. Arrival pattern of the three routes in the simulation (pooled rule: no waiting, so arrivals = passes).
 const sim=run(s,'pooled',{arsId:'02151',seconds:7200}).log.filter(e=>ids.includes(e.route)).map(e=>e.arrival).sort((a,b)=>a-b);
 const gaps=sim.slice(1).map((t,i)=>t-sim[i]);
 const perRoute=Object.fromEntries(names.map(name=>{
  const times=run(s,'pooled',{arsId:'02151'}).log.filter(e=>nameOf[e.route]===name).map(e=>e.arrival).sort((a,b)=>a-b);
  const hw=times.slice(1).map((t,i)=>(t-times[i])/60);
  return [name,{min:Math.round(Math.min(...hw)*10)/10,max:Math.round(Math.max(...hw)*10)/10}];
 }));
 const obs=summarizeObservation(observation);
 report.arrivals={
  simulated:{passes:sim.length,within60:Math.round(gaps.filter(g=>g<=60).length/gaps.length*100),gapCv:Math.round(sd(gaps)/mean(gaps)*100)/100,perRoute},
  observed:{passes:obs.passes,within60:Math.round(obs.within/obs.gaps.length*100),randomExpected:Math.round(obs.expectedShare*100),gapCv:Math.round(sd(obs.gaps)/mean(obs.gaps)*100)/100,
   perRoute:Object.fromEntries(Object.entries(obs.byRoute).map(([k,v])=>[k,{min:Math.round(Math.min(...v.headways)*10)/10,max:Math.round(Math.max(...v.headways)*10)/10}]))}
 };
}

await writeFile(fileURLToPath(new URL('../data/public/validation.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,1));
