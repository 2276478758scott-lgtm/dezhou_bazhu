(()=>{'use strict';const state=document.getElementById('offline-state'),button=document.getElementById('update-app');
  if(location.protocol==='file:'){state.textContent='独立文件可玩；安装 PWA 需要首次用 HTTPS 打开发布包';return;}
  if(!('serviceWorker'in navigator)){state.textContent='此浏览器无法安装离线资源';return;}
  let waiting=null,reloading=false,requestedUpdate=false;
  navigator.serviceWorker.register('sw.js').then(reg=>{const offer=()=>{if(reg.waiting){waiting=reg.waiting;button.hidden=false;state.textContent='离线新版本已准备，结束本手后更新';}};offer();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker.addEventListener('statechange',()=>{if(worker.state==='installed')offer();});});
    return navigator.serviceWorker.ready;
  }).then(()=>{state.textContent='离线资源已缓存 · Safari 分享菜单可添加到主屏幕';}).catch(()=>{state.textContent='离线缓存未完成，当前可在线游戏';});
  button.onclick=()=>{const status=window.PokerView?.status?.(),between=status?['idle','complete'].includes(status.phase):!document.getElementById('next').disabled;if(between&&waiting){requestedUpdate=true;waiting.postMessage('activate');}else state.textContent='请先结束当前一手，再更新';};
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedUpdate&&!reloading){reloading=true;location.reload();}});
})();
