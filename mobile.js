(()=>{'use strict';const $=id=>document.getElementById(id),media=matchMedia('(max-width:800px), (max-width:950px) and (max-height:500px)');
  const dialog=$('mobile-panel'),content=$('mobile-panel-body');let current=null;
  const sections={settings:[$('setup'),$('install-status')],chat:[$('chat-panel')],helper:[$('helper-panel')]};const markers=new Map();
  for(const elements of Object.values(sections))for(const element of elements){const marker=document.createComment('panel placeholder');element.before(marker);markers.set(element,marker);}
  function restore(){for(const [element,marker] of markers)marker.after(element);current=null;}
  function close(){if(dialog.open)dialog.close();restore();}
  function open(kind){close();current=kind;$('mobile-panel-title').textContent={settings:'对手设置与离线状态',chat:'聊天与结果',helper:'本地策略提示'}[kind];$('mobile-start').textContent=kind==='settings'&&!$('setup').hidden?'开始对战':'回到牌桌';sections[kind].forEach(element=>content.append(element));dialog.showModal();}
  for(const kind of Object.keys(sections))$('mobile-'+kind).onclick=()=>open(kind);
  $('mobile-panel-close').onclick=close;dialog.addEventListener('cancel',close);dialog.addEventListener('close',()=>{if(!dialog.open)restore();});media.addEventListener('change',close);
  $('mobile-start').onclick=()=>{const start=current==='settings'&&!$('setup').hidden;close();if(start)$('next').click();};
  function ready(){if(media.matches&&!$('setup').hidden)open('settings');}
  if(window.PokerReady)ready();else window.addEventListener('poker-ready',ready,{once:true});
})();
