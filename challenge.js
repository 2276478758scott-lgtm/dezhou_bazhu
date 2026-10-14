(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./emotion.js'):r.PokerEmotion,typeof module==='object'&&module.exports?require('./dialogue-data.js'):r.PokerDialogue);if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerChallenge=a;})(globalThis,(M,D)=>{
  'use strict';const presets=['来，我就跟你干了！😤🔥','你敢跟吗？别光看啊😏','别怂，来来来，谁怕谁！🤬'];
  const split=text=>typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter('zh-CN',{granularity:'grapheme'}).segment(text)].map(s=>s.segment):Array.from(text);
  const INTENTS={challenge:{name:'挑衅',lines:presets},weak:{name:'示弱',lines:['这手没底气啊，先缓缓😅','我有点慌，你别催😬','不太敢了，先看看吧🙃']},pressure:{name:'施压',lines:['后面我还会加，你想清楚😏','这池我想拿，你还接吗？👀','你的筹码得掂量掂量了😤']},bluster:{name:'虚张声势',lines:['这次我可不往后退😎','来，看谁先撑不住🔥','我今天就坐这儿，接着来😤']}};
  function key(g){return g.hand+':'+g.phase+':'+g.history.filter(a=>!['taunt','speech'].includes(a.type)).length;}
  function available(g){const state=g.challenges?.hand===g.hand?g.challenges:{used:0,keys:[]};return g.actor===0&&!['idle','complete'].includes(g.phase)&&state.used<2&&!state.keys.includes(key(g));}
  function send(g,target,text,recent=[]){
    if(!available(g))throw new Error('轮到你时可开干，每手最多两次，同一次出牌机会只能一次。');
    if(!Number.isInteger(target)||target<1||!g.players[target]||g.players[target].folded||g.players[target].stack===0||g.players[target].hole.length!==2)throw new Error('请选择仍能行动的 AI。');
    if(typeof text!=='string'||!text.trim()||split(text.trim()).length>40)throw new Error('发言须为 1–40 个字或表情。');
    const p=g.players[target],lines=D.TAUNT[p.profile]||D.TAUNT.calculator,choices=lines.filter(t=>!recent.slice(-8).includes(t)),pool=choices.length?choices:lines;
    const reply=pool[Math.min(pool.length-1,Math.floor((g.random?.speech||g.rng)()*pool.length))];
    const state=g.challenges?.hand===g.hand?g.challenges:{hand:g.hand,used:0,keys:[]};state.used++;state.keys.push(key(g));g.challenges=state;
    const mood=p.emotion||(p.emotion=M.initial());
    if(/没底气|先缓缓|有点慌|不太敢/.test(text)){mood.doubt=Math.min(1,mood.doubt+.1);mood.focus=Math.min(1,mood.focus+.12);M.trigger(mood,p.profile,'weak',0);}
    else M.provoke(mood,p.profile,/后面我还会加|想拿|掂量/.test(text)?.7:1);
    const event={seat:0,type:'taunt',targetSeat:target,text:text.trim(),phase:g.phase,hand:g.hand,amount:0,potBefore:g.pot(),betBefore:g.currentBet};g.history.push(event);
    const language=typeof module==='object'&&module.exports?require('./language.js'):globalThis.PokerLanguage;const spoken=language?language.choose(p.profile,'call',{emotion:p.emotion},recent,g.random?.speech||g.rng):reply;return {text:event.text,reply:spoken,target};
  }
  function speak(g,target,intent,index,recent=[]){const bank=INTENTS[intent];if(!bank||!Number.isInteger(index)||!bank.lines[index])throw Error('请选择有效快捷台词');return send(g,target,bank.lines[index],recent);}
  return {presets,INTENTS,speak,key,available,send};
});
