// 2시간 결과 계산을 화면 밖에서 돌린다(일산처럼 노선이 많으면 몇 초 걸려 화면이 멈추지 않게).
// 받는 것: {routes: 노선 원자료, jobs: [{key, options}]}. 보내는 것: {results: [{key, s}]}.
import {prepareRoute,runFor} from '/src/routesim.js';
onmessage=({data:{routes,jobs}})=>{
 const preps=routes.map(prepareRoute);
 postMessage({results:jobs.map(({key,options})=>({key,s:runFor(preps,options)}))});
};
