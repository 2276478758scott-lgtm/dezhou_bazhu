(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerPortraits=a;})(globalThis,()=>{
'use strict';
const assets=Object.freeze({
  "maniac": "avatars/maniac.webp",
  "calculator": "avatars/calculator.webp",
  "gambler": "avatars/gambler.webp",
  "professor": "avatars/professor.webp",
  "trapper": "avatars/trapper.webp",
  "sniper": "avatars/sniper.webp",
  "rock": "avatars/rock.webp",
  "stealer": "avatars/stealer.webp",
  "catcher": "avatars/catcher.webp",
  "millionaire": "avatars/millionaire.webp",
  "chameleon": "avatars/chameleon.webp",
  "mirror": "avatars/mirror.webp",
  "comeback": "avatars/comeback.webp",
  "collector": "avatars/collector.webp",
  "neymar": "avatars/neymar.webp"
});
function forPlayer(player,seat,mode){return seat>0&&!mode?.enabled&&Object.hasOwn(assets,player?.profile)?assets[player.profile]:null;}
return {assets,forPlayer};
});
