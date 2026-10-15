(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PokerFeedback=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // These choices depend on public actions and the same emotion labels shown in plaques.
 function actionAccent(event,priorRaises=0){
  if(event.type!=='action'||event.amount<=0||!['raise','call'].includes(event.actionType))return null;
  const allin=event.stackAfter===0,raise=event.actionType==='raise';if(!allin&&!raise)return null;
  const counter=raise&&priorRaises>0,kind=allin?'allin':counter?'reraise':event.betBefore===0?'bet':'raise';
  return {id:event.id,seat:event.seat,kind,label:allin?(raise?'全下':'全下跟注'):counter?'反加':kind==='bet'?'下注':'加注',intensity:allin?3:counter?2:1};
 }
 function emotionAccent({label='',stage='',cause=''}={}){
  if(stage==='recovery'||label==='回过神')return {kind:'recovery',intensity:1,emoji:['😮‍💨']};
  if(stage==='tilt'||/上头|被激怒/.test(label))return {kind:'anger',intensity:3,emoji:['🤬','😡','🤬','💢']};
  if(/不服|不甘|躁动|较劲/.test(label))return {kind:'anger',intensity:2,emoji:['😤','💢','😡']};
  if(/兴奋|得意|来劲|振奋|得势|兴起|跃跃欲试/.test(label))return {kind:'excited',intensity:2,emoji:['😎','🔥','😤']};
  if(/疑心/.test(label))return {kind:'doubt',intensity:2,emoji:['🤨','❓']};
  if(/紧张/.test(label))return {kind:'nervous',intensity:2,emoji:['😰','💦']};
  if(/自信|笃定|从容/.test(label))return {kind:'confident',intensity:1,emoji:['😏']};
  if(cause==='taunt'||cause==='reraise'||/警惕|专注|审视|计算中|审慎/.test(label))return {kind:'focus',intensity:1,emoji:['👀']};
  return null;
 }
 function createCursor(){let initialized=false,table=null,hand=null,seq=0,raises=0;const previous=new Map();
  return {read(state){
   const first=!initialized,changed=table!==state.tableId,newHand=changed||hand!==state.hand,start=changed?0:seq;
   if(changed){raises=0;previous.clear();}if(newHand)raises=0;
   initialized=true;table=state.tableId;hand=state.hand;seq=Math.max(changed?0:seq,state.seq||0);
   const events=(state.events||[]).filter(e=>e.seq>start&&e.hand===state.hand),actions=[],speech=new Map();let cause=false,challenged=null;
   for(const event of events){
    if(event.type==='community'||event.type==='hand-start')raises=0;
    if(event.type==='action'){const accent=actionAccent(event,raises);if(accent)actions.push(accent);if(event.actionType==='raise')raises++;cause=true;}
    if(event.type==='speech'&&Number.isInteger(event.seat)&&event.seat>=0&&event.seat<4)speech.set(event.seat,{seat:event.seat,id:event.id});
    if(event.type==='challenge'){cause=true;challenged=event.targetSeat;}
    if(event.type==='settlement')cause=true;
   }
   const reactions=[];
   for(const mood of state.emotions||[]){const old=previous.get(mood.seat),accent=emotionAccent(mood),changedLabel=old?.label!==mood.label||old?.stage!==mood.stage,newTrigger=(mood.serial||0)>(old?.serial||0);
    previous.set(mood.seat,{label:mood.label,stage:mood.stage,serial:mood.serial||0});
    if(!first&&!newHand&&cause&&accent&&(changedLabel&&(accent.intensity>=2||accent.kind==='recovery')||newTrigger&&mood.seat===challenged||newTrigger&&changedLabel||newTrigger&&accent.intensity>=2&&['reraise','pressure'].includes(mood.cause)))reactions.push({...accent,seat:mood.seat,label:mood.label,priority:accent.intensity+(mood.seat===challenged?4:0)});
   }
   if(first||state.paused||state.phase==='idle')return {actions:[],speech:[],reactions:[]};
   reactions.sort((a,b)=>b.priority-a.priority||a.seat-b.seat);
   return {actions,speech:[...speech.values()],reactions:reactions.slice(0,2)};
  }};
 }
 return {actionAccent,emotionAccent,createCursor};
});
