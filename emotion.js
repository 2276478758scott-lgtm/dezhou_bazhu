(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerEmotion=a;})(globalThis,()=>{
  'use strict';const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const weights={maniac:[.85,.80],calculator:[.10,.35],gambler:[.65,.70],professor:[.08,.30],rock:[.20,.45],trapper:[.30,.50],stealer:[.40,.55],sniper:[.25,.45],catcher:[.45,.60],millionaire:[.75,.75]};
  const reactions={
    maniac:{pressure:1.10,frustration:1.25,confidence:1.10,focus:.25,p:.22,f:.20,high:.60,low:.40,pressureWord:'躁动',frustrationWord:'不甘',confidenceWord:'兴奋',focusWord:'较劲'},
    calculator:{pressure:.85,frustration:.30,confidence:.55,focus:1.20,p:.32,f:.40,high:.66,low:.34,pressureWord:'计算中',frustrationWord:'复盘中',confidenceWord:'自信',focusWord:'计算中'},
    gambler:{pressure:.90,frustration:1.0,confidence:1.20,focus:.35,p:.18,f:.23,high:.60,low:.40,pressureWord:'紧张',frustrationWord:'不服',confidenceWord:'兴奋',focusWord:'跃跃欲试'},
    professor:{pressure:.65,frustration:.20,confidence:.50,focus:1.30,p:.38,f:.45,high:.67,low:.33,pressureWord:'审视',frustrationWord:'调整中',confidenceWord:'笃定',focusWord:'审视'},
    rock:{pressure:1.15,frustration:.60,confidence:.65,focus:.90,p:.24,f:.30,high:.64,low:.39,pressureWord:'警惕',frustrationWord:'收紧',confidenceWord:'笃定',focusWord:'警惕'},
    trapper:{pressure:.75,frustration:.65,confidence:.75,focus:1.0,p:.28,f:.28,high:.64,low:.37,pressureWord:'沉着',frustrationWord:'重新谋划',confidenceWord:'从容',focusWord:'沉着'},
    stealer:{pressure:1.15,frustration:.95,confidence:1.10,focus:.75,p:.25,f:.25,high:.61,low:.39,pressureWord:'试探',frustrationWord:'不服',confidenceWord:'得势',focusWord:'试探'},
    sniper:{pressure:.90,frustration:.50,confidence:.80,focus:1.25,p:.28,f:.32,high:.64,low:.37,pressureWord:'专注',frustrationWord:'重新定位',confidenceWord:'笃定',focusWord:'专注'},
    catcher:{pressure:.90,frustration:.85,confidence:.80,focus:.90,p:.27,f:.27,high:.63,low:.37,pressureWord:'疑心',frustrationWord:'不甘',confidenceWord:'自信',focusWord:'审慎'},
    millionaire:{pressure:.70,frustration:1.40,confidence:1.25,focus:.20,p:.17,f:.18,high:.59,low:.40,pressureWord:'兴起',frustrationWord:'不服',confidenceWord:'得意',focusWord:'兴起'}
  };
  const config=profile=>reactions[profile]||reactions.calculator;
  const initial=()=>({frustration:0,confidence:.5,pressure:0,focus:0,doubt:0,streak:0,lastHand:0,lastEvent:-1,pressureEvents:0,lastRaiseBet:0,lastRaisePhase:null,stage:'calm',tiltHands:0,recoveryLeft:0,cause:'',reactionSerial:0,spokenSerial:0,target:null});

  const reactive=profile=>['maniac','gambler','millionaire'].includes(profile);
  function stage(m,profile){if(m.stage==='recovery')return 'recovery';return reactive(profile)&&(m.frustration>=.6||m.stage==='tilt')?'tilt':m.frustration>=.3||m.pressure>.25?'agitated':'calm';}
  function trigger(m,profile,cause,target=null){m.role=profile;m.cause=cause;m.reactionSerial=(m.reactionSerial||0)+1;if(target!==null)m.target=target;const next=stage(m,profile);if(next==='tilt'&&m.stage!=='tilt')m.tiltHands=0;m.stage=next;}
  function begin(m,profile=m.role||'calculator'){m.role=profile;m.target=null;m.weakAllinUsed=false;m.lastEvent=-1;m.pressureEvents=0;m.lastRaiseBet=0;m.lastRaisePhase=null;m.focus=(m.focus||0)*.45;m.doubt=(m.doubt||0)*.5;}
  function action(m,event,index,stack,bb,{profile='calculator',seat=null,playing=true,folded=false}={}){
    if(index<=m.lastEvent)return;m.lastEvent=index;if(event.seat===undefined||!playing||folded)return;
    if(stack===0&&event.seat!==seat)return;
    const sensitivity=(weights[profile]||[.2])[0],reaction=.30+.90*sensitivity,c=config(profile),type=event.type||'raise',own=event.seat===seat;
    const potScale=Math.min(1.5,event.amount/Math.max(bb,event.potBefore||bb*2)),stackScale=event.amount/Math.max(bb,stack+event.amount);
    m.pressure=clamp(m.pressure*(.80+.12*sensitivity));
    m.focus=clamp((m.focus||0)*.88);m.doubt=clamp((m.doubt||0)*.92);
    if(own){
      if(type==='raise'){m.lastRaiseBet=event.target||event.betBefore+event.amount;m.lastRaisePhase=event.phase||null;m.confidence=clamp(m.confidence+(.055+.07*potScale)*reaction*c.confidence);m.pressure=clamp(m.pressure-.05*reaction);m.focus=clamp(m.focus+(.10+.10*potScale)*c.focus);}
      else if(type==='call'){m.pressure=clamp(m.pressure+.05*reaction*potScale*c.pressure);m.focus=clamp(m.focus+.12*c.focus);}
      else if(type==='check'&&['trapper','sniper','professor','calculator'].includes(profile))m.focus=clamp(m.focus+.14*c.focus);
      m.stage=stage(m,profile);return;
    }
    if(type==='raise'){
      const challenged=(m.lastRaiseBet||0)>0&&event.betBefore>=m.lastRaiseBet&&(!m.lastRaisePhase||!event.phase||event.phase===m.lastRaisePhase);
      m.pressureEvents=Math.min(6,(m.pressureEvents||0)+1);
      const increment=(.07+.18*potScale+.12*stackScale+(challenged?.10:0))*reaction*c.pressure;
      m.pressure=clamp(m.pressure+Math.min(.40,increment));
      m.frustration=clamp(m.frustration+((challenged?.10:.025)+Math.min(.06,m.pressureEvents*.015))*reaction*c.frustration);
      m.focus=clamp(m.focus+(.12+.18*Math.min(1,potScale))*c.focus);
      if(profile==='catcher')m.doubt=clamp(m.doubt+(.08+Math.min(.24,m.pressureEvents*.06))*(challenged?1.25:1));
      trigger(m,profile,challenged?'reraise':'pressure',challenged?event.seat:null);
      if(profile==='rock'||profile==='calculator')m.confidence=clamp(m.confidence-.035*reaction);
    }else if(type==='fold'&&m.lastRaiseBet>0&&(!m.lastRaisePhase||!event.phase||event.phase===m.lastRaisePhase)){m.confidence=clamp(m.confidence+.035*reaction*c.confidence);trigger(m,profile,'success');}
  }
  function finish(m,profile,hand,net,start,expected=.5){if(m.lastHand===hand)return;const recovering=m.stage==='recovery';m.lastHand=hand;const [s,decay]=weights[profile]||[.2,.5],size=Math.min(1,Math.abs(net)/Math.max(1,start));
    m.streak=net===0?0:Math.sign(net)===Math.sign(m.streak)?Math.sign(net)*Math.min(5,Math.abs(m.streak)+1):Math.sign(net);
    const diminishing=1/(1+Math.abs(m.streak)*.15),reaction=.30+.90*s,c=config(profile);
    m.frustration=clamp(m.frustration*decay+(net<0?(.055+size*(.30+.35*expected)+Math.max(0,-m.streak-1)*.018)*reaction*diminishing*c.frustration:-size*.22));
    m.confidence=clamp(.5+(m.confidence-.5)*decay+Math.sign(net)*(.04+size*.30)*reaction*diminishing*c.confidence);m.pressure=clamp(m.pressure*decay);m.focus=clamp((m.focus||0)*decay+(net<0?Math.min(.25,size)*c.focus:0));m.doubt=clamp((m.doubt||0)*decay);if(net<0)trigger(m,profile,size>=.2?'loss':m.streak<-1?'streak':'loss');else if(net>0)trigger(m,profile,'success');if(recovering){m.recoveryLeft=Math.max(0,(m.recoveryLeft||1)-1);if(!m.recoveryLeft){m.frustration=Math.min(.3,m.frustration);m.stage='calm';m.tiltHands=0;}}else if(m.stage==='tilt'){m.tiltHands=(m.tiltHands||0)+1;if(m.tiltHands>=2){m.stage='recovery';m.recoveryLeft=1;trigger(m,profile,'recovery');}}return s;
  }
  function modifiers(profile,m=initial()){const s=(weights[profile]||[.2])[0],tilt=m.frustration,confidence=m.confidence-.5,guard=['rock','calculator','professor','sniper'].includes(profile),cautious=guard?m.pressure*.5:0;
    const patience=profile==='trapper'?(m.focus||0)*.03:0,doubt=profile==='catcher'?(m.doubt||0)*.05:0;
    return {aggression:clamp((guard?-tilt:tilt)*.12+confidence*.12-cautious*.08-patience,-.12,.12)*s,loose:clamp((guard?-tilt:tilt)*.06+confidence*.04-cautious*.04+doubt,-.06,.06)*s,size:clamp((guard?-tilt:tilt)*.2+confidence*.2-cautious*.1,-.2,.2)*s};}
  function label(m=initial(),profile='calculator'){
    const reactive=['maniac','gambler','millionaire'].includes(profile),c=config(profile);if(m.stage==='recovery')return '回过神';if(m.stage==='tilt'&&reactive)return '上头';
    if(m.frustration>.60&&reactive)return '上头';if(m.pressure>c.p&&m.frustration>c.f&&reactive)return profile==='maniac'?'被激怒':'不服';
    if(m.frustration>c.f)return c.frustrationWord;if(profile==='catcher'&&(m.doubt||0)>.22)return '疑心';if(m.pressure>c.p)return c.pressureWord;
    if(m.confidence>c.high)return c.confidenceWord;if(m.confidence<c.low)return '谨慎';if((m.focus||0)>.22)return c.focusWord;return '冷静';
  }
  function provoke(m,profile,intensity=1){const c=config(profile),s=(weights[profile]||[.2])[0],gain=.04+.40*s;
    m.frustration=clamp(m.frustration+gain*c.frustration*intensity);
    m.pressure=clamp(m.pressure+(.025+.22*s)*c.pressure*intensity);
    m.focus=clamp((m.focus||0)+(.10+.16*(1-s))*c.focus*intensity);
    if(profile==='catcher')m.doubt=clamp((m.doubt||0)+.18*intensity);
    trigger(m,profile,'taunt',0);return {frustration:gain*c.frustration*intensity};
  }
  return {weights,reactions,config,initial,begin,action,finish,modifiers,label,provoke,stage,trigger};
});
