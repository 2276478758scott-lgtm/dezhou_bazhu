(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./emotion.js'):r.PokerEmotion,typeof module==='object'&&module.exports?require('./dialogue-data.js'):r.PokerDialogue);if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerChallenge=a;})(globalThis,(M,D)=>{
  'use strict';const presets=['来，我就跟你干了！😤🔥','你敢跟吗？别光看啊😏','别怂，来来来，谁怕谁！🤬'];
  const split=text=>typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter('zh-CN',{granularity:'grapheme'}).segment(text)].map(s=>s.segment):Array.from(text);
  function key(g){return g.hand+':'+g.phase+':'+g.history.filter(a=>a.type!=='taunt').length;}
  function available(g){const state=g.challenges?.hand===g.hand?g.challenges:{used:0,keys:[]};return g.actor===0&&!['idle','complete'].includes(g.phase)&&state.used<2&&!state.keys.includes(key(g));}
  function send(g,target,text,recent=[]){
    if(!available(g))throw new Error('轮到你时可开干，每手最多两次，同一次出牌机会只能一次。');
    if(!Number.isInteger(target)||target<1||!g.players[target]||g.players[target].folded||g.players[target].stack===0||g.players[target].hole.length!==2)throw new Error('请选择仍能行动的 AI。');
    if(typeof text!=='string'||!text.trim()||split(text.trim()).length>40)throw new Error('发言须为 1–40 个字或表情。');
    const p=g.players[target],lines=D.TAUNT[p.profile]||D.TAUNT.calculator,choices=lines.filter(t=>!recent.slice(-8).includes(t)),pool=choices.length?choices:lines;
    const reply=pool[Math.min(pool.length-1,Math.floor(g.rng()*pool.length))];
    const state=g.challenges?.hand===g.hand?g.challenges:{hand:g.hand,used:0,keys:[]};state.used++;state.keys.push(key(g));g.challenges=state;
    M.provoke(p.emotion||(p.emotion=M.initial()),p.profile);
    const event={seat:0,type:'taunt',targetSeat:target,text:text.trim(),phase:g.phase,hand:g.hand,amount:0,potBefore:g.pot(),betBefore:g.currentBet};g.history.push(event);
    return {text:event.text,reply,target};
  }
  return {presets,key,available,send};
});
