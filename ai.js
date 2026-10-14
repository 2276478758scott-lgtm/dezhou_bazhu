(function(root,factory) {
  const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.Poker);
  if(typeof module==='object'&&module.exports) module.exports=api; else root.PokerAI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(P) {
  'use strict';
  const profiles=[null,{name:'烈焰',aggression:0.83,bluff:0.25,loose:0.10},{name:'猎狐',aggression:0.65,bluff:0.22,loose:0.02},{name:'铁壁',aggression:0.47,bluff:0.10,loose:-0.04}];
  function modelOpponent(player) {
    const recent=(player.recentActions||[]).slice(-24);
    let weight=0,raises=0,faces=0,folds=0,calls=0,big=0;
    recent.forEach((a,i)=>{
      const w=Math.pow(0.92,recent.length-1-i);weight+=w;
      if(a.type==='raise'){raises+=w;if(a.pressure>=0.7)big+=w;}
      if(a.facing){faces+=w;if(a.type==='fold')folds+=w;if(a.type==='call')calls+=w;}
    });
    const aggression=(raises+1)/(weight+5),foldRate=(folds+1.5)/(faces+4),callRate=(calls+1.5)/(faces+4);
    const confident=recent.length>=4;
    let style='unknown';
    if(confident){
      style=aggression>=0.34?'aggressive':foldRate>=0.54?'tight':callRate>=0.54&&aggression<0.25?'calling':'balanced';
    }
    return {style,confident,aggression,foldRate,callRate,bigBetRate:(big+0.5)/(weight+5),samples:recent.length};
  }
  function preflop(hole) {
    const a=P.rank(hole[0]),b=P.rank(hole[1]),hi=Math.max(a,b),lo=Math.min(a,b);
    return Math.min(1,(hi+lo)/32+(a===b?0.30:0)+(P.suit(hole[0])===P.suit(hole[1])?0.07:0)+(hi-lo<=2?0.05:0)-(hi-lo>5?0.08:0));
  }
  // Observation boundary: no deck, no opponent hole cards, no future board.
  function observe(game,i,difficulty='pressure') {
    return {rival:game.players[i].rival?JSON.parse(JSON.stringify(game.players[i].rival)):null,seat:i,profile:game.players[i].profile,emotion:game.players[i].emotion?{...game.players[i].emotion}:null,memory:JSON.parse(JSON.stringify(game.players[i].aiMemory||{reads:{}})),history:(game.history||[]).map(a=>({...a})),hole:game.players[i].hole.slice(),board:game.board.slice(),phase:game.phase,hand:game.hand,dealer:game.dealer,bb:game.bb,bbSeat:game.bbSeat,pot:game.pot(),currentBet:game.currentBet,legal:{...game.legal(i)},difficulty,
      seats:game.players.map((p,j)=>({seat:j,stack:p.stack,bet:p.bet,total:p.total,folded:p.folded,playing:p.hole.length===2,lastAction:p.lastAction,stats:{...p.stats},recentActions:(p.recentActions||[]).map(a=>({...a}))}))};
  }
  function equity(v,rng=Math.random,samples=72) {
    const known=new Set([...v.hole,...v.board]),pool=Array.from({length:52},(_,i)=>i).filter(c=>!known.has(c));
    const opponents=v.seats.filter(p=>p.seat!==v.seat&&!p.folded&&p.playing);
    let won=0;
    for(let n=0;n<samples;n++) {
      const deck=P.shuffle(pool,rng),hands=[];
      for(const o of opponents) {
        // Public raises tighten a range, but retain bluffs. Rejected cards return to the sample deck.
        let hole=[deck.pop(),deck.pop()];
        const model=modelOpponent(o),raiseFrequency=model.aggression;
        const publicActions=(v.history||[]).filter(a=>a.seat===o.seat&&a.type!=='taunt'),last=publicActions[publicActions.length-1];
        const vpip=(o.stats.vpip+4)/(o.stats.hands+10);
        const rangeFloor=o.lastAction==='raise'?0.68-Math.min(0.24,raiseFrequency*0.42)+(model.style==='tight'?0.04:0):0.51-vpip*0.15;
        if(rng()<(o.lastAction==='raise'||last?.type==='raise'?0.72:0.40)) {
          const plausible=h=>{if(preflop(h)<rangeFloor)return false;if(v.profile==='professor'&&v.board.length>=3&&last?.type==='raise'){
            const score=P.evaluate([...h,...v.board]);const suitCounts=[0,0,0,0];[...h,...v.board].forEach(c=>suitCounts[P.suit(c)]++);
            return score[0]>=1||suitCounts.some(n=>n===4)||rng()<.20+raiseFrequency*.35;
          }return true;};
          for(let k=0;k<(v.profile==='professor'?5:3)&&!plausible(hole);k++) {
            deck.unshift(...hole);hole=[deck.pop(),deck.pop()];
          }
        }
        hands.push(hole);
      }
      const board=v.board.slice();while(board.length<5) board.push(deck.pop());
      const ours=P.evaluate([...v.hole,...board]);let ties=1,beat=false;
      for(const h of hands) { const c=P.compare(P.evaluate([...h,...board]),ours);if(c>0){beat=true;break;}if(c===0) ties++; }
      if(!beat) won+=1/ties;
    }
    return won/samples;
  }
  function decideWithEquity(v,eq,rng=Math.random) {
    const l=v.legal,p=v.seats[v.seat],profile=profiles[v.seat]||profiles[1];
    const opponents=v.seats.filter(q=>q.seat!==v.seat&&!q.folded&&q.playing);
    const aggressor=opponents.filter(q=>q.lastAction==='raise').sort((a,b)=>b.bet-a.bet)[0];
    const targets=aggressor?[aggressor]:opponents;
    const models=targets.map(modelOpponent);
    const average=f=>models.reduce((s,m)=>s+f(m),0)/Math.max(1,models.length);
    const foldRate=average(m=>m.foldRate),callRate=average(m=>m.callRate);
    const opponentAggression=average(m=>m.aggression);
    const calling=callRate>=0.54,combative=opponentAggression>=0.34;
    const pressure=v.difficulty==='pressure'?1:v.difficulty==='balanced'?0.78:0.50;
    const price=l.callAmount;
    // Ignore portions of pots we cannot contest at our current stack size.
    const cap=p.total+price,contestable=v.seats.reduce((s,q)=>s+Math.min(q.total,cap),0)+price;
    const odds=price/Math.max(1,contestable);
    const facing=l.toCall>0, ratio=price/Math.max(v.bb,v.pot);
    const ranks=v.board.map(P.rank),scary=v.board.length>=3&&(ranks.some(r=>r>=13)||new Set(v.board.map(P.suit)).size<=2);
    const suitedCounts=[0,0,0,0];for(const c of [...v.hole,...v.board]) suitedCounts[P.suit(c)]++;
    const draw=v.board.length<5&&suitedCounts.some(n=>n>=4);
    const blocker=v.hole.some(c=>P.rank(c)===14);
    const multi=Math.pow(0.58,Math.max(0,opponents.length-1));
    const bluffRate=profile.bluff*pressure*multi*(0.40+foldRate*1.5)*(calling?0.45:1)*(combative?0.85:1)*(scary||draw||blocker?1.35:0.8);
    const bluff=l.raise&&rng()<bluffRate&&(ratio<0.9||!facing)&&price<p.stack*0.30;
    const valueThreshold=combative?0.43:0.47;
    const adaptiveValue=eq>Math.max(valueThreshold,1/(opponents.length+1)+(combative?0.10:0.18));
    const reraise=eq>(combative?0.50:0.57) || (eq>0.40&&combative&&ratio<0.5);
    const raise=l.raise&&((adaptiveValue&&(!facing||reraise)&&rng()<Math.min(0.95,profile.aggression+(combative?0.12:0))*pressure)||bluff||(draw&&eq>odds+0.08&&rng()<0.15*pressure));
    if(raise) {
      const size=bluff?0.75+rng()*0.45:0.48+rng()*0.65+(calling?0.16:0);
      let target=v.currentBet+Math.max(v.bb,Math.round((v.pot+l.toCall)*size));
      if(v.phase==='preflop'&&!facing) target=Math.max(target,v.bb*3);
      target=Math.max(l.minRaiseTo,Math.min(l.maxRaiseTo,target));
      if(!bluff&&eq>0.72&&p.stack<2.5*v.pot&&rng()<0.65) target=l.maxRaiseTo;
      return {type:'raise',target};
    }
    if(!facing) return {type:'check'};
    const margin=ratio>0.7?0.06:0.02;
    // Larger bets demand stronger evidence; frequent opposing raises earn wider defenses.
    const defense=profile.loose+Math.min(0.07,Math.max(0,opponentAggression-0.25)*0.20);
    if(eq+defense>=odds+margin || (price<=v.bb&&eq>0.18&&rng()<0.72)) return {type:'call'};
    return {type:'fold'};
  }
  const PROFILES={
    maniac:{name:'疯狗',aggression:.90,bluff:.32,loose:.09,size:1.00,range:.38},calculator:{name:'数学家',aggression:.50,bluff:.09,loose:-.035,size:.62,range:.56},
    gambler:{name:'赌徒',aggression:.70,bluff:.21,loose:.055,size:.90,range:.43},professor:{name:'The Professor · 教授',aggression:.68,bluff:.10,loose:-.015,size:.72,range:.54},
    rock:{name:'铁壁',aggression:.63,bluff:.035,loose:-.065,size:.78,range:.67},trapper:{name:'猎狐',aggression:.45,bluff:.17,loose:-.005,size:.75,range:.52,trap:.55},
    stealer:{name:'掠夺者',aggression:.72,bluff:.25,loose:.005,size:.55,range:.53,steal:.65},sniper:{name:'狙击手',aggression:.58,bluff:.14,loose:-.04,size:1.12,range:.59},
    catcher:{name:'英雄跟注者',aggression:.43,bluff:.075,loose:.025,size:.65,range:.51,catch:.10},millionaire:{name:'超级大富豪',aggression:.78,bluff:.18,loose:.13,size:1.45,range:.34},
    chameleon:{name:'变色龙',aggression:.62,bluff:.18,loose:.015,size:.82,range:.50},mirror:{name:'镜像怪',aggression:.55,bluff:.16,loose:.015,size:.78,range:.50},comeback:{name:'逆风王',aggression:.60,bluff:.11,loose:-.02,size:.90,range:.54},collector:{name:'收藏家',aggression:.45,bluff:.10,loose:.03,size:.68,range:.54},neymar:{name:'内马尔',aggression:.65,bluff:.20,loose:.025,size:.86,range:.48}
  };
  const emotionAPI=()=>typeof module==='object'&&module.exports?require('./emotion.js'):globalThis.PokerEmotion;
  const ENTRY={chameleon:.75,mirror:.75,comeback:.67,collector:.82,neymar:.8,maniac:.86,calculator:.65,gambler:.82,professor:.68,rock:.48,trapper:.72,stealer:.80,sniper:.60,catcher:.76,millionaire:.95};

  const STYLE={chameleon:{semi:.3,reraise:.18,variance:.5},mirror:{semi:.3,reraise:.15,variance:.4},comeback:{semi:.18,reraise:.2,variance:.25},collector:{semi:.6,reraise:.08,variance:.3},neymar:{semi:.4,reraise:.18,variance:.6},maniac:{semi:.20,reraise:.32,variance:.55},gambler:{semi:.66,reraise:.10,variance:.75},millionaire:{semi:.30,reraise:.12,variance:1.0},professor:{semi:.24,reraise:.18,variance:.40},calculator:{semi:.12,reraise:.08,variance:.08},trapper:{semi:.20,reraise:.12,variance:.35},sniper:{semi:.16,reraise:.12,variance:.60},rock:{semi:.08,reraise:.10,variance:.30},stealer:{semi:.22,reraise:.16,variance:.35},catcher:{semi:.12,reraise:.06,variance:.25}};
  function position(v){const active=v.seats.filter(q=>q.playing&&!q.folded&&q.stack>0).map(q=>q.seat),n=v.seats.length,start=v.phase==='preflop'?(v.bbSeat??(v.dealer+2)%n):v.dealer,order=[];for(let j=1;j<=n;j++){const i=(start+j)%n;if(active.includes(i))order.push(i);}const index=order.indexOf(v.seat);const clockwise=active.slice().sort((a,b)=>(a-v.dealer+n)%n-(b-v.dealer+n)%n),cutoff=clockwise[clockwise.length-1];return {index,count:order.length,late:v.phase==='preflop'?v.seat===v.dealer||active.length>2&&v.seat===cutoff:index>=Math.max(1,order.length-2)};}
  function remember(g,seat,move){const p=g.players[seat];p.aiMemory||={reads:{}};p.aiMemory.hand=g.hand;if(move.reason==='reckless')p.emotion.weakAllinUsed=true;if(move.reason==='trap'||move.reason==='induce')p.aiMemory.plan={kind:'induce',hand:g.hand,phase:g.history.at(-1)?.phase||g.phase};else if(move.type==='raise')p.aiMemory.plan={kind:'pressure',hand:g.hand,phase:g.history.at(-1)?.phase||g.phase};else if(move.type==='fold')p.aiMemory.plan=null;if(move.reason==='value'&&g.board.length>=3&&texture({hole:p.hole,board:g.board}).wet)p.aiMemory.plan={kind:'protect',hand:g.hand,phase:g.history.at(-1)?.phase||g.phase};}
  function learn(g){if(g.phase!=='complete')return;g.players.forEach((p,i)=>{if(!i)return;p.aiMemory||={reads:{}};if(p.aiMemory.learnedHand===g.hand)return;p.aiMemory.learnedHand=g.hand;g.players.forEach((q,j)=>{if(j===i||q.hole.length!==2)return;const read=p.aiMemory.reads[j]||={reveals:0,weakRaises:0};read.reveals++;const raised=g.history.some(a=>a.seat===j&&a.type==='raise'&&a.phase!=='preflop');if(raised&&g.board.length>=3&&P.evaluate([...q.hole,...g.board])[0]===0)read.weakRaises++;});});}
  function texture(v){const suits=[0,0,0,0],ranks=new Set();for(const c of [...v.board,...v.hole]){suits[P.suit(c)]++;ranks.add(P.rank(c));}if(ranks.has(14))ranks.add(1);
    let straightDraw=false;for(let low=1;low<=10;low++){let n=0;for(let r=low;r<low+5;r++)if(ranks.has(r))n++;if(n>=4)straightDraw=true;}
    const boardSuits=[0,0,0,0];v.board.forEach(c=>boardSuits[P.suit(c)]++);
    const flushDraw=suits.some((n,s)=>n===4&&v.hole.some(c=>P.suit(c)===s)&&v.board.filter(c=>P.suit(c)===s).length<4);const boardRanks=new Set(v.board.map(P.rank));if(boardRanks.has(14))boardRanks.add(1);let privateStraight=false;for(let low=1;low<=10;low++){const run=Array.from({length:5},(_,i)=>low+i);if(run.filter(r=>ranks.has(r)).length===4&&v.hole.some(c=>run.includes(P.rank(c))&&!boardRanks.has(P.rank(c))||P.rank(c)===14&&run.includes(1)&&!boardRanks.has(1)))privateStraight=true;}
    return {draw:v.board.length>=3&&v.board.length<5&&(flushDraw||privateStraight),blocker:v.hole.some(c=>P.rank(c)===14||P.rank(c)===13&&boardSuits[P.suit(c)]>=3),wet:boardSuits.some(n=>n>=3)||new Set(v.board.map(P.rank)).size<v.board.length};
  }
  function strategy(v,eq,profile=PROFILES[v.profile]||PROFILES.calculator,rng=Math.random){
    profile={...profile};const style=STYLE[v.profile]||STYLE.calculator,phase=emotionAPI()?.stage(v.emotion||{},v.profile),tilting=phase==='tilt',recovering=phase==='recovery';if(tilting){profile.aggression=Math.min(.96,profile.aggression+.15);profile.bluff*=1.55;profile.loose+=v.profile==='gambler'?.16:.12;profile.size*=v.profile==='millionaire'?1.35:1.2;}if(recovering){profile.aggression*=.75;profile.bluff*=.6;profile.loose-=.04;}
    const l=v.legal,p=v.seats[v.seat],os=v.seats.filter(q=>q.seat!==v.seat&&!q.folded&&q.playing),n=os.length;
    const emotion=emotionAPI()?.modifiers(v.profile,v.emotion||undefined)||{aggression:0,loose:0,size:0},t=texture(v);
    const cap=p.total+l.callAmount,contestable=v.seats.reduce((s,q)=>s+Math.min(q.total,cap),0)+l.callAmount,odds=l.callAmount/Math.max(1,contestable);
    const models=os.map(modelOpponent),avg=k=>models.reduce((s,m)=>s+m[k],0)/Math.max(1,n),aggressive=avg('aggression'),foldRate=avg('foldRate');
    const effective=Math.min(p.stack,Math.max(0,...os.map(q=>q.stack))),spr=effective/Math.max(v.bb,v.pot),late=position(v).late;
    const raises=(v.history||[]).filter(a=>a.type==='raise'),last=raises[raises.length-1],credible=last&&last.amount/Math.max(v.bb,last.potBefore)>.7;
    const playerRaises=last?raisesBySeat(v.history,last.seat):0;
    const reveals=os.map(q=>v.memory?.reads?.[q.seat]),observedBluffs=reveals.reduce((n,r)=>n+(r?(r.weakRaises||0)/((r.reveals||0)+4):0),0)/Math.max(1,n);
    const defense=(v.profile==='professor'?Math.min(.08,observedBluffs*.2):v.profile==='catcher'?(v.emotion?.doubt||0)*.10:0)+((profile.catch||0)+(v.profile==='professor'?.06:0))*Math.max(0,aggressive-.25)*2;
    const value=eq>Math.max(.46,1/(n+1)+.16),margin=(v.profile==='professor'?.025:.04)+(credible&&aggressive<.25?.025:0);
    const strength=preflop(v.hole),preTight=v.phase==='preflop'&&strength<profile.range-(late?.08:0);
    // All opponents must fold for a pure bluff to win. An all-in opponent cannot fold.
    const foldEquity=os.some(q=>q.stack===0)?0:models.reduce((chance,m)=>chance*Math.max(.08,Math.min(.85,(.30+.55*m.foldRate)*(t.wet?.90:1)*(credible?.80:1))),1),multi=Math.pow(.72,Math.max(0,n-1));
    const continuation=v.profile==='professor'&&v.memory?.plan?.kind==='pressure'&&v.memory.plan.hand===v.hand&&v.memory.plan.phase!==v.phase&&foldRate>.45&&(t.blocker||v.board.some(c=>P.rank(c)>=13));
    const revenge=v.profile==='maniac'&&os.some(q=>q.seat===v.emotion?.target&&q.stack>0)&&l.toCall>0;
    const difficulty=v.difficulty==='learning'?.65:v.difficulty==='balanced'?.85:1;
    const bluffChance=Math.min(.65,profile.bluff*(revenge?1.4:1)*(continuation?1.4:1)*difficulty*multi*(t.blocker?1.25:1)*(late?1.20:1)*Math.max(.45,Math.min(1.5,foldRate/.4))*(1+Math.max(-.5,emotion.aggression*5)));
    const adaptation=v.profile==='professor'?(avg('callRate')>.54?1.18:foldRate>.55?.80:1):1;
    // Share the same sizing distribution for value and bluffs, rather than announcing hand strength.
    let bet=Math.max(v.bb,Math.round((v.pot+l.toCall)*profile.size*(v.profile==='calculator'?.60:.45+(1-style.variance)*.20+rng()*style.variance)*(1+emotion.size)*adaptation));
    if(v.phase==='preflop')bet=Math.max(v.bb*2,bet);
    const target=Math.max(l.minRaiseTo,Math.min(l.maxRaiseTo,v.currentBet+bet)),cost=target-p.bet;
    // Conservative EV estimate for the contestable portion; never price another player's side pot as ours.
    const bluffEV=foldEquity*v.pot-(1-foldEquity)*cost;
    const semiEV=foldEquity*v.pot+(1-foldEquity)*(eq*(contestable+cost)-cost);
    const canRisk=cost<=p.stack*.55||spr<2||v.profile==='millionaire'||v.profile==='maniac';
    let reason='',raise=false;
    const weak=eq<Math.max(.46,1/(n+1)+.16),recklessRate=v.profile==='maniac'?.10:v.profile==='millionaire'?.05:v.profile==='gambler'&&t.draw?.10:0;
    if(tilting&&weak&&!v.emotion?.weakAllinUsed&&l.raise&&os.some(q=>q.stack>0)&&rng()<recklessRate)return {type:'raise',target:l.maxRaiseTo,reason:'reckless',eq,odds};
    if(v.profile==='trapper'&&v.phase!=='preflop'&&eq>.68&&rng()<.65){if(!l.toCall&&l.check)return {type:'check',reason:'induce',eq,odds};if(l.toCall&&v.memory?.plan?.kind==='induce'&&v.memory.plan.hand===v.hand&&l.raise)return {type:'raise',target,reason:'value',eq,odds};if(l.call&&eq>=odds+.08)return {type:'call',reason:'induce',eq,odds};}
    if(v.profile==='sniper'&&weak&&!t.blocker&&!t.draw){if(l.check)return {type:'check',reason:'wait',eq,odds};if(eq+profile.loose<odds+.10)return {type:'fold',reason:'wait',eq,odds};}
    if(v.profile==='maniac'&&revenge&&l.raise&&canRisk&&rng()<style.reraise*(tilting?1.8:1))return {type:'raise',target,reason:weak?'bluff':'value',eq,odds};
    if(l.raise&&!preTight&&value&&rng()<Math.max(0,Math.min(.94,profile.aggression+emotion.aggression))*difficulty){raise=true;reason='value';}
    if(l.raise&&!raise&&v.phase==='preflop'&&!raises.length&&strength>=Math.max(.66,profile.range+.15)&&rng()<profile.aggression*.70){raise=true;reason='value';}
    if(raise&&profile.trap&&eq>.68&&!l.toCall&&rng()<profile.trap){raise=false;reason='trap';}
    const reactive=['maniac','gambler','millionaire'].includes(v.profile),tilt=Math.max(0,v.emotion?.frustration||0);
    const riskBudget=reactive?cost*(.18+.38*tilt+(tilting?.20:0)):0;
    const bluffRange=v.phase!=='preflop'||!preTight||(late&&!credible&&raises.length<=1);
    if(l.raise&&!raise&&!value&&foldEquity>0&&canRisk&&l.callAmount<p.stack*.4&&bluffRange&&bluffEV>=-riskBudget&&rng()<bluffChance){raise=true;reason='bluff';}
    if(l.raise&&!raise&&t.draw&&semiEV>0&&rng()<style.semi*(tilting?1.2:1)*difficulty){raise=true;reason='semi';}
    if(l.raise&&!raise&&profile.steal&&late&&!raises.some(a=>a.phase===v.phase&&a.seat!==v.seat)&&rng()<profile.steal&&foldEquity>.25){raise=true;reason='steal';}
    if(raise){let amount=target;if(reason==='value'&&eq>.75&&spr<2.2)amount=l.maxRaiseTo;return {type:'raise',target:amount,reason,eq,odds};}
    if(l.check)return {type:'check',reason:reason||'free',eq,odds};
    // Preflop equity against every seated player is not an immediate all-in price.
    // Buy a cheap flop with a playable range and deep enough stacks; never extend this to expensive raises or later streets.
    const cheapEntry=v.phase==='preflop'&&v.currentBet<=v.bb*2&&raises.length<=1&&l.callAmount<=v.bb*2&&l.callAmount<=p.stack*.10&&effective>=v.bb*8;
    const entryFloor=Math.max(.32,profile.range-.07-(late?.04:0));
    if(cheapEntry&&strength>=entryFloor&&eq+profile.loose>=.15&&rng()<(ENTRY[v.profile]??.65)*(raises.length?.55:1))return {type:'call',reason:'entry',eq,odds};
    const estimate=eq+profile.loose+emotion.loose+defense;
    if(!preTight&&estimate>=odds+margin+(v.profile==='rock'?.025:0)+(v.profile==='professor'&&playerRaises>1&&aggressive<.25?.035:0))return {type:'call',reason:defense>.025?'catch':'price',eq,odds};
    return {type:'fold',reason:'price',eq,odds};
  }
  function raisesBySeat(history,seat){return (history||[]).filter(a=>a.seat===seat&&a.type==='raise').length;}
  function decide(v,profileOrRng=Math.random,emotion=null,rng=Math.random){const random=typeof profileOrRng==='function'?profileOrRng:rng,profile=typeof profileOrRng==='object'?profileOrRng:PROFILES[v.profile]||PROFILES.calculator;
    const view=emotion?{...v,emotion}:v;return strategy(view,equity(view,random,v.profile==='professor'?192:72),profile,random);}
  return {profiles,PROFILES,STYLE,position,remember,learn,ENTRY,preflop,observe,equity,decideWithEquity,decide,strategy,texture,modelOpponent};
});
