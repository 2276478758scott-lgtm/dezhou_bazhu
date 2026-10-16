(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PokerDialogs=api;api.mount();}})(globalThis,function(){
 'use strict';let mounted=null;
 function mount({document:doc=globalThis.document,Dialog=globalThis.HTMLDialogElement,defer=fn=>setTimeout(fn,0)}={}){
  if(!doc||!Dialog?.prototype?.showModal)return null;
  const proto=Dialog.prototype,nativeShow=proto.showModal,nativeClose=proto.close,meta=new WeakMap(),order=[],listeners=[];
  let gesture=null,source=null,closeIntent=null,destroyed=false;
  const connected=d=>d&&d.isConnected!==false;
  function top(){for(let i=order.length-1;i>=0;i--)if(connected(order[i])&&order[i].open)return order[i];return null;}
  function track(d){const i=order.indexOf(d);if(i>=0)order.splice(i,1);order.push(d);}
  function restore(d){const entry=meta.get(d),parent=entry?.parent;if(connected(parent)&&!parent.open){nativeShow.call(parent);track(parent);}const opener=entry?.opener;if(connected(opener)&&!opener.disabled&&(!parent||parent.contains(opener)))try{opener.focus?.({preventScroll:true});}catch{}}
  function dismiss(d){if(!d?.open||d!==top())return false;gesture=null;nativeClose.call(d);restore(d);return true;}
  const show=function(...args){const parent=top()||source,opener=doc.activeElement;const value=nativeShow.apply(this,args);if(parent!==this)meta.set(this,{parent:connected(parent)?parent:null,opener});track(this);return value;};
  const close=function(...args){const returning=closeIntent===this&&this.open,value=nativeClose.apply(this,args);if(returning)restore(this);return value;};
  proto.showModal=show;proto.close=close;
  function listen(target,type,fn){target?.addEventListener?.(type,fn,true);listeners.push([target,type,fn]);}
  const outside=(d,e)=>{const b=d.getBoundingClientRect();return Number.isFinite(e.clientX)&&Number.isFinite(e.clientY)&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom);};
  listen(doc,'pointerdown',e=>{gesture=null;const d=top();if(!d||e.button!==0||e.isPrimary===false||e.target!==d||!outside(d,e))return;gesture={dialog:d,pointer:e.pointerId,x:e.clientX,y:e.clientY,released:false};});
  listen(doc,'pointermove',e=>{if(gesture&&e.pointerId===gesture.pointer&&(Math.abs(e.clientX-gesture.x)>8||Math.abs(e.clientY-gesture.y)>8))gesture=null;});
  listen(doc,'pointerup',e=>{if(!gesture)return;if(e.pointerId!==gesture.pointer||e.target!==gesture.dialog||!outside(gesture.dialog,e)){gesture=null;return;}gesture.released=true;});
  listen(doc,'pointercancel',()=>{gesture=null;});
  listen(doc,'click',e=>{
   const d=top(),g=gesture;gesture=null;source=d;closeIntent=null;
   defer(()=>{source=null;closeIntent=null;});
   if(g?.released&&g.dialog===d&&e.target===d&&e.detail!==0&&outside(d,e)){e.preventDefault();e.stopImmediatePropagation();dismiss(d);return;}
   const button=e.target.closest?.('button');if(button&&(button.hasAttribute?.('data-home-close')||button.hasAttribute?.('data-dialog-close')||/^(关闭|返回主菜单|回到牌桌|关闭总结|先算了|回到牌桌查看|关闭设置)$/.test(button.textContent?.trim()||'')))closeIntent=d;
  });
  listen(doc,'cancel',e=>{if(e.target===top()){e.preventDefault();dismiss(e.target);}});
  listen(doc,'visibilitychange',()=>{if(doc.hidden)gesture=null;});listen(globalThis,'blur',e=>{if(e.target===globalThis)gesture=null;});for(const type of ['resize','pagehide'])listen(globalThis,type,()=>{gesture=null;});
  const api={top,dismiss,destroy(){if(destroyed)return;destroyed=true;for(const [target,type,fn]of listeners)target?.removeEventListener?.(type,fn,true);if(proto.showModal===show)proto.showModal=nativeShow;if(proto.close===close)proto.close=nativeClose;if(mounted===api)mounted=null;},
   message(title,text){let d=doc.getElementById('message-dialog');if(!d){d=doc.createElement('dialog');d.id='message-dialog';doc.body.append(d);}d.replaceChildren();const h=doc.createElement('h2'),p=doc.createElement('p'),b=doc.createElement('button');h.textContent=title;p.textContent=text;b.textContent='关闭';b.setAttribute('data-dialog-close','');b.onclick=()=>d.close();d.append(h,p,b);d.showModal();return d;}};
  mounted=api;return api;
 }
 return {mount,message:(title,text)=>mounted?.message(title,text)};
});
