(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./dialogue-data.js'):r.PokerDialogue,typeof module==='object'&&module.exports?require('./emotion.js'):r.PokerEmotion);if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerLanguage=a;})(globalThis,(D,M)=>{
  'use strict';
  function limit(text,max=48){const graphemes=typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter('zh-CN',{granularity:'grapheme'}).segment(text)].map(x=>x.segment):Array.from(text);return graphemes.length>max?graphemes.slice(0,max-1).join('')+'…':text;}
  function choose(id,event,{emotion=null,model=null,targetPresent=true}={},recent=[],rng=Math.random){
    const key=D.LINES[id]?id:'calculator',bank=D.LINES[key],base=bank[event]||bank.check,c=M.config(key),reactive=['maniac','gambler','millionaire'].includes(key);let pool=base;const triggered=emotion&&(emotion.reactionSerial||0)>(emotion.spokenSerial||0)&&D.TRIGGERS?.[key]?.[emotion.cause];if(triggered)pool=triggered;
    // Contextual reactions replace a sentence; nothing is glued to a fixed ending.
    let reactions=null;
    if(emotion?.frustration>c.f&&['raise','call','allin','lose'].includes(event))reactions=D.MOODS[key].anger;
    else if(emotion?.confidence>c.high&&['raise','value','steal','win'].includes(event))reactions=D.MOODS[key].confidence;
    else if(emotion?.pressure>c.p&&['call','check','allin'].includes(event))reactions=D.MOODS[key].pressure;
    else if(emotion?.focus>.22&&['call','check','raise'].includes(event))reactions=D.FOCUS[key];
    else if(targetPresent&&model?.confident&&event==='raise')reactions=D.OPPONENT[key][model.style];
    if(!triggered&&reactions&&rng()<(emotion?.frustration>.60&&reactive?.85:reactive?.60:.35))pool=reactions;
    if(!triggered&&['call','check'].includes(event)&&!reactions&&rng()>.88)return '';
    let available=pool.filter(text=>!recent.slice(-8).includes(text));
    if(!available.length&&!triggered)available=base.filter(text=>!recent.slice(-8).includes(text));
    if(!available.length)available=pool.filter(text=>text!==recent[recent.length-1]);
    if(!available.length)available=pool;
    const text=available[Math.max(0,Math.min(available.length-1,Math.floor(rng()*available.length)))];return limit(text);
  }
  return {LINES:D.LINES,events:D.events,choose,limit,audit:{moods:D.MOODS,focus:D.FOCUS,opponent:D.OPPONENT,standaloneReactions:true}};
});
