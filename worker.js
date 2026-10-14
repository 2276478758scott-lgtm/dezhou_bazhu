'use strict';
importScripts('kernel.js','core.js','emotion.js','ai.js','strategy.js');
onmessage=e=>{const {id,view}=e.data;try{const rng=PokerStateRandom(e.data.seed),report=PokerStrategy.analyze(view,rng,view.profile==='professor'?192:72,{actualHoles:e.data.actualHoles||null});postMessage({id,move:e.data.task==='equity'?null:PokerStrategy.decide(view,report,rng),report,samples:report.samples});}catch(error){postMessage({id,error:error.message});}};
function PokerStateRandom(seed){let value=seed>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
