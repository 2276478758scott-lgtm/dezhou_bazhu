'use strict';
importScripts('core.js','emotion.js','ai.js');
onmessage=e=>{const {id,view}=e.data;try{
  const rng=PokerStateRandom(e.data.seed),limit=view.profile==='professor'?192:72;let won=0,samples=0,start=performance.now();
  while(samples<limit){const n=Math.min(16,limit-samples);won+=PokerAI.equity(view,rng,n)*n;samples+=n;if(performance.now()-start>250)break;}
  const eq=won/samples;postMessage({id,move:PokerAI.strategy(view,eq,undefined,rng),samples});
}catch(error){postMessage({id,error:error.message});}};
function PokerStateRandom(seed){let value=seed>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
