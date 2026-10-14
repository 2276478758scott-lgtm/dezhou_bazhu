(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./core.js'):r.Poker,typeof module==='object'&&module.exports?require('./ai.js'):r.PokerAI);if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerStrategy=a;})(globalThis,(P,A)=>{
 'use strict';const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function candidates(v){const l=v.legal,moves=[{type:'fold'}];if(l.check)moves.push({type:'check'});if(l.call)moves.push({type:'call'});if(l.raise){const targets=[l.minRaiseTo,...[.5,1,1.5].map(n=>clamp(v.currentBet+Math.round((v.pot+l.toCall)*n),l.minRaiseTo,l.maxRaiseTo)),l.maxRaiseTo];for(const target of new Set(targets))moves.push({type:'raise',target});}return moves;}
 function pots(v,move){const us=v.seats[v.seat],totals=v.seats.map(q=>q.total),cost=move.type==='call'?v.legal.callAmount:move.type==='raise'?move.target-us.bet:0;totals[v.seat]+=cost;
  if(move.type==='raise')for(const q of v.seats)if(q.seat!==v.seat&&!q.folded&&q.playing)totals[q.seat]+=Math.max(0,Math.min(q.stack,move.target-q.bet));
  const levels=[...new Set(totals.filter(n=>n>0))].sort((a,b)=>a-b);let before=0;return {cost,pots:levels.map(level=>{const contributors=v.seats.filter(q=>totals[q.seat]>=level),eligible=contributors.filter(q=>!q.folded&&q.playing).map(q=>q.seat),amount=(level-before)*contributors.length;before=level;return {amount,lower:level-amount/contributors.length,upper:level,eligible,refund:contributors.length===1,contributors:contributors.map(q=>q.seat)};})};
 }
 function sample(v,rng,actualHoles){const known=[...v.hole,...v.board];if(actualHoles)for(const [i,h]of actualHoles.entries())if(i!==v.seat)known.push(...h);const used=new Set(known),deck=P.shuffle(Array.from({length:52},(_,i)=>i).filter(c=>!used.has(c)),rng),hands={};hands[v.seat]=v.hole;
  for(const q of v.seats){if(q.seat===v.seat||q.folded||!q.playing)continue;if(actualHoles?.[q.seat]?.length===2){hands[q.seat]=actualHoles[q.seat];continue;}let h=[deck.pop(),deck.pop()];const model=A.modelOpponent(q),floor=q.lastAction==='raise'?.66-Math.min(.2,model.aggression*.4):.38;
   const last=(v.history||[]).filter(a=>a.seat===q.seat&&['raise','call','check','fold'].includes(a.type)).at(-1),read=v.memory?.reads?.[q.seat];
   const plausible=hole=>{if(A.preflop(hole)<floor)return false;if(v.board.length>=3&&last?.type==='raise'){const made=P.evaluate([...hole,...v.board])[0]>=1,draw=A.texture({...v,hole}).draw,bluffs=Math.min(.4,.14+model.aggression*.3+(read?(read.weakRaises||0)/((read.reveals||0)+4)*.1:0));return made||draw||rng()<bluffs;}return true;};
   for(let k=0;k<3&&!plausible(h)&&rng()<.75;k++){deck.unshift(...h);h=[deck.pop(),deck.pop()];}hands[q.seat]=h;
  }const board=v.board.slice();while(board.length<5)board.push(deck.pop());const scores={};for(const [i,h]of Object.entries(hands))scores[i]=P.evaluate([...h,...board]);return scores;
 }
 function share(scores,eligible,seat){if(!eligible.includes(seat))return 0;let ties=1;for(const i of eligible){if(i===seat)continue;const c=P.compare(scores[i],scores[seat]);if(c>0)return 0;if(c===0)ties++;}return 1/ties;}
 function analyze(v,rng=Math.random,samples=72,{actualHoles=null,budgetMs=250}={}){const list=candidates(v).filter(m=>m.type!=='fold').map(move=>({move,...pots(v,move)})),groups=new Map();for(const c of list)for(const p of c.pots)if(p.eligible.includes(v.seat)&&!p.refund)groups.set(p.eligible.join(','),p.eligible);
  const sums=new Map([...groups.keys()].map(k=>[k,0])),start=typeof performance!=='undefined'?performance.now():Date.now();let n=0;
  for(;n<samples;n++){const scores=sample(v,rng,actualHoles);for(const [key,eligible]of groups)sums.set(key,sums.get(key)+share(scores,eligible,v.seat));if(n>=15&&((typeof performance!=='undefined'?performance.now():Date.now())-start)>budgetMs){n++;break;}}
  const reports=list.map(c=>{let expected=0,total=0;const layers=c.pots.map(p=>{const ours=p.eligible.includes(v.seat),eq=p.refund?(p.contributors[0]===v.seat?1:0):ours?sums.get(p.eligible.join(','))/Math.max(1,n):0;let fe=0;
    if(ours&&c.move.type==='raise'&&!p.refund){const opponents=p.eligible.filter(i=>i!==v.seat);fe=opponents.length?opponents.reduce((a,i)=>a*(v.seats[i].stack===0?0:clamp(.22+A.modelOpponent(v.seats[i]).foldRate*.6,.08,.8)),1):0;}
    // Folded players pay no new call; fold gains include only currently committed chips.
    const committed=p.contributors.reduce((sum,i)=>sum+Math.max(0,Math.min(v.seats[i].total,p.upper)-p.lower),0);
    expected+=ours?(fe*committed+(1-fe)*eq*p.amount):0;if(ours&&!p.refund)total+=p.amount;return {...p,eq,foldChance:fe};});
   const weighted=layers.reduce((sum,p)=>sum+(p.eligible.includes(v.seat)&&!p.refund?p.eq*p.amount:0),0);return {move:c.move,cost:c.cost,expected,ev:expected-c.cost,eq:total?weighted/total:1,pots:layers};});
  const passive=reports.find(c=>c.move.type===(v.legal.call?'call':'check'));reports.unshift({move:{type:'fold'},cost:0,expected:0,ev:0,eq:0,pots:[]});return {samples:n,eq:passive?.eq??1,odds:v.legal.callAmount/Math.max(1,passive?.pots.filter(p=>p.eligible.includes(v.seat)).reduce((n,p)=>n+p.amount,0)||v.pot),candidates:reports};
 }
 function begin(g){for(const p of g.players){p.aiMemory||={reads:{}};if(p.profile==='chameleon'){let s=p.aiMemory.skin;if(!s||s.left<=0)s={kind:['pressure','value','induce'][Math.floor(g.random.ai()*3)],left:2+Math.floor(g.random.ai()*3)};s.left--;p.aiMemory.skin=s;}}}
 function personality(v){const p={...A.PROFILES[v.profile]},us=v.seats[v.seat],model=A.modelOpponent(v.seats[0]);
  if(v.profile==='chameleon'){const kind=v.memory?.skin?.kind||'value';Object.assign(p,kind==='pressure'?{aggression:.86,bluff:.28,range:.40}:kind==='induce'?{aggression:.38,trap:.58,bluff:.12}:{aggression:.58,range:.60,bluff:.06});}
  if(v.profile==='mirror'&&model.samples>=6){p.aggression=clamp(model.aggression*1.7,.3,.86);p.size=clamp(.6+model.bigBetRate*2,.55,1.3);p.loose=clamp(model.callRate*.18-.06,-.04,.08);}
  if(v.profile==='comeback'&&us.stack/v.bb<20){p.range=.60;p.bluff=.08;p.loose=-.06;p.size=1.15;}
  if(v.profile==='collector'){const ranks=v.hole.map(P.rank),good=ranks[0]===ranks[1]&&ranks[0]<=9||P.suit(v.hole[0])===P.suit(v.hole[1])&&Math.abs(ranks[0]-ranks[1])<=2,effective=Math.min(us.stack,Math.max(0,...v.seats.filter(q=>q.seat!==v.seat&&!q.folded).map(q=>q.stack)));if(good&&effective/v.bb>=40&&v.legal.callAmount<=v.bb*2)p.range=.28;else p.loose-=.04;}
  const statement=(v.history||[]).filter(e=>['taunt','speech'].includes(e.type)&&e.targetSeat===v.seat).at(-1)?.text||'';
  if(/没底气|有点慌|不太敢/.test(statement)){p.bluff+=['professor','stealer','maniac'].includes(v.profile)?.035:.01;p.aggression=Math.min(.96,p.aggression+.03);}
  if(/后面我还会加|掂量/.test(statement)&&['rock','calculator','comeback'].includes(v.profile))p.range+=.02;
  if(v.rival){if(v.profile==='catcher')p.loose+=Math.min(.06,v.rival.suspicion*.06);if(v.profile==='maniac')p.bluff+=v.rival.hostility*.05;if(['professor','rock','sniper','comeback'].includes(v.profile))p.range+=v.rival.respect*.02;}return p;
 }
 function decide(v,report,rng){const profile=personality(v),move=A.strategy(v,report.eq,profile,rng),history=v.history||[],lastRaise=history.filter(a=>a.type==='raise').at(-1),plan=v.memory?.plan;
  let chosen=move;
  if(v.profile==='chameleon'&&v.memory?.skin?.kind==='induce'&&report.eq>.68&&rng()<.65){if(v.legal.check)chosen={type:'check',reason:'induce',eq:report.eq,odds:report.odds};else if(v.memory?.plan?.kind!=='induce'&&report.candidates.some(c=>c.move.type==='call'&&c.ev>=0))chosen={type:'call',reason:'induce',eq:report.eq,odds:report.odds};}
  if(plan?.hand===v.hand&&plan.phase!==v.phase&&plan.kind==='protect'&&report.eq>.62&&A.texture(v).wet&&v.legal.raise)chosen={type:'raise',target:Math.max(v.legal.minRaiseTo,Math.min(v.legal.maxRaiseTo,v.currentBet+v.pot)),reason:'value',eq:report.eq,odds:report.odds};
  if(v.profile==='collector'&&v.phase==='preflop'&&profile.range===.28&&v.legal.call)chosen={type:'call',reason:'entry',eq:report.eq,odds:report.odds};
  if(v.profile==='comeback'&&v.seats[v.seat].stack/v.bb<20&&report.eq>.68&&v.legal.raise)chosen={type:'raise',target:v.legal.maxRaiseTo,reason:'value',eq:report.eq,odds:report.odds};
  // Pressure plans are reconsidered against current resistance; never force a continuation.
  if(plan?.kind==='pressure'&&lastRaise?.seat!==v.seat&&lastRaise?.phase===v.phase&&report.eq<.25&&!['maniac','gambler','millionaire'].includes(v.profile)&&v.legal.call)chosen={type:'fold',reason:'retreat',eq:report.eq,odds:report.odds};
  const candidate=report.candidates.filter(c=>c.move.type===chosen.type).sort((a,b)=>Math.abs((a.move.target||0)-(chosen.target||0))-Math.abs((b.move.target||0)-(chosen.target||0)))[0];
  if(candidate){if(chosen.type==='raise')chosen.target=candidate.move.target;chosen.analysis={samples:report.samples,ev:candidate.ev,pots:candidate.pots};const rational=['professor','calculator','rock','sniper','comeback'].includes(v.profile);if(rational&&chosen.type==='call'&&candidate.ev< -v.bb*.2)chosen={type:'fold',reason:'price',eq:report.eq,odds:report.odds,analysis:chosen.analysis};}
  return {...chosen,eq:report.eq,odds:report.odds};
 }
 return {candidates,pots,sample,share,analyze,begin,personality,decide};
});
