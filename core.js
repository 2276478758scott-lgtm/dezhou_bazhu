(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./kernel.js') : root.PokerKernel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Poker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(K) {
  'use strict';
  const SUITS = ['♠','♥','♦','♣'];
  const NAMES = ['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺'];
  const rank = c => c % 13 + 2;
  const suit = c => Math.floor(c / 13);
  const cardText = c => ({11:'J',12:'Q',13:'K',14:'A'}[rank(c)] || rank(c)) + SUITS[suit(c)];
  function shuffle(cards, rng = Math.random) {
    const a = cards.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i],a[j]] = [a[j],a[i]]; }
    return a;
  }
  function compare(a,b) { for(let i=0;i<Math.max(a.length,b.length);i++) { const d=(a[i]||0)-(b[i]||0); if(d) return Math.sign(d); } return 0; }
  function five(cards) {
    const rs=cards.map(rank).sort((a,b)=>b-a), counts=new Map();
    for(const r of rs) counts.set(r,(counts.get(r)||0)+1);
    const groups=[...counts].sort((a,b)=>b[1]-a[1] || b[0]-a[0]);
    const unique=[...new Set(rs)];
    let straight=0;
    if(unique.length===5) {
      if(unique[0]-unique[4]===4) straight=unique[0];
      else if(unique.join(',')==='14,5,4,3,2') straight=5;
    }
    const flush=cards.every(c=>suit(c)===suit(cards[0]));
    if(flush && straight) return [8,straight];
    if(groups[0][1]===4) return [7,groups[0][0],groups[1][0]];
    if(groups[0][1]===3 && groups[1][1]===2) return [6,groups[0][0],groups[1][0]];
    if(flush) return [5,...rs];
    if(straight) return [4,straight];
    if(groups[0][1]===3) return [3,groups[0][0],...groups.slice(1).map(g=>g[0])];
    if(groups[0][1]===2 && groups[1][1]===2) return [2,Math.max(groups[0][0],groups[1][0]),Math.min(groups[0][0],groups[1][0]),groups[2][0]];
    if(groups[0][1]===2) return [1,groups[0][0],...groups.slice(1).map(g=>g[0])];
    return [0,...rs];
  }
  function evaluate(cards) {
    if(cards.length<5 || cards.length>7 || new Set(cards).size!==cards.length || cards.some(c=>!Number.isInteger(c)||c<0||c>51)) throw new Error('牌型判定需要 5–7 张不同的合法牌');
    let best=null;
    for(let a=0;a<cards.length-4;a++) for(let b=a+1;b<cards.length-3;b++) for(let c=b+1;c<cards.length-2;c++) for(let d=c+1;d<cards.length-1;d++) for(let e=d+1;e<cards.length;e++) {
      const score=five([cards[a],cards[b],cards[c],cards[d],cards[e]]);
      if(!best||compare(score,best)>0) best=score;
    }
    return best;
  }
  function evaluateDetailed(cards) {
    const score=evaluate(cards);let bestFive=null;
    for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
      const hand=[cards[a],cards[b],cards[c],cards[d],cards[e]];
      if(compare(five(hand),score)===0&&!bestFive)bestFive=hand;
    }
    return {score,bestFive};
  }
  // Each contribution level forms its own pot. Folded chips remain in the pot.
  function settle(players, board, dealer) {
    if(!Number.isSafeInteger(players.reduce((n,p)=>n+p.total,0))||!Number.isInteger(dealer)||dealer<0||dealer>=players.length||players.some(p=>!Number.isSafeInteger(p.total)||p.total<0))throw new Error('无效投入筹码');
    const levels=[...new Set(players.map(p=>p.total).filter(n=>n>0))].sort((a,b)=>a-b);
    const awards=players.map(()=>0), pots=[]; let previous=0;
    const live=players.map((p,i)=>!p.folded && p.hole.length===2 ? i : -1).filter(i=>i>=0);
    const scores={},hands={};
    if(!live.length)throw new Error('没有底池争夺者');
    const cards=[...board,...players.flatMap(p=>p.hole)];if(cards.some(c=>!Number.isInteger(c)||c<0||c>51)||new Set(cards).size!==cards.length||live.length>1&&board.length!==5)throw Error('摊牌牌面无效');
    if(live.length>1) for(const i of live){hands[i]=evaluateDetailed([...players[i].hole,...board]);scores[i]=hands[i].score;}
    for(const level of levels) {
      const contributors=players.map((p,i)=>p.total>=level ? i : -1).filter(i=>i>=0);
      const amount=(level-previous)*contributors.length; previous=level;
      let winners,refund=false,eligible=[];
      if(contributors.length===1) { winners=contributors; refund=true; }
      else {
        eligible=contributors.filter(i=>live.includes(i));
        if(!eligible.length) throw new Error('底池没有合法获胜者');
        winners=[eligible[0]];
        for(const i of eligible.slice(1)) { const cmp=live.length===1 ? 0 : compare(scores[i],scores[winners[0]]); if(cmp>0) winners=[i]; else if(cmp===0) winners.push(i); }
      }
      winners.sort((a,b)=>(a-dealer-1+players.length)%players.length-(b-dealer-1+players.length)%players.length);
      const prior=pots[pots.length-1];
      if(!refund&&prior&&!prior.refund&&prior.eligible.join(',')===eligible.join(',')) prior.amount+=amount;
      else pots.push({amount,winners:winners.slice(),refund,eligible});
    }
    for(const pot of pots) {
      const share=Math.floor(pot.amount/pot.winners.length),remainder=pot.amount%pot.winners.length;
      pot.winners.forEach((i,k)=>awards[i]+=share+(k<remainder?1:0));
    }
    return {awards,pots,scores,hands,kind:live.length>1?'showdown':'fold'};
  }
  class Game {
    constructor({stacks=[1500,1500,1500,1500],smallBlind=10,bigBlind=20,rng=null,seed=Date.now(),profiles=['human','maniac','calculator','gambler']}={}) {
      if(stacks.length<2||stacks.length>10 || stacks.some(n=>!Number.isSafeInteger(n)||n<0)||!Number.isSafeInteger(stacks.reduce((a,b)=>a+b,0)) || !Number.isSafeInteger(smallBlind)||!Number.isSafeInteger(bigBlind)||smallBlind<=0||bigBlind<smallBlind) throw new Error('筹码及盲注设置无效');
      this.players=stacks.map((stack,i)=>({name:['你','烈焰','猎狐','铁壁'][i]||`玩家${i}`,stack,hole:[],folded:stack===0,bet:0,total:0,lastContribution:0,acted:false,actedBet:0,lastAction:'',recentActions:[],stats:{hands:0,vpip:0,raises:0,folds:0,calls:0}}));
      this.sb=smallBlind; this.bb=bigBlind; this.random=K.streams(seed);this.rng=rng||this.random.deal;this.tableId=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);this.events=[];this.eventSeq=0; this.dealer=-1; this.hand=0; this.phase='idle'; this.actor=null; this.log=[]; this.pending=new Set();
      this.players.forEach((p,i)=>p.profile=profiles[i]||'calculator');this.mode='quick';this.history=[];this.totalChips=stacks.reduce((a,b)=>a+b,0);
    }
    nextSeat(from,predicate) { for(let n=1;n<=this.players.length;n++) { const i=(from+n+this.players.length)%this.players.length; if(predicate(this.players[i],i)) return i; } return null; }
    active(p) { return !p.folded && p.stack>0 && p.hole.length===2; }
    pot() { return this.players.reduce((s,p)=>s+p.total,0); }
    pay(i,amount) { if(!this.players[i]||!Number.isSafeInteger(amount)||amount<0)throw Error('支付筹码无效');const p=this.players[i], n=Math.min(p.stack,amount); p.stack-=n;p.bet+=n;p.total+=n;p.lastContribution=n;return n; }
    startHand() {
      if(!['idle','complete'].includes(this.phase)) throw new Error('本手尚未结束');
      if(this.players.filter(p=>p.stack>0).length<2) throw new Error('牌局已结束，请重新开局');
      const previousPlaying=this.players.map((p,i)=>p.hole.length===2?i:-1).filter(i=>i>=0),oldBB=this.bbSeat;
      this.events=[];this.hand++;this.result=null;this.board=[];this.log=[];this.history=[];this.handStart=this.players.map(p=>p.stack);
      this.deck=shuffle(Array.from({length:52},(_,i)=>i),this.rng);
      for(const p of this.players) { p.hole=[];p.bet=0;p.total=0;p.lastContribution=0;p.folded=p.stack===0;p.acted=false;p.actedBet=0;p.lastAction='';p.voluntary=false;p.expectedEquity=.5; if(!p.folded) p.stats.hands++; }
      const seated=this.players.filter(p=>!p.folded).length;
      if(this.hand===1){this.dealer=this.nextSeat(-1,p=>p.stack>0);this.sbSeat=seated===2?this.dealer:this.nextSeat(this.dealer,p=>!p.folded);this.bbSeat=this.nextSeat(this.sbSeat,p=>!p.folded);}
      else {
        this.bbSeat=this.nextSeat(oldBB,p=>p.stack>0);
        if(seated===2){this.dealer=this.nextSeat(this.bbSeat,p=>p.stack>0);this.sbSeat=this.dealer;}
        else {const prev=i=>{for(let n=1;n<=this.players.length;n++){const j=(i-n+this.players.length)%this.players.length;if(previousPlaying.includes(j))return j;}};this.sbSeat=prev(this.bbSeat);this.dealer=prev(this.sbSeat);}
      }
      for(let n=0;n<2;n++) { let i=this.dealer; for(let k=0;k<seated;k++) { i=this.nextSeat(i,p=>!p.folded);this.players[i].hole.push(this.deck.pop()); } }
      this.phase='preflop';this.actor=null;
      K.emit(this,'hand-start',{dealer:this.dealer,sbSeat:this.sbSeat,bbSeat:this.bbSeat,blinds:[this.sb,this.bb],stacks:this.handStart,names:this.players.map(p=>p.name)},{holes:this.players.map(p=>p.hole),identities:this.players.map(p=>p.profile)});
      const beforeSB=this.players[this.sbSeat].stack;const paidSB=this.pay(this.sbSeat,this.sb);K.emit(this,'blind',{seat:this.sbSeat,amount:paidSB,stackBefore:beforeSB,stackAfter:this.players[this.sbSeat].stack,potAfter:this.pot()});
      const beforeBB=this.players[this.bbSeat].stack;const paidBB=this.pay(this.bbSeat,this.bb);K.emit(this,'blind',{seat:this.bbSeat,amount:paidBB,stackBefore:beforeBB,stackAfter:this.players[this.bbSeat].stack,potAfter:this.pot()});
      this.currentBet=this.bb;this.minRaise=this.bb;this.phase='preflop';
      this.log.push(`第 ${this.hand} 手 · 盲注 ${this.sb}/${this.bb}`);
      this.log.push(`${this.players[this.sbSeat].name}：小盲 ${this.players[this.sbSeat].bet}；${this.players[this.bbSeat].name}：大盲 ${this.players[this.bbSeat].bet}`);
      this.pending=new Set(this.players.map((p,i)=>this.active(p)?i:-1).filter(i=>i>=0));
      this.pruneDryPot();this.advance(this.bbSeat);
    }
    pruneDryPot() {
      const act=this.players.map((p,i)=>this.active(p)?i:-1).filter(i=>i>=0);
      if(act.length===1 && this.players[act[0]].bet>=this.currentBet) this.pending.delete(act[0]);
      for(const i of this.pending) if(!this.active(this.players[i])) this.pending.delete(i);
    }
    legal(i=this.actor) {
      if(i===null || i!==this.actor || this.phase==='complete') return null;
      const p=this.players[i], toCall=Math.max(0,this.currentBet-p.bet), max=p.bet+p.stack;
      const reopened=!p.acted || (p.lastAction==='check' && this.currentBet>0) || this.currentBet-p.actedBet>=this.minRaise;
      const opponent=this.players.some((q,j)=>j!==i&&this.active(q));
      const min=this.currentBet===0?this.bb:this.currentBet+this.minRaise;
      return {fold:true,check:toCall===0,call:toCall>0,callAmount:Math.min(toCall,p.stack),toCall,raise:reopened&&opponent&&max>this.currentBet,minRaiseTo:Math.min(min,max),fullRaiseTo:min,maxRaiseTo:max};
    }
    act(i,type,target) {
      const l=this.legal(i);if(!l) throw new Error('尚未轮到该玩家');
      if(type==='bet'){if(this.currentBet!==0)throw new Error('当前只能加注');type='raise';}
      if(type==='allin'){if(l.raise){type='raise';target=l.maxRaiseTo;}else if(l.call&&this.players[i].stack<=l.toCall)type='call';else throw new Error('当前不能全下');}
      const p=this.players[i],potBefore=this.pot(),betBefore=this.currentBet,stackBefore=p.stack;let label;
      if(type==='fold') { p.folded=true;p.stats.folds++;label='弃牌'; }
      else if(type==='check' && l.check) label='过牌';
      else if(type==='call' && l.call) { this.pay(i,l.callAmount);p.stats.calls++;label=p.stack===0?`全下跟注 ${l.callAmount}`:`跟注 ${l.callAmount}`; }
      else if(type==='raise' && l.raise) {
        if(!Number.isInteger(target)||target<l.minRaiseTo||target>l.maxRaiseTo) throw new Error('加注额不合法');
        const old=this.currentBet,increment=target-old;
        this.pay(i,target-p.bet);this.currentBet=target;p.stats.raises++;
        if(increment>=this.minRaise) {
          this.minRaise=increment;
          this.pending=new Set(this.players.map((q,j)=>j!==i&&this.active(q)?j:-1).filter(j=>j>=0));
        } else for(let j=0;j<this.players.length;j++) if(j!==i && this.active(this.players[j]) && this.players[j].bet<this.currentBet) this.pending.add(j);
        label=p.stack===0?`全下至 ${target}`:old===0?`下注 ${target}`:`加注至 ${target}`;
      } else throw new Error('操作不合法');
      if(type==='check'||type==='fold')p.lastContribution=0;
      this.history.push({seat:i,type,target:type==='raise'?target:null,amount:p.lastContribution,phase:this.phase,hand:this.hand,potBefore,betBefore,facing:l.toCall,stackAfter:p.stack});
      K.emit(this,'action',{...this.history[this.history.length-1],stackBefore,potAfter:this.pot(),betAfter:this.currentBet});
      if(this.phase==='preflop' && ['call','raise'].includes(type) && !p.voluntary) { p.voluntary=true;p.stats.vpip++; }
      p.recentActions.push({type,facing:l.toCall>0,phase:this.phase,hand:this.hand,pressure:type==='raise'?(target-betBefore)/Math.max(this.bb,potBefore+l.toCall):0});
      if(p.recentActions.length>24)p.recentActions.shift();
      p.acted=true;p.actedBet=this.currentBet;p.lastAction=type;
      this.log.push(`${p.name}：${label}`);this.pending.delete(i);
      this.pruneDryPot();this.advance(i);
    }
    advance(from) {
      for(let transitions=0;transitions<5;transitions++) {
        const live=this.players.filter(p=>!p.folded&&p.hole.length===2);
        if(live.length===1) { this.finish();return; }
        if(this.pending.size) { this.actor=this.nextSeat(from,(_,i)=>this.pending.has(i));return; }
        if(this.phase==='river') { this.finish();return; }
        this.deck.pop(); // Burn before each community street.
        if(this.phase==='preflop') { this.phase='flop';this.board.push(this.deck.pop(),this.deck.pop(),this.deck.pop()); }
        else { this.phase=this.phase==='flop'?'turn':'river';this.board.push(this.deck.pop()); }
        this.log.push(({flop:'翻牌',turn:'转牌',river:'河牌'})[this.phase]+'：'+this.board.map(cardText).join(' '));
        K.emit(this,'community',{street:this.phase});
        this.currentBet=0;this.minRaise=this.bb;
        for(const p of this.players) { p.bet=0;p.acted=false;p.actedBet=0;p.lastAction=''; }
        this.pending=new Set(this.players.map((p,i)=>this.active(p)?i:-1).filter(i=>i>=0));
        this.pruneDryPot();from=this.dealer;
      }
      throw Error('行动轮次未能终止');
    }
    finish() {
      if(this.phase==='complete')return this.result;
      this.result=settle(this.players,this.board,this.dealer);
      if(this.result.awards.reduce((n,a)=>n+a,0)!==this.pot())throw Error('底池结算不守恒');
      this.result.awards.forEach((n,i)=>this.players[i].stack+=n);
      this.result.net=this.players.map((p,i)=>p.stack-this.handStart[i]);
      for(const pot of this.result.pots) this.log.push(`${pot.refund?'退回未被跟注的筹码':'底池 '+pot.amount}：${pot.winners.map(i=>this.players[i].name).join('、')}${pot.refund?' '+pot.amount:''}`);
      this.phase='complete';this.actor=null;this.pending.clear();
      K.emit(this,'settlement',{result:this.result,stacks:this.players.map(p=>p.stack)},{holes:this.players.map(p=>p.hole)});return this.result;
    }
  }
  function invariant(g){
    if(g.players.some(p=>!Number.isSafeInteger(p.stack)||p.stack<0||!Number.isSafeInteger(p.total)||p.total<0||!Number.isSafeInteger(p.bet)||p.bet<0||p.bet>p.total))throw Error('筹码状态无效');
    if(g.players.reduce((n,p)=>n+p.stack+(g.phase==='complete'?0:p.total),0)!==g.totalChips)throw Error('牌桌筹码不守恒');
    if(!['idle','complete'].includes(g.phase)&&(!g.pending.has(g.actor)||!g.active(g.players[g.actor])))throw Error('行动顺序无效');
    const cards=[...(g.deck||[]),...(g.board||[]),...g.players.flatMap(p=>p.hole)];if(new Set(cards).size!==cards.length)throw Error('出现重复牌');
    return true;
  }
  // Core commands either commit completely or restore the preceding checkpoint.
  for(const method of ['act','startHand']){const original=Game.prototype[method];Game.prototype[method]=function(...args){
    const before={};for(const [k,v]of Object.entries(this))if(k!=='rng'&&k!=='random')before[k]=k==='pending'?[...v]:v;
    const copy=K.clone(before),rngStates=K.states(this),managed=this.rng===this.random.deal;
    try{const result=original.apply(this,args);invariant(this);return result;}catch(error){for(const k of Object.keys(this))if(k!=='rng'&&k!=='random')delete this[k];Object.assign(this,copy);this.pending=new Set(copy.pending);this.random=K.streams(0,rngStates);if(managed)this.rng=this.random.deal;throw error;}
  };}
  Game.prototype.execute=function(command){
    if(!command||typeof command.id!=='string')throw Error('操作编号无效');
    if(this.lastCommand?.id===command.id)return false;
    const e=command.expected;if(!e||e.hand!==this.hand||e.phase!==this.phase||e.actor!==this.actor||e.seq!==this.eventSeq)throw Error('操作已过期');
    this.act(command.seat,command.type,command.target);this.lastCommand={id:command.id};return true;
  };
  return {invariant,Game,rank,suit,cardText,shuffle,evaluate,evaluateDetailed,compare,settle,NAMES};
});
