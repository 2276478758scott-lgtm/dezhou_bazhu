(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./audio-data.js'):root.PokerAudioData);if(typeof module==='object'&&module.exports)module.exports=api;else root.PokerAudio=api;})(globalThis,function(bank){
 'use strict';
 const KEY='dezhou-bazhu-audio-v1';
 const tones={click:['chip-tap',.32,1],adjust:['chip-tap',.2,0],check:['chip-tap',.55,1],fold:['card-fold',.55,0],bet:['chips-collide',1,1],allin:['chips-allin',1,2],deal:['card-slide',.55,0],'card-place':['card-place',.65,0],turn:['chip-tap',.42,3],'result-win':['chips-stack',.9,4],'result-loss':['card-place',.45,3],'result-tie':['chip-tap',.45,3]};
 function create({contextFactory=()=>{const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;return Constructor?new Constructor({latencyHint:'interactive'}):null;},storage,clock=()=>globalThis.performance?.now?.()??Date.now()}={}){
  let enabled=true,volume=.35,ctx=null,master=null,unlocked=false,available=true,tableActive=false,destroyed=false,pending=null;
  const voices=[],seen=new Set(),last=new Map(),buffers=new Map();
  function loadBuffers(){for(const [name,sample]of Object.entries(bank||{})){const binary=atob(sample.pcm),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),length=bytes.length/2/sample.channels,buffer=ctx.createBuffer(sample.channels,length,sample.sampleRate);for(let channel=0;channel<sample.channels;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<length;i++)data[i]=view.getInt16((i*sample.channels+channel)*2,true)/32768;}buffers.set(name,{buffer,duration:length/sample.sampleRate});}}
  try{const value=JSON.parse(storage?.getItem(KEY)||'null');if(value?.version===1&&typeof value.enabled==='boolean'&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1){enabled=value.enabled;volume=value.volume;}}catch{}
  function save(){try{storage?.setItem(KEY,JSON.stringify({version:1,enabled,volume}));}catch{}}
  function remove(voice){const i=voices.indexOf(voice);if(i>=0)voices.splice(i,1);for(const node of voice.nodes)try{node.disconnect();}catch{}}
  function stop(voice){for(const node of voice.sources)try{node.stop();}catch{}remove(voice);}
  function stopAll(){for(const voice of [...voices])stop(voice);last.clear();}
  function contextChanged(){if(ctx?.state!=='running'){unlocked=false;stopAll();}}
  function status(){return {enabled,volume,available,unlocked:unlocked&&ctx?.state==='running',voices:voices.length};}
  async function unlock(){
   if(destroyed||!enabled)return false;if(pending)return pending;
   pending=(async()=>{try{if(!ctx){ctx=contextFactory();if(!ctx){available=false;return false;}master=ctx.createGain();master.gain.value=volume;master.connect(ctx.destination);loadBuffers();ctx.addEventListener?.('statechange',contextChanged);}if(ctx.state!=='running'){stopAll();await ctx.resume();}unlocked=!destroyed&&ctx.state==='running';if(unlocked)available=true;return unlocked;}catch{unlocked=false;available=false;return false;}})();
   const result=await pending;pending=null;return result;
  }
  function play(kind,{id,scope='table'}={}){
   const tone=tones[kind];if(destroyed||!enabled||volume===0||!unlocked||ctx?.state!=='running'||scope==='table'&&!tableActive||!tone||id&&seen.has(id))return false;
   const now=clock(),gap=kind==='adjust'?120:kind==='deal'?50:kind==='click'?35:0;if(last.has(kind)&&now-last.get(kind)<gap)return false;
   for(const voice of [...voices])if(voice.until<=ctx.currentTime)stop(voice);
   const priority=tone[2];if(voices.length>=4){const low=[...voices].sort((a,b)=>a.priority-b.priority||a.started-b.started)[0];if(low.priority>priority)return false;stop(low);}
   let voice=null;
   try{
    const sample=buffers.get(tone[0]);if(!sample)return false;const {duration,buffer}=sample,t=ctx.currentTime,gain=ctx.createGain();voice={priority,started:now,until:t+duration+.02,nodes:[gain],sources:[]};
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(tone[1],t+.003);gain.gain.setValueAtTime(tone[1],t+Math.max(.004,duration-.012));gain.gain.linearRampToValueAtTime(0,t+duration);gain.connect(master);
    const source=ctx.createBufferSource();source.buffer=buffer;source.connect(gain);
    voice.sources.push(source);voice.nodes.push(source);source.onended=()=>remove(voice);voices.push(voice);source.start(t);source.stop(t+duration+.01);
    last.set(kind,now);if(id){seen.add(id);if(seen.size>512)seen.delete(seen.values().next().value);}return true;
   }catch{if(voice)stop(voice);return false;}
  }
  return {unlock,play,status,stopAll,setTableActive(value){tableActive=!!value;if(!tableActive)stopAll();},
   setEnabled(value){enabled=!!value;if(!enabled)stopAll();save();},setVolume(value){if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));if(master)master.gain.value=volume;if(!volume)stopAll();save();},
   destroy(){if(destroyed)return;destroyed=true;stopAll();ctx?.removeEventListener?.('statechange',contextChanged);if(ctx)try{Promise.resolve(ctx.close()).catch(()=>{});}catch{}unlocked=false;}};
 }
 function createCursor(){let initialized=false,table=null,seq=0,lastTurn=null;
  return {read(state){const first=!initialized,changed=table!==state.tableId,start=changed?0:seq;initialized=true;table=state.tableId;seq=Math.max(start,state.seq||0);
   const events=(state.events||[]).filter(e=>e.seq>start&&e.hand===state.hand),action=(state.events||[]).filter(e=>['action','blind','hand-start','community'].includes(e.type)).slice(-1)[0];
   const key=[table,state.hand,state.phase,action?.seq??0].join('/');
   if(first||changed||state.paused){if(state.actor===0)lastTurn=key;else if(changed)lastTurn=null;return [];}
   const out=[];for(const e of events){if(e.type!=='action')continue;const kind=e.stackAfter===0&&e.amount>0?'allin':['call','raise'].includes(e.actionType)&&e.amount>0?'bet':e.actionType==='check'?'check':e.actionType==='fold'?'fold':null;if(kind)out.push({id:e.id,kind,scope:'table'});}
   if(state.canAct&&state.actor===0&&key!==lastTurn){lastTurn=key;out.push({id:key+':turn',kind:'turn',scope:'table'});}return out;
  }};
 }
 function mount(){
  if(typeof document==='undefined')return null;let storage;try{storage=globalThis.localStorage;}catch{}
  const service=create({storage}),get=id=>document.getElementById(id),toggle=get('sound-enabled'),slider=get('sound-volume'),label=get('sound-value'),state=get('sound-state');
  const update=()=>{const s=service.status();if(toggle)toggle.checked=s.enabled;if(slider)slider.value=Math.round(s.volume*100);if(label)label.textContent=Math.round(s.volume*100)+'%';if(state)state.textContent=!s.available?'当前浏览器暂时无法播放音效，游戏可继续。':!s.enabled?'音效已关闭':!s.unlocked?'点击后启用声音':'音效已就绪';};
  const unlock=()=>{void service.unlock().then(update);};
  document.addEventListener('pointerdown',e=>{if(e.isTrusted)unlock();},{capture:true});document.addEventListener('keydown',e=>{if(e.isTrusted&&['Enter',' '].includes(e.key))unlock();},{capture:true});
  if(toggle)toggle.onchange=()=>{service.setEnabled(toggle.checked);if(toggle.checked)unlock();update();};
  if(slider)slider.oninput=()=>{service.setVolume(Number(slider.value)/100);update();};
  const preview=get('sound-preview');if(preview)preview.onclick=async()=>{await service.unlock();service.play(get('sound-preview-type')?.value||'bet',{scope:'ui'});update();};
  document.addEventListener('click',e=>{if(!e.isTrusted)return;const button=e.target.closest?.('button');if(!button||button.disabled||button.closest('[inert]')||/^(fold|call|raise|allin|raise-down|raise-up|sound-preview)$/.test(button.id)||button.hasAttribute('data-size'))return;service.play('click',{scope:'ui'});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)service.setTableActive(false);});globalThis.addEventListener?.('pagehide',()=>service.setTableActive(false));update();return service;
 }
 return {create,createCursor,mount};
});
