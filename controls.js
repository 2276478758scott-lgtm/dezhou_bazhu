(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PokerControls=api;})(globalThis,function(){
 'use strict';
 function createDraft(){
  let key=null,text='',limits={min:0,max:0,step:1,bet:0};
  function view(){const trimmed=text.trim(),n=/^\d+$/.test(trimmed)?Number(trimmed):NaN;
   const error=!Number.isSafeInteger(n)?'请输入有效的整数金额。':n<limits.min||n>limits.max?'金额需在 '+limits.min+'–'+limits.max+' 之间。':null;
   return {text,total:error?null:n,additional:error?null:Math.max(0,n-limits.bet),error};
  }
  function setPreset(amount){text=String(Math.max(limits.min,Math.min(limits.max,amount)));}
  return {sync(next,nextLimits){limits={...nextLimits};if(key!==next){key=next;text=String(limits.min);}},edit(value){text=String(value);},view,setPreset,
   step(direction){const previous=text,v=view();setPreset((v.total??limits.min)+direction*limits.step);return previous!==text;}};
 }
 function readingHold(pace,hold){return pace==='quick'?hold:Math.max(3000,hold);}
 function bindStepper(element,{onStep,canStep,delay=350,interval=90,timers=globalThis}){
  let pointer=null,timer=null,suppress=false,destroyed=false;const listeners=[];
  function listen(target,type,fn){target?.addEventListener?.(type,fn);listeners.push([target,type,fn]);}
  function cancel(){timers.clearTimeout(timer);timer=null;const old=pointer;pointer=null;element.classList?.remove('is-pressed');if(old!==null)try{element.releasePointerCapture?.(old);}catch{}}
  function allowed(){return !destroyed&&!element.disabled&&canStep();}
  function repeat(){if(pointer===null||!allowed()){cancel();return;}onStep();timer=timers.setTimeout(repeat,interval);}
  listen(element,'pointerdown',event=>{if(pointer!==null||event.isPrimary===false||event.button!==0||!allowed())return;pointer=event.pointerId;suppress=true;element.classList?.add('is-pressed');try{element.setPointerCapture?.(pointer);}catch{}onStep();timer=timers.setTimeout(repeat,delay);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(element,type,event=>{if(event.pointerId===pointer)cancel();});
  listen(element,'pointermove',event=>{if(event.pointerId!==pointer)return;const box=element.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)cancel();});
  for(const type of ['blur','resize','pagehide'])listen(globalThis,type,cancel);
  listen(element.ownerDocument,'visibilitychange',()=>{if(element.ownerDocument.hidden)cancel();});
  const oldClick=element.onclick;const click=event=>{if(event&&event.detail!==0&&suppress){suppress=false;return;}suppress=false;if(allowed())return onStep();};element.onclick=click;
  return {cancel,destroy(){cancel();destroyed=true;for(const [target,type,fn]of listeners)target?.removeEventListener?.(type,fn);if(element.onclick===click)element.onclick=oldClick;}};
 }
 return {createDraft,readingHold,bindStepper};
});
