(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PokerMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // A read-only event cursor. Restoring a checkpoint establishes a baseline, not a replay.
 function createCursor(){let baseline=false,table=null,seq=0,hand=null,actor=null;
  return {read(state){
   const first=!baseline,changed=table!==state.tableId,newHand=changed||hand!==state.hand;
   const startSeq=changed?0:seq;baseline=true;table=state.tableId;hand=state.hand;
   const events=(state.events||[]).filter(e=>e.seq>startSeq&&e.hand===state.hand);seq=Math.max(changed?0:seq,state.seq||0);
   const turn=state.actor!==actor&&state.actor!==null;actor=state.actor;
   if(first||state.paused||state.phase==='idle')return [];
   const out=[];
   for(const e of events){
    if(e.type==='hand-start'&&newHand){const seats=[];for(let n=1;n<=state.playing.length;n++){const seat=(e.dealer+n)%state.playing.length;if(state.playing[seat])seats.push(seat);}out.push({type:'deal',id:e.id,cards:[0,1].flatMap(index=>seats.map(seat=>({seat,index})))});}
    if((e.type==='blind'||e.type==='action'&&['call','raise'].includes(e.actionType))&&e.amount>0)out.push({type:'bet',id:e.id,seat:e.seat,amount:e.amount,blind:e.type==='blind'});
    if(e.type==='action'&&e.actionType==='fold')out.push({type:'fold',id:e.id,seat:e.seat});
    if(e.type==='community'){const indexes={flop:[0,1,2],turn:[3],river:[4]}[e.street];if(indexes)out.push({type:'community',id:e.id,indexes});}
   }
   if(turn&&state.phase!=='complete')out.push({type:'turn',seat:state.actor});
   return out;
  }};
 }
 function deliverCue(callback,cue){try{if(!callback)return false;callback(cue);return true;}catch{return false;}}
 function mount({formatAmount=String,onCue}={}){
  if(typeof document==='undefined'||!document.querySelector)return null;
  const stage=document.querySelector('.board-stage');if(!stage)return null;
  const layer=document.createElement('div');layer.className='motion-layer';layer.setAttribute('aria-hidden','true');stage.append(layer);
  const deck=document.getElementById('table-deck');if(!deck){layer.remove();return null;}
  const cursor=createCursor(),feedback=window.PokerFeedback?.createCursor(),reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
  let preference='full',queue=[],running=false,generation=0,table=null,hand=null,drain=Promise.resolve(),targetPot=0,paintedPot=0,potBlind=20;
  const potArea=document.getElementById('pot-chips');
  function paintPot(amount){paintedPot=Math.max(0,Math.min(targetPot,amount));window.PokerTableUI?.potChips(potArea,paintedPot,potBlind);}
  const active=new Set(),hidden=new Set(),visuals=new Set(),emotionNodes=new Map();let played=0;const feedbackCounts={actions:0,emotions:0,speech:0};
  try{const saved=localStorage.getItem('dezhou-bazhu-motion');if(['full','simple','off'].includes(saved))preference=saved;}catch{}
  const mode=()=>reduced?.matches?'off':preference;
  function paintMode(){document.body.setAttribute('data-motion-mode',mode());}
  const cardAt=(seat,index)=>document.querySelector('#seat-'+seat+'>.cards')?.children[index];
  const mask=node=>{if(node){node.setAttribute('data-motion-hidden','');hidden.add(node);}};
  const reveal=node=>{if(node){node.removeAttribute('data-motion-hidden');hidden.delete(node);}};
  const transient=(className)=>{const node=document.createElement('div');node.className=className;layer.append(node);visuals.add(node);return node;};
  function clearNode(node){node?.remove();visuals.delete(node);}
  function animate(node,keyframes,options){
   if(!node?.animate)return Promise.resolve();
   return new Promise(resolve=>{let animation,guard,ended=false;const done=()=>{if(ended)return;ended=true;clearTimeout(guard);active.delete(job);try{animation?.cancel();}catch{}resolve();};const job={node,cancel:done};
    active.add(job);try{animation=node.animate(keyframes,{easing:'cubic-bezier(.22,.75,.25,1)',...options,fill:'both'});animation.finished.then(done,done);guard=setTimeout(done,(options.delay||0)+(options.duration||0)+100);}catch{done();}
   });
  }
  function finish({keepEmotions=false}={}){generation++;queue=[];running=false;for(const job of [...active])if(!keepEmotions||!job.node?.closest('.motion-emotion'))job.cancel();for(const node of [...hidden])reveal(node);for(const node of [...visuals])if(!keepEmotions||!node.classList.contains('motion-emotion'))clearNode(node);if(!keepEmotions)emotionNodes.clear();deck.classList.remove('visible');stage.classList.remove('motion-runout');paintPot(targetPot);paintMode();window.PokerTableUI?.scheduleLayout();}
  function center(node){if(!node)return null;const box=node.getBoundingClientRect(),bounds=stage.getBoundingClientRect();if(!box.width||!box.height)return null;return {x:box.left-bounds.left+box.width/2,y:box.top-bounds.top+box.height/2,box};}
  async function actionFeedback(accent){
   if(!accent)return;const seat=document.getElementById('seat-'+accent.seat),info=seat?.querySelector('.seat-info');if(!info)return;feedbackCounts.actions++;
   const simple=mode()==='simple',tag=transient('motion-action-tag');tag.textContent=accent.label;tag.setAttribute('data-kind',accent.kind);tag.setAttribute('data-seat',accent.seat);
   if(!window.PokerTableUI.placeBeside(tag,seat))clearNode(tag);
   const tasks=[];
   if(tag.isConnected)tasks.push(animate(tag,simple?[{opacity:0},{offset:.15,opacity:1},{offset:.8,opacity:1},{opacity:0}]:[{opacity:0,transform:'scale(.65) rotate(-5deg)'},{offset:.18,opacity:1,transform:'scale(1.16) rotate(2deg)'},{offset:.32,transform:'scale(1) rotate(0deg)'},{offset:.82,opacity:1},{opacity:0,transform:'translateY(-5px) scale(.98)'}],{duration:simple?400:accent.kind==='allin'?1050:800}).then(()=>clearNode(tag)));
   if(!simple){
    tasks.push(animate(info,accent.intensity>=2?[{transform:'translateX(0)'},{offset:.2,transform:'translateX(-2px)'},{offset:.4,transform:'translateX(2px)'},{offset:.65,transform:'translateX(-1px)'},{transform:'translateX(0)'}]:[{transform:'scale(1)'},{offset:.3,transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:accent.intensity>=2?240:180}));
    const p=center(info),bounds=stage.getBoundingClientRect(),ring=transient('motion-action-ring');ring.setAttribute('data-kind',accent.kind);ring.style.left=p.box.left-bounds.left+'px';ring.style.top=p.box.top-bounds.top+'px';ring.style.width=p.box.width+'px';ring.style.height=p.box.height+'px';ring.style.borderRadius=getComputedStyle(info).borderRadius;
    tasks.push(animate(ring,[{opacity:.9,transform:'scale(1)'},{offset:.25,opacity:1},{opacity:0,transform:'scale(1.045)'}],{duration:500}).then(()=>clearNode(ring)));
    if(accent.kind==='allin')tasks.push(animate(document.querySelector('.reference-table-art'),[{transform:'translateX(0)'},{offset:.25,transform:'translateX(-2px)'},{offset:.5,transform:'translateX(2px)'},{offset:.75,transform:'translateX(-1px)'},{transform:'translateX(0)'}],{duration:170}));
    if(accent.seat===0){const button=document.getElementById(accent.kind==='allin'?'allin':'raise');tasks.push(animate(button,[{transform:'scale(.97)'},{offset:.5,transform:'scale(1.02)'},{transform:'scale(1)'}],{duration:160}));}
   }
   await Promise.all(tasks);
  }
  async function emotionFeedback(reaction){
   const seat=document.getElementById('seat-'+reaction.seat);if(!seat)return;
   const old=emotionNodes.get(reaction.seat);if(old&&Date.now()-old.at<2400)return;if(old)clearNode(old.node);
   // Give existing reactions time to be read instead of evicting them on every action.
   if(emotionNodes.size>=2&&!old)return;
   const node=transient('motion-emotion');node.setAttribute('data-kind',reaction.kind);node.setAttribute('data-seat',reaction.seat);node.setAttribute('data-emotion',reaction.label);
   const simple=mode()==='simple',emoji=reaction.emoji.slice(0,simple?1:innerHeight<=500?3:4);for(const text of emoji){const span=document.createElement('span');span.textContent=text;node.append(span);}
   if(!window.PokerTableUI.placeBeside(node,seat)){node.classList.add('compact');if(!window.PokerTableUI.placeBeside(node,seat)){clearNode(node);return;}}
   feedbackCounts.emotions++;emotionNodes.set(reaction.seat,{node,intensity:reaction.intensity,at:Date.now()});
   const tasks=[...node.children].map((span,i)=>animate(span,simple?[{opacity:0},{offset:.08,opacity:1},{offset:.88,opacity:1},{opacity:0}]:[{opacity:0,transform:'scale(.35) rotate(-10deg)'},{offset:.06,opacity:1,transform:'scale(1.2) rotate(6deg)'},{offset:.12,transform:'scale(1) rotate(0deg)'},{offset:.88,opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(-8px) scale(.95)'}],{duration:simple?2600:3000,delay:simple?0:i*70}));
   if(!simple&&reaction.kind==='anger')tasks.push(animate(seat.querySelector('.seat-avatar'),[{transform:'rotate(0)'},{offset:.2,transform:'rotate(-8deg) scale(1.12)'},{offset:.4,transform:'rotate(8deg) scale(1.12)'},{offset:.6,transform:'rotate(-4deg)'},{transform:'rotate(0) scale(1)'}],{duration:350}));
   await Promise.all(tasks);clearNode(node);if(emotionNodes.get(reaction.seat)?.node===node)emotionNodes.delete(reaction.seat);
  }
  function expressions(reactions){for(const reaction of reactions||[])void emotionFeedback(reaction).catch(()=>finish());}
  function speechFeedback(speech){window.PokerTableUI.placeBubbles();for(const entry of speech||[]){const node=document.querySelector('#seat-'+entry.seat+'>.speech-bubble:not([hidden])');if(!node)continue;feedbackCounts.speech++;void animate(node,mode()==='simple'?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(5px) scale(.92)'},{offset:.65,opacity:1,transform:'translateY(0) scale(1.025)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:mode()==='simple'?120:240});}}
  async function deal(effect,token){
   const simple=mode()==='simple';deck.classList.add('visible');const origin=center(deck);if(!origin)return;
   await Promise.all(effect.cards.map(async({seat,index},order)=>{
    const target=cardAt(seat,index),end=center(target);if(!end)return;
    if(simple){reveal(target);await animate(target,[{opacity:0},{opacity:1}],{duration:180,delay:order*60});if(token===generation){reveal(target);deliverCue(onCue,{id:effect.id+':'+seat+':'+index,kind:'deal',scope:'table'});}return;}
    const node=transient('motion-card');node.textContent='◆';node.style.width=target.offsetWidth+'px';node.style.height=target.offsetHeight+'px';node.style.left=end.x+'px';node.style.top=end.y+'px';
    const angle=index?9:-7;await animate(node,[{transform:`translate(-50%,-50%) translate(${origin.x-end.x}px,${origin.y-end.y}px) rotate(-7deg) scale(.65)`,opacity:0},{offset:.1,opacity:1},{transform:`translate(-50%,-50%) rotate(${angle}deg) scale(1)`,opacity:1}],{duration:620,delay:order*180});
    clearNode(node);if(token===generation){reveal(target);deliverCue(onCue,{id:effect.id+':'+seat+':'+index,kind:'deal',scope:'table'});}
   }));
   if(token===generation)deck.classList.remove('visible');
  }
  async function community(effect,token){
   deck.classList.add('visible');
   await Promise.all(effect.indexes.map(async(index,i)=>{const target=document.getElementById('board')?.children[index];if(!target)return;
    const simple=mode()==='simple';
    if(!simple){
     const origin=center(deck),end=center(target);if(origin&&end){const node=transient('motion-card motion-community');node.textContent='◆';node.style.width=target.offsetWidth+'px';node.style.height=target.offsetHeight+'px';node.style.left=end.x+'px';node.style.top=end.y+'px';
      await animate(node,[{transform:`translate(-50%,-50%) translate(${origin.x-end.x}px,${origin.y-end.y}px) rotate(-7deg) scale(.65)`,opacity:0},{offset:.1,opacity:1},{transform:'translate(-50%,-50%) rotate(0deg) scale(1)',opacity:1}],{duration:550,delay:i*150});clearNode(node);
     }
    }
    if(token!==generation)return;
    // The final face is revealed only after the facedown flight reaches its slot.
    reveal(target);await animate(target,simple?[{opacity:0},{opacity:1}]:[{transform:'perspective(500px) rotateY(-90deg) scale(.94)',opacity:.25},{transform:'perspective(500px) rotateY(0deg) scale(1)',opacity:1}],{duration:simple?220:450,delay:simple?i*60:0});
    if(token===generation){reveal(target);deliverCue(onCue,{id:effect.id+':board:'+index,kind:'card-place',scope:'table'});}
   }));
   if(token===generation)deck.classList.remove('visible');
  }
  const tokenSvg='<svg viewBox="0 0 40 32" focusable="false"><path d="M3 14h34v4a17 11 0 0 1-34 0Z" fill="#1a5893"/><g transform="translate(20 14) scale(1 .7)"><circle r="17" fill="#358bd7" stroke="#1a5893"/><g fill="#fff5df">'+Array.from({length:6},(_,i)=>'<rect x="-2.7" y="-16.5" width="5.4" height="5.5" rx=".5" transform="rotate('+i*60+')"/>').join('')+'<circle r="10" fill="#358bd7" stroke="#fff5df" stroke-width="1"/></g></g></svg>';
  async function bet(effect,token){
   if(effect.accent)void actionFeedback(effect.accent).catch(()=>finish());if(effect.reactions)expressions(effect.reactions);
   const source=document.querySelector('#seat-'+effect.seat+' .bankroll-chips'),info=document.querySelector('#seat-'+effect.seat+' .seat-info'),from=center(source)||center(info),to=center(potArea)||center(document.getElementById('pot'));if(!from||!to){if(token===generation)paintPot(paintedPot+effect.amount);return;}
   const label=transient('motion-amount');label.textContent='＋'+formatAmount(effect.amount);const bounds=stage.getBoundingClientRect();label.style.left=Math.max(8,Math.min(bounds.width-label.offsetWidth-8,from.x-label.offsetWidth/2))+'px';label.style.top=Math.max(4,Math.min(bounds.height-24,from.y-24))+'px';
   const simple=mode()==='simple',labelTask=animate(label,[{opacity:0,transform:'translateY(5px)'},{offset:.15,opacity:1},{offset:.8,opacity:1},{opacity:0,transform:'translateY(-10px)'}],{duration:simple?200:1000}).then(()=>clearNode(label)),flights=[];
   if(mode()==='full')for(let i=0;i<(effect.accent?.kind==='allin'?(innerHeight<=500?3:4):(innerHeight<=500?2:3));i++){
    const node=transient('motion-chip');node.innerHTML=tokenSvg;node.style.left=from.x+'px';node.style.top=from.y+'px';
    const dx=to.x-from.x+(i-1)*4,dy=to.y-from.y+(i%2?2:-1);
    flights.push(animate(node,[{transform:`translate(-50%,-50%) translate(${i*3}px,${i*2}px)`,opacity:1},{offset:.12,transform:`translate(-50%,-50%) translate(${i*3}px,${i*2}px) scale(1.03)`,opacity:1},{offset:.75,transform:`translate(-50%,-50%) translate(${dx}px,${dy-3}px) scale(1.05)`,opacity:1},{offset:.9,transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(1)`,opacity:1},{transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(1)`,opacity:0}],{duration:800,delay:i*70,easing:'cubic-bezier(.4,0,.25,1)'}).then(()=>clearNode(node)));
   }
   if(simple)await labelTask;else await Promise.all(flights);
   if(token===generation){paintPot(paintedPot+effect.amount);if(potArea&&mode()==='full')void animate(potArea,[{transform:'translateY(-2px) scale(1.04)'},{transform:'translateY(0) scale(1)'}],{duration:180});}
   await labelTask;
  }
  async function turn(seat){const target=document.querySelector('#seat-'+seat+' .seat-info');if(!target)return;const p=center(target),bounds=stage.getBoundingClientRect();if(!p)return;
   const node=transient('motion-turn');node.style.left=p.box.left-bounds.left+'px';node.style.top=p.box.top-bounds.top+'px';node.style.width=p.box.width+'px';node.style.height=p.box.height+'px';node.style.borderRadius=getComputedStyle(target).borderRadius;
   await animate(node,[{opacity:.8,transform:'scale(1)'},{opacity:0,transform:'scale(1.035)'}],{duration:mode()==='simple'?140:480});clearNode(node);
  }
  async function run(token){
   if(running)return;running=true;
   try{while(queue.length&&token===generation){const effect=queue.shift();played++;
    if(effect.type==='deal')await deal(effect,token);
    else if(effect.type==='community')await community(effect,token);
    else if(effect.type==='bet'){const group=[effect];while(queue[0]?.type==='bet'&&queue[0].blind&&effect.blind)group.push(queue.shift());await Promise.all(group.map(e=>bet(e,token)));}
    else if(effect.type==='fold'){const node=document.querySelector('#seat-'+effect.seat+'>.cards');await animate(node,[{transform:'translateY(0) scale(1)',opacity:1},{transform:'translateY(6px) scale(.94)',opacity:.53}],{duration:mode()==='simple'?100:180});}
    else if(effect.type==='expressions'){stage.classList.remove('motion-runout');expressions(effect.reactions);}
   }}catch(error){console.warn('牌桌动效已跳过：',error);if(token===generation)finish();}
   finally{if(token===generation){running=false;for(const node of [...hidden])reveal(node);deck.classList.remove('visible');stage.classList.remove('motion-runout');paintPot(targetPot);window.PokerTableUI?.scheduleLayout();}}
  }
  function sync(game,{paused=false,actor=game.actor}={}){
   // Never send hole-card values, private AI decisions or emotion internals to the planner.
   const state={tableId:game.tableId,seq:game.eventSeq,hand:game.hand,phase:game.phase,paused,actor,playing:game.players.map(p=>p.hole.length===2),emotions:game.players.flatMap((p,seat)=>seat&&p.emotion&&window.PokerEmotion?[{seat,label:window.PokerEmotion.label(p.emotion,p.profile),stage:p.emotion.stage,serial:p.emotion.reactionSerial,cause:p.emotion.cause}]:[]),events:(game.events||[]).map(e=>({id:e.id,seq:e.seq,hand:e.hand,type:e.type,actionType:e.actionType,dealer:e.dealer,seat:e.seat,amount:e.amount,street:e.street,betBefore:e.betBefore,stackAfter:e.stackAfter,targetSeat:e.targetSeat}))};
   targetPot=game.phase==='complete'?game.result.pots.filter(p=>!p.refund).reduce((n,p)=>n+p.amount,0):game.pot();potBlind=game.bb;
   if(table!==state.tableId||hand!==state.hand){finish();table=state.tableId;hand=state.hand;}
   const effects=cursor.read(state),accents=feedback?.read(state)||{actions:[],speech:[],reactions:[]};paintMode();
   if(paused||document.hidden||window.PokerTableUI?.blocked()){finish();return;}
   if(mode()==='off'||typeof layer.animate!=='function'){finish();for(const effect of effects){if(effect.type==='deal')for(const {seat,index}of effect.cards)deliverCue(onCue,{id:effect.id+':'+seat+':'+index,kind:'deal',scope:'table'});if(effect.type==='community')for(const index of effect.indexes)deliverCue(onCue,{id:effect.id+':board:'+index,kind:'card-place',scope:'table'});}return;}
   if(effects.some(e=>e.type==='deal'))paintPot(0);else if(!running&&!effects.some(e=>e.type==='bet'))paintPot(targetPot);
   if(game.phase==='complete'&&effects.some(e=>e.type==='community'))stage.classList.add('motion-runout');
   const bets=effects.filter(e=>e.type==='bet'&&!e.blind),latestBet=bets[bets.length-1];for(const effect of effects)if(effect.type==='bet')effect.accent=accents.actions.find(a=>a.id===effect.id);
   speechFeedback(accents.speech);
   if(game.phase==='complete'&&accents.reactions.length)effects.push({type:'expressions',reactions:accents.reactions});else if(latestBet)latestBet.reactions=accents.reactions;else expressions(accents.reactions);
   for(const effect of effects){
    if(effect.type==='turn'){void turn(effect.seat).catch(()=>finish());continue;}
    if(effect.type==='deal')for(const c of effect.cards)mask(cardAt(c.seat,c.index));
    if(effect.type==='community')for(const index of effect.indexes)mask(document.getElementById('board')?.children[index]);
    queue.push(effect);
   }
   if(queue.length&&!running)drain=run(generation);
  }
  function setMode(value){if(!['full','simple','off'].includes(value))return;preference=value;finish();try{localStorage.setItem('dezhou-bazhu-motion',value);}catch{}}
  const select=document.getElementById('motion-mode');if(select){select.value=preference;select.onchange=()=>setMode(select.value);}
  addEventListener('resize',finish);addEventListener('pagehide',finish);document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});if(reduced?.addEventListener)reduced.addEventListener('change',finish);else reduced?.addListener?.(finish);
  paintMode();const api={sync,finish,setMode,settled:()=>drain,stats:()=>({mode:mode(),preference,queued:queue.length,running,dealing:[...visuals].some(n=>n.classList.contains('motion-card')&&!n.classList.contains('motion-community')),active:active.size,hidden:hidden.size,transient:visuals.size,played,paintedPot,targetPot,feedback:{...feedbackCounts},activeEmotions:emotionNodes.size})};window.PokerMotionView=api;return api;
 }
 return {createCursor,mount,deliverCue};
});
