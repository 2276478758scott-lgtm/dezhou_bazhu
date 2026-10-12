(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PokerExperience=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const pacing={standard:{think:[1400,2200],hold:[2800,4600]},immersive:{think:[2200,3200],hold:[4200,6500]},quick:{think:[400,700],hold:[1000,1800]}};
  function timing(pace,type,text='',rng=Math.random){
    const p=pacing[pace]||pacing.standard;
    return {think:Math.round(p.think[0]+rng()*(p.think[1]-p.think[0])+(type==='raise'?300:0)),hold:Math.round(Math.min(p.hold[1],Math.max(p.hold[0],text.length*(pace==='quick'?40:90))))};
  }
  const neutral={
    1:{raise:['你加？那我再加。','筹码放进来才算数。','这桌的节奏，我来带。'],call:['我跟，看看故事怎么收场。','这个价，我接了。'],fold:['这一手让你。下手再见。','暂时退一步，别得意太早。'],check:['先让后面的人说话。','先看你们怎么出招。']},
    2:{raise:['这个价，想清楚再跟。','你确定读懂我了吗？','这道题，轮到你答。'],call:['故事还没讲完。','我想再看一张。'],fold:['这次不付钱。','这条线，今天不追。'],check:['不急。先看看。','我先留一手。']},
    3:{raise:['我等的就是这一刻。','接得住就跟。','该出手时，我不会客气。'],call:['这个价可以。','再往下看。'],fold:['机会多得是。','先守住筹码。'],check:['继续看牌。','先稳一稳。']}
  };
  const adaptive={
    aggressive:{
      1:{raise:['你最近加得凶，我也不让。','一直压我？这次我顶回去。'],call:['你又在施压。我跟，看看你怎么收尾。'],fold:['你最近火力够猛，这次先让一步。'],check:['你最近爱抢节奏，这次先让你说。']},
      2:{raise:['你最近总在加，这次换我给你压力。','你加得越频繁，我越要重新掂量你的故事。'],call:['你最近的加注，我不会每次都照单全信。'],fold:['你很敢加，但我没必要每次都接。'],check:['你最近很主动，我先看你下一步。']},
      3:{raise:['你最近一直压，这次该我出手了。','加得凶也别指望我一直退。'],call:['你最近爱施压，这个价我还是接。'],fold:['你火力很足，我先保住筹码。'],check:['先过。你最近的节奏，我记着。']}
    },
    tight:{
      1:{raise:['你最近常放手，这次还敢接吗？','你退得多，我就再往前推一步。'],call:['你最近很谨慎。这次我接住。'],fold:['你最近不轻易出手，这次我让。'],check:['这次先不逼你。']},
      2:{raise:['你最近很谨慎。这个价，你会付吗？','你习惯等好机会，我偏要给你一道难题。'],call:['你最近的下注不多，我会认真看。'],fold:['你最近很少硬打，这次我尊重你的下注。'],check:['我先过，看看你肯不肯出手。']},
      3:{raise:['你最近打得稳，但筹码还是得争。'],call:['你出手很谨慎，我再看一看。'],fold:['你不常施压，这次我先避开。'],check:['都稳一点，先看后面。']}
    },
    calling:{
      1:{raise:['你最近这么爱跟，这个价也跟吗？','你不爱放手？那就把价抬高。'],call:['你爱跟，我也接。看看谁撑到最后。'],fold:['你跟得很坚决，这次让你。'],check:['你不容易被吓走，我先看一看。']},
      2:{raise:['你最近愿意付钱，这次得再想想。'],call:['你跟注的习惯，我记住了。'],fold:['你不常放手，没必要硬碰每一手。'],check:['你最近挺黏，我先不抬价。']},
      3:{raise:['你最近跟得多，这次我把价开清楚。'],call:['你喜欢看下去，我也再看一张。'],fold:['这一手先不和你耗。'],check:['你不轻易退，我先稳着。']}
    }
  };
  function speech(seat,type,model,previous='',rng=Math.random,targetPresent=true){
    const style=model?.confident&&targetPresent?model.style:'unknown';
    const lines=adaptive[style]?.[seat]?.[type]||neutral[seat]?.[type]||['继续。'];
    const choices=lines.filter(x=>x!==previous);return (choices.length?choices:lines)[Math.floor(rng()*(choices.length||lines.length))];
  }
  const styleText={unknown:'对手还在观察你的打法',aggressive:'对手注意到你近期频繁施压',tight:'对手注意到你近期偏谨慎',calling:'对手注意到你近期经常跟注',balanced:'对手觉得你近期打法较均衡'};
  return {timing,speech,styleText};
});
