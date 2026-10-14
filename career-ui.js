(()=>{'use strict';const C=window.PokerCareer,el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 window.PokerCareerUI={mount(get,commands){const dialog=el('dialog');dialog.id='career-lobby';dialog.setAttribute('aria-label','赛事与冠军资金');document.body.append(dialog);
  function show(){const {career:c,game:g}=get();dialog.replaceChildren();dialog.append(el('h2','赛事与冠军资金 🏆'));const money=el('button','冠军资金 '+C.compact(c.balance));money.className='quiet';money.onclick=()=>alert('精确余额：'+BigInt(c.balance).toLocaleString()+' 虚拟筹码');dialog.append(money);const active=!!c.active||!['idle','complete'].includes(g.phase),run=c.tournament;
   dialog.append(el('p',run?'锦标赛：'+C.stages[run.index].name+' · '+({playing:'进行中',failed:'本桌失利，可重试',between:'本桌通过',complete:'已通关',abandoned:'已退出'})[run.status]:'通关四桌锦标赛，获得 20,000 冠军资金并解锁大奖赛。'));
   const begin=el('button',run?.status==='failed'?'重试当前关卡':'开始四桌锦标赛');begin.disabled=active||run?.status==='between';begin.onclick=()=>perform(()=>commands.tournament());dialog.append(begin);
   if(!c.active&&run?.status==='between'){const next=el('button','晋级下一桌');next.onclick=()=>perform(()=>commands.advance());dialog.append(next);}
   dialog.append(el('h3','冠军大奖赛 · 每桌 Pokerface'));const pool=el('select');pool.id='grandprix-pool';pool.setAttribute('aria-label','四人总筹码档位');for(const amount of C.pools){const option=el('option','四人总筹码 '+C.compact(amount)+' · 买入 '+C.compact(amount/4));option.value=amount;option.disabled=BigInt(c.balance)<BigInt(amount/4);pool.append(option);}const affordable=C.pools.filter(n=>BigInt(c.balance)>=BigInt(n/4));pool.value=affordable.includes(20000)?20000:affordable.at(-1)||400;pool.disabled=!c.unlocked||active;dialog.append(pool);
   const enter=el('button',c.unlocked?'买入并开始大奖赛':'大奖赛尚未解锁');enter.id='grandprix-enter';enter.disabled=!c.unlocked||active||!affordable.length;enter.onclick=()=>perform(()=>commands.grandprix(Number(pool.value)));dialog.append(enter,el('p','买入扣款，夺冠或结算后退赛时返还桌上筹码。当前手内不能退赛。所有资金均为虚拟筹码。'));
   const recover=el('button','免费补足 100 · 重建资金');recover.id='career-bailout';recover.disabled=!c.unlocked||active||BigInt(c.balance)>=100n;recover.onclick=()=>{try{commands.bailout();show();}catch(error){status.textContent=error.message;}};dialog.append(recover);
   if(g.match&&!g.match.finalized){const quit=el('button','结算后退赛，收回剩余筹码');quit.id='career-withdraw';quit.disabled=g.phase!=='complete';quit.onclick=()=>perform(()=>commands.withdraw());dialog.append(quit);}
   dialog.append(el('h3','宿敌记忆'));const hidden=g.pokerface?.enabled&&!g.pokerface.revealed,visible=hidden?[]:Object.values(c.rivals);if(hidden)dialog.append(el('p','本桌隐藏人物将在结束后展示对应的宿敌资料。'));if(!visible.length)dialog.append(el('p','参加赛事后逐步记录交锋。'));for(const r of visible){const row=el('details'),name=AName(r.id);row.append(el('summary',name+' · 交锋 '+r.hands+' 手'),el('p','敌意 '+Math.round(r.hostility*100)+' · 疑心 '+Math.round(r.suspicion*100)+' · 尊重 '+Math.round(r.respect*100)));for(const f of r.facts.slice(-5).reverse())row.append(el('p',f.text+'（第 '+f.hand+' 手）'));dialog.append(row);}
   const status=el('p');status.id='career-status';status.setAttribute('role','status');const close=el('button','回到牌桌');close.className='primary';close.onclick=()=>dialog.close();dialog.append(status,close);
   function perform(fn){try{fn();dialog.close();}catch(error){status.textContent=error.message;}}
  }
  function AName(id){return window.PokerAI.PROFILES[id]?.name||'牌友';}
  function open(){commands.pause();show();if(!dialog.open)dialog.showModal();}document.getElementById('career-open').onclick=open;return {open,refresh:()=>{if(dialog.open)show();}};
 }};
})();


