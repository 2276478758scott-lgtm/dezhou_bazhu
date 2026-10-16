(()=>{'use strict';const C=window.PokerCareer,el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 window.PokerCareerUI={mount(get,commands){
  const dialog=el('dialog');dialog.id='career-lobby';dialog.setAttribute('aria-label','三种游戏模式与冠军资金');document.body.append(dialog);let selected=null;
  function show(){
   const {career:c,game:g}=get(),active=!!c.active||!['idle','complete'].includes(g.phase),run=c.tournament;
   dialog.replaceChildren();dialog.append(el('h2','开始游戏'));
   const modes=el('nav');modes.className='home-mode-entries';modes.setAttribute('aria-label','三种游戏模式');
   const quick=el('button','快速局');quick.id='career-quick';quick.className='home-mode-entry';quick.append(el('small','自由选择对手与筹码'));quick.disabled=active;quick.onclick=()=>perform(()=>commands.quick());
   const tournament=el('button','四桌晋级锦标赛');tournament.id='career-mode-tournament';tournament.className='home-mode-entry';tournament.setAttribute('aria-pressed',String(selected==='tournament'));tournament.append(el('small','四桌晋级 · 挑战冠军桌'));tournament.onclick=()=>{selected='tournament';show();};
   const grandprix=el('button','冠军大奖赛');grandprix.id='career-mode-grandprix';grandprix.className='home-mode-entry';grandprix.setAttribute('aria-pressed',String(selected==='grandprix'));grandprix.append(el('small',c.unlocked?'高额奖池 · 每桌 Pokerface':'通关四桌锦标赛后解锁'));grandprix.onclick=()=>{selected='grandprix';show();};
   modes.append(quick,tournament,grandprix);dialog.append(modes);
   if(active){const resume=el('button','继续当前牌桌');resume.id='career-resume';resume.className='primary';resume.onclick=()=>{try{window.PokerView.resume();dialog.close();window.PokerHome?.enterTable();}catch(e){status.textContent=e.message;}};dialog.append(resume,el('p','请先完成当前一手。生涯牌桌需结算后退赛，才能切换模式。'));}
   const money=el('button','冠军资金 '+C.compact(c.balance));money.className='quiet career-bank';money.onclick=()=>window.PokerDialogs.message('冠军资金','精确余额：'+BigInt(c.balance).toLocaleString()+' 虚拟筹码');dialog.append(money);
   if(selected==='tournament'){
    const section=el('section');section.id='career-tournament-detail';section.append(el('h3','四桌晋级锦标赛'),el('p',run?'锦标赛：'+C.stages[run.index].name+' · '+({playing:'进行中',failed:'本桌失利，可重试',between:'本桌通过',complete:'已通关',abandoned:'已退出'})[run.status]:'每桌各 3,000 筹码，赢下整桌晋级。通关四桌，获得 20,000 冠军资金并解锁大奖赛。'));
    const progress=el('ol');progress.className='career-stages';C.stages.forEach((stage,i)=>{const step=el('li'),passed=!!run?.passed[i],current=run?.index===i&&!passed;step.className=passed?'passed':current?'current':'';step.append(el('span',String(i+1).padStart(2,'0')),el('strong',stage.name),el('small',passed?'已通过':current?'当前关卡':i===0&&!run?'从这里开始':'待挑战'));progress.append(step);});section.append(progress);
    const begin=el('button',run?.status==='failed'?'重试当前关卡':'开始四桌锦标赛');begin.id='career-tournament-start';begin.disabled=active||run?.status==='between';begin.onclick=()=>perform(()=>commands.tournament());section.append(begin);
    if(!c.active&&run?.status==='between'){const next=el('button','晋级下一桌');next.id='career-advance';next.onclick=()=>perform(()=>commands.advance());section.append(next);}dialog.append(section);
   }
   if(selected==='grandprix'){
    const section=el('section');section.id='career-grandprix-detail';section.append(el('h3','冠军大奖赛 · 每桌 Pokerface'));
    if(!c.unlocked)section.append(el('p','通关四桌晋级锦标赛后解锁。所有档位始终可见，解锁且资金足够即可买入。'));
    const pool=el('select');pool.id='grandprix-pool';pool.setAttribute('aria-label','四人总筹码档位');for(const amount of C.pools){const option=el('option','四人总筹码 '+C.compact(amount)+' · 买入 '+C.compact(amount/4));option.value=amount;option.disabled=BigInt(c.balance)<BigInt(amount/4);pool.append(option);}const affordable=C.pools.filter(n=>BigInt(c.balance)>=BigInt(n/4));pool.value=affordable.includes(20000)?20000:affordable.at(-1)||400;pool.disabled=!c.unlocked||active;section.append(pool);
    const enter=el('button',c.unlocked?'买入并开始大奖赛':'大奖赛尚未解锁');enter.id='grandprix-enter';enter.disabled=!c.unlocked||active||!affordable.length;enter.onclick=()=>perform(()=>commands.grandprix(Number(pool.value)));section.append(enter,el('p','买入扣款，夺冠或结算后退赛时返还桌上筹码。当前手内不能退赛。所有资金均为虚拟筹码。'));
    const recover=el('button','免费补足 100 · 重建资金');recover.id='career-bailout';recover.disabled=!c.unlocked||active||BigInt(c.balance)>=100n;recover.onclick=()=>{try{commands.bailout();show();}catch(e){status.textContent=e.message;}};section.append(recover);dialog.append(section);
   }
   if(g.match&&!g.match.finalized){const quit=el('button','结算后退赛，收回剩余筹码');quit.id='career-withdraw';quit.disabled=g.phase!=='complete';quit.onclick=()=>perform(()=>commands.withdraw());dialog.append(quit);}
   const rivals=el('details');rivals.append(el('summary','宿敌记忆'));const hidden=g.pokerface?.enabled&&!g.pokerface.revealed,visible=hidden?[]:Object.values(c.rivals);if(hidden)rivals.append(el('p','本桌隐藏人物将在结束后展示对应的宿敌资料。'));if(!visible.length)rivals.append(el('p','参加赛事后逐步记录交锋。'));for(const r of visible){const row=el('details'),name=window.PokerAI.PROFILES[r.id]?.name||'牌友';row.append(el('summary',name+' · 交锋 '+r.hands+' 手'),el('p','敌意 '+Math.round(r.hostility*100)+' · 疑心 '+Math.round(r.suspicion*100)+' · 尊重 '+Math.round(r.respect*100)));for(const f of r.facts.slice(-5).reverse())row.append(el('p',f.text+'（第 '+f.hand+' 手）'));rivals.append(row);}dialog.append(rivals);
   const status=el('p');status.id='career-status';status.setAttribute('role','status');const close=el('button',window.PokerHome?.isOpen()?'返回主菜单':'回到牌桌');close.className='primary';close.onclick=()=>dialog.close();dialog.append(status,close);
   function perform(fn){try{fn();dialog.close();}catch(e){status.textContent=e.message;}}
  }
  function open(){commands.pause();selected=null;show();if(!dialog.open)dialog.showModal();}document.getElementById('career-open').onclick=open;return {open,refresh:()=>{if(dialog.open)show();}};
 }};
})();
