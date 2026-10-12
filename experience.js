(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./dialogue-data.js'):r.PokerDialogue);if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerExperience=a;})(globalThis,D=>{
  'use strict';
  const pacing={standard:{think:[1400,2200],hold:[2800,4600]},immersive:{think:[2200,3200],hold:[4200,6500]},quick:{think:[400,700],hold:[1000,1800]}};
  function timing(pace,type,text='',rng=Math.random){const p=pacing[pace]||pacing.standard;return {think:Math.round(p.think[0]+rng()*(p.think[1]-p.think[0])+(type==='raise'?300:0)),hold:Math.round(Math.min(p.hold[1],Math.max(p.hold[0],text.length*(pace==='quick'?40:90))))};}
  function speech(seat,type,model,previous='',rng=Math.random,targetPresent=true){const id=['calculator','maniac','trapper','rock'][seat]||'calculator',style=model?.confident&&targetPresent?model.style:'unknown';const lines=D.OPPONENT[id][style]||D.LINES[id][type]||['👀'];const choices=lines.filter(t=>t!==previous),pool=choices.length?choices:lines;return pool[Math.max(0,Math.min(pool.length-1,Math.floor(rng()*pool.length)))];}
  const styleText={unknown:'对手还在摸你的路数👀',aggressive:'你最近挺凶，对手记着呢🤨',tight:'你打得稳，对手开始试探了👀',calling:'你挺能跟，他们发现了🤔',balanced:'你这打法，他们还在琢磨👀'};
  return {timing,speech,styleText};
});
