import {scenario} from '../src/scenario.js';
import {simulate} from '../src/simulation.js';
console.log(JSON.stringify({source:'synthetic',baseline:simulate(scenario,'baseline').metrics,staggered:simulate(scenario,'staggered').metrics},null,2));

