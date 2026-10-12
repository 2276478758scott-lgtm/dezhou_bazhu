(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerLanguage=a;})(globalThis,()=>{
  'use strict';
  const events=['open','steal','value','raise','call','fold','check','allin','win','lose','tie','bust'];
  const scripts={
    maniac:['今天这桌，我先开火。','你们都等牌？我先收筹码。','这个价格还不够热闹。','你敢加，我就敢顶回去。','我接了，别半路熄火。','这一手不值，下手再撞。','先过，看谁敢开第一枪。','筹码全推，接得住就接。','这一池，打得痛快。','这次算你狠，下手再来。','各拿一半，下手分高低。','筹码没了，气势还在。'],
    calculator:['我先看位置和价格。','无人争夺的底池也有价值。','这个尺度，值得付钱。','跟注的价格变了，再算一次。','价格能接受，我继续。','这笔投入不划算。','免费一张，不需要加价。','筹码深度到了决断的时候。','这一手的投入拿回来了。','结果输掉了，判断还要复核。','平分，谁也没有优势。','这场结束，得重新检查账本。'],
    gambler:['今天我想打几个大底池。','没人争，我就试着抢。','底池再大点才有意思。','这个局面，值得再冒一点险。','再看一张，也许故事会变。','冒险也得挑机会。','先留一点变化。','这一手，我愿意承担波动。','险没白冒，这池归我。','风险兑现了，先认这一手。','打了半天，各退一步。','今天的波动把我送走了。'],
    professor:['先观察，再做判断。','位置的价值，不必等到摊牌。','想看后面，需要付这个价格。','你的选择，现在更难了。','这个价格，足够让我继续验证。','有些底池，放弃更有价值。','过牌也是下注线路的一部分。','有效筹码已经决定了题目。','这手的结果出来了。','结果不等于判断，下一手再验证。','同一张答案，两个人交卷。','这一场，你赢了。值得复盘。'],
    rock:['我不急，等值得打的牌。','这一池既然没人要，我收。','愿意跟，就把筹码放好。','我认真加的时候，你也认真想。','这个价，我可以守。','不合适的机会，不必硬接。','先守住，看看后面。','该争的底池，我不会退。','等来的机会，没有浪费。','这一手没守住，先调整。','平分也好，筹码还在。','守到这里，这场结束。'],
    trapper:['先坐稳，故事慢慢讲。','这一池，你愿意让给我吗？','这个价格，是请你继续。','你先想想，我为什么现在加。','我想听完你的故事。','这条线，我暂时不追。','你先说，我听着。','到这里，不必再藏选择了。','故事讲完，这池归我。','这次设局没成，记住了。','我们想到了一起。','这一桌，最后还是你设得更好。'],
    stealer:['位置好了，我就不客气。','谁都不出手，那我先拿。','想守住这池，得付点成本。','守盲也得有个价格。','先接住，看你能压几轮。','这次有人守，我换个机会。','机会没到，我先过。','这一口，值得把筹码推进去。','筹码就这样一点点搬过来。','这次抢到了硬地方。','平分，下次再抢。','抢了一路，这场到头了。'],
    sniper:['我等一个清楚的机会。','这里的空当，我看到了。','这次出手，价格开清楚。','机会出现，就不用试探太久。','再看一张，目标会更清楚。','角度不对，先收手。','先看清楚，不急着开火。','这一枪，筹码推到底。','这次抓住了机会。','判断偏了，这次认账。','同样的牌力，谁也打不穿。','这一场，最后的机会没抓住。'],
    catcher:['今天我想听听谁的故事最可信。','没人下注，我先问个价格。','有牌力的时候，也该收点钱。','别只顾施压，我也会反击。','这个故事，我愿意花钱验证。','这次你的下注，我尊重。','你先讲，我再决定信不信。','这一手，验证到底。','摊牌的答案，我看到了。','这次花钱，没买到好答案。','答案相同，各收一半。','今天验证得太贵了。'],
    millionaire:['筹码摆这么整齐，不花可惜了。','这一小池，也算我的零花钱。','价格开大些，别太拘谨。','这点加注？我再添一点。','买张票看看，总得有点体验。','这次先不买，换个项目。','也让我节省一次，先过。','这手的预算，我全拨了。','花得阔绰，收得也体面。','预算超了，先承认这笔亏损。','各收一半，这账真巧。','钱包空了，今天散场。']
  };
  const endings={maniac:['谁先怕谁先退。','这桌还没凉。','别急着躲。'],calculator:['价格要看清楚。','不靠运气做承诺。','我照这个判断走。'],gambler:['值得一试。','波动我认。','继续看结果。'],professor:['轮到你判断。','答案要靠行动验证。','观察还没结束。'],rock:['该守就守。','不必每手都争。','筹码要用在地方。'],trapper:['别急着下结论。','故事还有后半段。','你猜我下一步。'],stealer:['机会不会一直等人。','筹码不争不会自己来。','守不守，你决定。'],sniper:['出手要有时机。','这一点很关键。','我等下一步。'],catcher:['话说得响不算证据。','最后还是看牌和价格。','别把沉默当认输。'],millionaire:['花钱也得有点排场。','这桌的预算还没讨论完。','别替我心疼筹码。']};
  const LINES=Object.fromEntries(Object.entries(scripts).map(([id,lines])=>[id,Object.fromEntries(events.map((event,k)=>[event,endings[id].map(end=>lines[k]+end)]))]));
  const moods={maniac:['上手没拿下，这手我重新找机会。','刚才的火力，还没熄。','压得够狠，我得挑好反击。'],calculator:['刚才亏了，但这手要单独计算。','账面好看，价格仍要算清。','筹码不深了，错误会更贵。'],gambler:['亏过一手，不代表下一手不值得冒险。','这一桌的波动，我开始适应了。','风险大了，我也得选时机。'],professor:['刚才的失利，不改变这手的证据。','顺风的时候，更要核对判断。','筹码压力，也是题目的一部分。'],rock:['刚才没守住，这次更得稳。','筹码攒起来，不必急着花。','压力大，先保护有效筹码。'],trapper:['上一局没成，不必照搬旧故事。','节奏在变，别急着猜。','有人压价，我得换个角度。'],stealer:['这次再找一个空当。','刚才得手，不代表你还会退。','守得紧了，我换个机会。'],sniper:['失手之后，更要看清目标。','有了筹码，也不能乱出手。','压力到了，我会重新定位。'],catcher:['刚才验证太贵，这次要看清价格。','上次看到了答案，这次也得重新判断。','故事讲得狠，我得衡量验证成本。'],millionaire:['刚才花超了，这手预算重新开。','钱包厚了一点，也不能全靠排场。','开销有点大，容我盘算一下。']};
  function choose(id,event,{emotion=null,model=null,targetPresent=true}={},recent=[],rng=Math.random){
    const bank=LINES[id]||LINES.calculator;let candidates=bank[event]||bank.check;
    const emotionAPI=typeof module==='object'&&module.exports?require('./emotion.js'):globalThis.PokerEmotion,c=emotionAPI.config(id);
    const frustration=c.f,pressure=c.p;
    if(emotion?.frustration>frustration&&['raise','call','allin'].includes(event))candidates=candidates.map(t=>t+(moods[id]||moods.calculator)[0]);
    else if(emotion?.confidence>c.high&&['raise','value','steal'].includes(event))candidates=candidates.map(t=>t+(moods[id]||moods.calculator)[1]);
    else if(emotion?.pressure>pressure&&['fold','call','check','allin'].includes(event))candidates=candidates.map(t=>t+(moods[id]||moods.calculator)[2]);
    else if(emotion?.focus>.22&&['fold','call','check','raise'].includes(event))candidates=candidates.map(t=>t+({calculator:'这个新价格，我得重新算。',professor:'你的线路，我会重新审视。',rock:'每一笔投入，都得留意。',trapper:'节奏变了，我先保持沉着。',sniper:'现在更得看清出手时机。',catcher:'频繁施压，让我多一分怀疑。',stealer:'有人守了，我得重新找空当。'}[id]||'这一步，我会认真判断。'));
    else if(targetPresent&&model?.confident&&event==='raise')candidates=candidates.map(t=>t+({aggressive:'你最近加得很勤。',tight:'你最近出手很谨慎。',calling:'你最近愿意跟到底。'}[model.style]||''));
    const available=candidates.filter(t=>!recent.slice(-8).includes(t)),pool=available.length?available:candidates;
    const text=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];return text.length>80?text.slice(0,79)+'…':text;
  }
  return {LINES,events,choose};
});
