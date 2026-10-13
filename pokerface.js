(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerFace=a;})(globalThis,()=>{
  'use strict';const nicknames=['小牌皇','赌神','河牌老六','摸鱼高手','牌桌阿强','今晚不睡','翻牌锦鲤','筹码搬运工','一手翻身','运气选手','南城牌友','底池钉子户'];
  function pick(pool,n,rng){const a=pool.slice();for(let i=a.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,n);}
  function configure(g,profiles,enabled){g.pokerface={enabled:!!enabled,revealed:false,aliases:enabled?['你',...pick(nicknames,3,g.rng)]:null};if(enabled){const chosen=pick(Object.keys(profiles),3,g.rng);g.players.forEach((p,i)=>{if(i)p.profile=chosen[i-1];});}hydrate(g,profiles);}
  function hydrate(g,profiles){if(!g.pokerface)g.pokerface={enabled:false,revealed:false,aliases:null};validate(g.pokerface);g.players.forEach((p,i)=>{if(i){p.roleName=profiles[p.profile]?.name||p.name;p.name=g.pokerface.enabled?g.pokerface.aliases[i]:p.roleName;}});}
  function reveal(g){if(!g.pokerface?.enabled||g.pokerface.revealed)return false;g.pokerface.revealed=true;return true;}
  function mappings(g,profiles){return g.pokerface?.enabled&&g.pokerface.revealed?g.players.slice(1).map(p=>`${p.name} → ${profiles[p.profile]?.name||'未知角色'}`):[];}
  function safe(text){return String(text).replace(/The Professor|教授|数学家|猎狐|狙击手|疯狗|赌徒|铁壁|掠夺者|英雄跟注者|超级大富豪|大富豪/gi,'牌友');}
  function validate(x){if(!x)return true;if(typeof x.enabled!=='boolean'||typeof x.revealed!=='boolean'||x.enabled&&(!Array.isArray(x.aliases)||x.aliases.length!==4||x.aliases[0]!=='你'||new Set(x.aliases).size!==4||x.aliases.slice(1).some(n=>!nicknames.includes(n))))throw Error('隐藏身份存档无效');return true;}
  return {nicknames,pick,configure,hydrate,reveal,mappings,safe,validate};
});
