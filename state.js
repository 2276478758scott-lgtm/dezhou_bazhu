(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./core.js'):r.Poker);if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerState=a;})(globalThis,P=>{
  'use strict';const VERSION=2,KEY='dezhou-bazhu-local-v2';
  function random(seed){let value=seed>>>0;const fn=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};Object.defineProperty(fn,'state',{get:()=>value});return fn;}
  function create(options={},seed=Date.now()){return new P.Game({...options,rng:random(seed)});}
  function snapshot(game,extras={}){const copy={};for(const [key,value] of Object.entries(game))if(key!=='rng')copy[key]=key==='pending'?[...value]:value;
    return JSON.parse(JSON.stringify({version:VERSION,game:copy,seed:game.rng.state??1,extras}));}
  function restore(data){
    if(data?.version!==VERSION||!data.game||!Number.isInteger(data.seed))throw new Error('存档版本或结构无效');const x=data.game;
    if(!Array.isArray(x.players)||x.players.length!==4||!Array.isArray(x.pending)||!Array.isArray(x.history)||!Array.isArray(x.log)||!['idle','preflop','flop','turn','river','complete'].includes(x.phase))throw new Error('存档牌桌无效');
    const integer=n=>Number.isSafeInteger(n)&&n>=0;
    for(const p of x.players){if(!integer(p.stack)||!integer(p.total)||!integer(p.bet)||p.bet>p.total||!integer(p.lastContribution)||!Array.isArray(p.hole)||![0,2].includes(p.hole.length)||typeof p.folded!=='boolean')throw new Error('存档筹码或底牌无效');
      if(typeof p.name!=='string'||!p.stats||!Array.isArray(p.recentActions)||typeof p.acted!=='boolean'||!integer(p.actedBet))throw new Error('存档玩家状态无效');
      if(p.emotion&&['frustration','confidence','pressure','focus','doubt'].some(k=>p.emotion[k]!==undefined&&(!Number.isFinite(p.emotion[k])||p.emotion[k]<0||p.emotion[k]>1)))throw new Error('存档情绪无效');}
    const cards=[...(x.deck||[]),...(x.board||[]),...x.players.flatMap(p=>p.hole)];if(cards.some(c=>!Number.isInteger(c)||c<0||c>51)||new Set(cards).size!==cards.length)throw new Error('存档有重复或非法牌');
    if(!integer(x.totalChips)||x.players.reduce((s,p)=>s+p.stack+(x.phase==='complete'?0:p.total),0)!==x.totalChips)throw new Error('存档筹码不守恒');
    if(!Array.isArray(x.pending)||new Set(x.pending).size!==x.pending.length||x.pending.some(i=>!Number.isInteger(i)||!x.players[i]||x.players[i].folded||x.players[i].stack===0))throw new Error('存档行动集合无效');
    if(['idle','complete'].includes(x.phase)?x.actor!==null:!x.pending.includes(x.actor))throw new Error('存档行动者无效');
    const lengths={preflop:0,flop:3,turn:4,river:5};if(x.phase in lengths&&x.board.length!==lengths[x.phase])throw new Error('存档公共牌数量无效');
    if(!integer(x.currentBet??0)||!integer(x.minRaise??x.bb)||!integer(x.hand))throw new Error('存档下注状态无效');
    if(x.challenges){const c=x.challenges;if(!integer(c.hand)||c.hand>x.hand||!integer(c.used)||c.used>2||!Array.isArray(c.keys)||c.keys.length!==c.used||new Set(c.keys).size!==c.keys.length||c.keys.some(k=>typeof k!=='string'||k.length>80))throw new Error('存档喊话额度无效');}
    if(!['idle','complete'].includes(x.phase)&&x.players.some(p=>p.bet>x.currentBet))throw new Error('存档下注额度不一致');
    if(x.phase==='complete'){
      const expected=P.settle(x.players,x.board,x.dealer);if(JSON.stringify(expected.awards)!==JSON.stringify(x.result?.awards)||JSON.stringify(expected.hands)!==JSON.stringify(x.result?.hands)||JSON.stringify(expected.pots)!==JSON.stringify(x.result?.pots)||expected.kind!==x.result?.kind||!Array.isArray(x.handStart)||x.handStart.length!==4||x.handStart.some(n=>!integer(n))||JSON.stringify(x.players.map((p,i)=>p.stack-x.handStart[i]))!==JSON.stringify(x.result.net))throw new Error('存档结算不一致');
    }
    const extras=data.extras||{};if(extras.conversation&&(!Array.isArray(extras.conversation)||extras.conversation.some(e=>!e||typeof e.text!=='string'||!integer(e.hand))))throw new Error('存档聊天无效');
    const game=new P.Game({stacks:x.players.map(p=>p.stack),smallBlind:x.sb,bigBlind:x.bb});Object.assign(game,x);game.pending=new Set(x.pending);game.rng=random(data.seed);return {game,extras:data.extras||{}};
  }
  function save(storage,game,extras){storage.setItem(KEY,JSON.stringify(snapshot(game,extras)));}
  function load(storage){const raw=storage.getItem(KEY);return raw?restore(JSON.parse(raw)):null;}
  return {VERSION,KEY,random,create,snapshot,restore,save,load};
});
