(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerKernel=a;})(globalThis,()=>{
  'use strict';
  const STREAMS=['deal','ai','speech','identity','analysis','fx'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  function random(seed){let n=seed>>>0;const fn=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};Object.defineProperty(fn,'state',{get:()=>n});return fn;}
  function streams(seed,states){const out={};for(const name of STREAMS){let n=seed>>>0;for(const c of name)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;out[name]=random(states?.[name]??n);}return out;}
  function states(g){return Object.fromEntries(STREAMS.map(k=>[k,g.random[k].state]));}
  function emit(g,type,data={},privateData=null){
    g.events||=[];g.eventSeq=(g.eventSeq||0)+1;
    const payload=clone(data);if(payload.type!==undefined){payload.actionType=payload.type;delete payload.type;}
    const event={...payload,version:1,id:g.tableId+':'+g.eventSeq,tableId:g.tableId,campaignId:g.campaignId||null,mode:g.mode||'quick',hidden:!!g.pokerface?.enabled,seriesId:g.match?.runId||g.match&&g.tableId||null,stageIndex:g.match?.index??null,hand:g.hand,seq:g.eventSeq,at:Date.now(),type,phase:g.phase,actor:g.actor,board:(g.board||[]).slice()};
    if(privateData)event.private=clone(privateData);g.events.push(event);return event;
  }
  // Public projections never carry unpublished cards, strategy metadata or identity.
  function publicEvent(event,{viewer=null,completed=false,identityRevealed=false}={}){
    const out=clone(event),secret=out.private;delete out.private;
    if(secret?.holes){if(completed)out.holes=clone(secret.holes);else if(viewer!==null&&secret.holes[viewer])out.ownHole=secret.holes[viewer].slice();}
    if(completed&&secret?.emotions)out.emotions=clone(secret.emotions);
    if(completed&&secret?.decision)out.decision=clone(secret.decision);if(completed&&secret?.responseSerial!==undefined)out.responseSerial=secret.responseSerial;
    if(identityRevealed&&secret?.identities)out.identities=clone(secret.identities);
    if(!identityRevealed){const scrub=x=>{if(!x||typeof x!=='object')return;for(const key of ['role','profile','roleName'])delete x[key];Object.values(x).forEach(scrub);};scrub(out);}
    return out;
  }
  function validateEvents(g){
    if(!Array.isArray(g.events)||typeof g.tableId!=='string'||g.tableId.length>100||!Number.isSafeInteger(g.eventSeq)||g.eventSeq<0)throw Error('事件存档无效');
    let last=0;for(const e of g.events){if(e.version!==1||e.tableId!==g.tableId||!Number.isSafeInteger(e.seq)||e.seq<=last||e.seq>g.eventSeq||e.id!==g.tableId+':'+e.seq||!Number.isSafeInteger(e.hand)||e.hand<0||e.hand>g.hand||typeof e.type!=='string'||!Array.isArray(e.board)||e.board.some(c=>!Number.isInteger(c)||c<0||c>51))throw Error('事件顺序或编号无效');last=e.seq;}
  }
  return {STREAMS,clone,random,streams,states,emit,publicEvent,validateEvents};
});
