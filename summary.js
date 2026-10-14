(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerSummary=a;})(globalThis,()=>{
  'use strict';
  const create=()=>({version:1,current:null,nextId:1,tables:[]});
  function start(l,g,now=Date.now()){if(g.phase==='idle')return null;let t=l.tables.find(t=>t.id===l.current);if(t&&t.status!=='abandoned')return t;
    t={id:l.nextId++,eventTableId:g.tableId||null,mode:g.mode||'quick',started:now,status:'playing',champion:null,hidden:!!g.pokerface?.enabled,revealed:!g.pokerface?.enabled||!!g.pokerface?.revealed,roleNames:g.players.map(p=>p.roleName||p.name),names:g.players.map(p=>p.name),profiles:g.players.map(p=>p.profile),initial:g.handStart.slice(),final:g.handStart.slice(),partial:g.hand>1,hands:[]};l.tables.push(t);l.current=t.id;return t;}
  function record(l,g,now=Date.now()){
    if(g.phase!=='complete'||!g.result)return false;const t=start(l,g,now);if(g.pokerface?.revealed)t.revealed=true;if(t.hands.some(h=>h.number===g.hand))return false;
    const pots=g.result.pots.map(p=>({amount:p.amount,winners:p.winners.slice(),refund:!!p.refund}));
    const rows=g.players.map((p,i)=>{const actions=g.history.filter(a=>a.seat===i&&['call','raise','check','fold'].includes(a.type)),won=pots.filter(p=>!p.refund&&p.winners.includes(i));return {played:p.hole.length===2,won:won.length>0,split:won.some(p=>p.winners.length>1),preflopRaise:actions.some(a=>a.phase==='preflop'&&a.type==='raise'),net:g.result.net[i],stack:p.stack,vpip:actions.some(a=>a.phase==='preflop'&&['call','raise'].includes(a.type)),raises:actions.filter(a=>a.type==='raise').length,folded:actions.some(a=>a.type==='fold'),actions:actions.length,maxPot:Math.max(0,...won.map(p=>p.amount))};});
    t.hands.push({number:g.hand,time:now,kind:g.result.kind,pots,rows});t.final=g.players.map(p=>p.stack);if(g.match?.finalized&&g.match.status!=='won'){t.status=g.match.status==='lost'?'failed':'withdrawn';t.ended=now;t.revealed=true;}
    const alive=g.players.map((p,i)=>p.stack>0?i:-1).filter(i=>i>=0);if(alive.length===1){t.status='complete';t.champion=alive[0];t.ended=now;}return true;
  }
  function abandon(l,g,now=Date.now()){record(l,g,now);const t=l.tables.find(t=>t.id===l.current);if(t?.status==='playing'){t.status='abandoned';t.ended=now;t.revealed=true;}l.current=null;}
  const blank=name=>({name,hands:0,wins:0,splits:0,profitHands:0,net:0,best:0,worst:0,maxPot:0,vpip:0,raises:0,folds:0,actions:0});
  function aggregate(hands,names){const rows=names.map(blank);for(const h of hands)h.rows.forEach((r,i)=>{if(!r.played)return;const a=rows[i];a.hands++;a.wins+=r.won?1:0;a.splits+=r.split?1:0;a.profitHands+=r.net>0?1:0;a.net+=r.net;a.best=Math.max(a.best,r.net);a.worst=Math.min(a.worst,r.net);a.maxPot=Math.max(a.maxPot,r.maxPot);a.vpip+=r.vpip?1:0;a.raises+=r.raises;a.folds+=r.folded?1:0;a.actions+=r.actions;});return rows;}
  function overall(l){const hero=blank('你'),roles={};for(const t of l.tables){const rows=aggregate(t.hands,t.names);for(const [i,r]of rows.entries()){const hidden=t.hidden&&!t.revealed,key=hidden?'hidden:'+t.id+':'+i:t.profiles[i],name=hidden?t.names[i]:(t.roleNames?.[i]||t.names[i]);const out=i===0?hero:(roles[key]||=(blank(name)));for(const k of ['hands','wins','splits','profitHands','net','vpip','raises','folds','actions'])out[k]+=r[k];out.best=Math.max(out.best,r.best);out.worst=Math.min(out.worst,r.worst);out.maxPot=Math.max(out.maxPot,r.maxPot);}}
    const complete=l.tables.filter(t=>['complete','failed'].includes(t.status)&&!t.partial),wins=complete.filter(t=>t.champion===0).length;return {rows:[hero,...Object.values(roles)],complete:complete.length,wins,abandoned:l.tables.filter(t=>t.status==='abandoned').length,hands:l.tables.reduce((n,t)=>n+t.hands.length,0)};}
  function restore(data){if(!data)return create();const l=JSON.parse(JSON.stringify(data)),int=n=>Number.isSafeInteger(n)&&n>=0;
    if(l.version!==1||!Array.isArray(l.tables)||!int(l.nextId)||l.nextId<1||new Set(l.tables.map(t=>t.id)).size!==l.tables.length)throw Error('历史结构无效');
    for(const t of l.tables){t.hidden??=false;t.revealed??=true;t.roleNames??=t.names.slice();if(typeof t.hidden!=='boolean'||typeof t.revealed!=='boolean'||!Array.isArray(t.roleNames)||t.roleNames.length!==4||t.roleNames.some(n=>typeof n!=='string'))throw Error('历史身份无效');if(!int(t.id)||t.id<1||t.id>=l.nextId||!['playing','abandoned','complete','failed','withdrawn'].includes(t.status)||!int(t.started)||typeof t.partial!=='boolean'||!['names','profiles','initial','final'].every(k=>Array.isArray(t[k])&&t[k].length===4)||t.names.some(n=>typeof n!=='string')||t.profiles.some(n=>typeof n!=='string')||t.initial.concat(t.final).some(n=>!int(n))||t.initial.reduce((a,b)=>a+b,0)!==t.final.reduce((a,b)=>a+b,0)||!Array.isArray(t.hands)||new Set(t.hands.map(h=>h.number)).size!==t.hands.length)throw Error('历史对战无效');
      for(const h of t.hands){if(!int(h.number)||h.number<1||!int(h.time)||!['fold','showdown'].includes(h.kind)||!Array.isArray(h.rows)||h.rows.length!==4||!Array.isArray(h.pots))throw Error('历史牌局无效');
        for(const p of h.pots)if(!int(p.amount)||typeof p.refund!=='boolean'||!Array.isArray(p.winners)||!p.winners.length||new Set(p.winners).size!==p.winners.length||p.winners.some(i=>!int(i)||i>3))throw Error('历史底池无效');
        for(const r of h.rows)if(r.preflopRaise!==undefined&&typeof r.preflopRaise!=='boolean'||!['played','won','split','vpip','folded'].every(k=>typeof r[k]==='boolean')||!['stack','raises','actions','maxPot'].every(k=>int(r[k]))||!Number.isSafeInteger(r.net)||r.raises>r.actions)throw Error('历史统计无效');
        if(h.rows.reduce((n,r)=>n+r.net,0)!==0)throw Error('历史筹码不守恒');
      }
      if(t.status==='complete'&&(!int(t.champion)||t.champion>3||t.final.filter(n=>n>0).length!==1||!t.final[t.champion]))throw Error('历史冠军无效');
    }
    if(l.current!==null&&!l.tables.some(t=>t.id===l.current))throw Error('历史当前对战无效');return l;
  }
  return {create,start,record,abandon,aggregate,overall,restore};
});


