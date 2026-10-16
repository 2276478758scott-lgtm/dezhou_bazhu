(()=>{'use strict';
 const $=id=>document.getElementById(id),root=$('home-screen');if(!root)return;
 const data=window.PokerHomeData,roles=data.roles,order=['neymar','maniac','professor',...roles.map(r=>r.id).filter(id=>!['neymar','maniac','professor'].includes(id))];
 let cursor=0,clock=null,ready=false,hovered=false,lastFocus=null;
 const shell=document.querySelector('.game-shell'),slots=[$('home-card-left'),$('home-card-center'),$('home-card-right')];
 $('home-background').src=data.background;
 // Reuse the table's existing chip artwork, without touching a game or a random stream.
 const chipSource=document.createElement('div');window.PokerTableUI.potChips(chipSource,1000,20);const chips=[...chipSource.querySelectorAll('svg')];for(let i=0;i<4;i++){const chip=document.createElement('span');chip.className='home-chip';chip.setAttribute('aria-hidden','true');const art=chips[[1,2,0,1][i]].cloneNode(true);for(const layer of [...art.children].slice(3))layer.remove();art.setAttribute('viewBox','0 22 46 34');chip.append(art);document.querySelector('.home-cards').append(chip);}
 const byId=id=>roles.find(r=>r.id===id);
 function scale(){const width=root.clientWidth||innerWidth,height=root.clientHeight||innerHeight;root.style.setProperty('--home-scale',Math.min(width/1672,height/941));}
 function stop(){clearTimeout(clock);clock=null;}
 function running(){return ready&&!root.hidden&&!document.hidden&&!hovered&&!document.querySelector('dialog[open]')&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&$('motion-mode').value!=='off';}
 function restartClock(){stop();if(running())clock=setTimeout(()=>{cursor=(cursor+1)%order.length;paint(true);restartClock();},6000);}
 function paint(animate=false){const indices=[(cursor+1)%order.length,cursor,(cursor+2)%order.length];slots.forEach((button,i)=>{const r=byId(order[indices[i]]),img=button.querySelector('img');button.dataset.role=r.id;button.setAttribute('aria-label',(i===1?'查看':'切换到')+r.name+'角色卡');img.alt=r.name+'角色卡';img.src=r.image;button.classList.remove('swapping');if(animate){void button.offsetWidth;button.classList.add('swapping');}});}
 function sync(){ready=!!window.PokerReady;const status=window.PokerView?.status?.();$('home-continue').disabled=!ready||!status?.started;for(const id of ['home-start','home-settings','home-info'])$(id).disabled=!ready;}
 function closeDialogs(){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();window.PokerPanels?.close();}
 function show(){lastFocus=document.activeElement;window.PokerView?.pause('main-menu');closeDialogs();root.hidden=false;document.body.classList.add('home-open');shell.inert=true;sync();scale();restartClock();$('home-continue').disabled?$('home-start').focus():$('home-continue').focus();}
 function enterTable(){stop();root.hidden=true;document.body.classList.remove('home-open');shell.inert=window.PokerTableUI.blocked();requestAnimationFrame(()=>{window.PokerTableUI.scheduleLayout();document.getElementById('home-open').focus();});}
 function fail(text){$('home-message').textContent=text;}
 function continueGame(){if(!ready)return;try{if(window.PokerTableUI.blocked())throw Error('横过来，就能继续这桌。');window.PokerView.resume();enterTable();fail('');}catch(e){fail(e.message);}}
 function openQuick(){stop();try{window.PokerView.prepareQuick();if(root.hidden)show();closeDialogs();$('quick-status').textContent='';$('quick-start').disabled=false;$('quick-setup-dialog').showModal();}catch(e){if(root.hidden)show();fail(e.message);}}
 function character(id){const r=byId(id);if(!r)return;stop();$('home-character-title').textContent=r.name;$('home-character-image').src=r.image;$('home-character-image').alt=r.name+'角色卡';$('home-character-intro').textContent=r.intro;$('home-character-story').textContent='虚构背景：'+r.story;$('home-character').showModal();}
 function info(){stop();$('home-info-dialog').showModal();}
 function gallery(){stop();const grid=$('home-gallery-grid');if(!grid.children.length)for(const r of roles){const b=document.createElement('button'),img=document.createElement('img');b.setAttribute('aria-label','查看'+r.name);img.src=r.image;img.alt=r.name;img.loading='lazy';b.append(img);b.onclick=()=>character(r.id);grid.append(b);}$('home-gallery').showModal();}
 slots.forEach((button,i)=>{button.onclick=()=>{if(i===1)character(button.dataset.role);else{cursor=order.indexOf(button.dataset.role);paint(true);restartClock();}};button.onpointerenter=()=>{hovered=true;stop();};button.onpointerleave=()=>{hovered=false;restartClock();};button.onfocus=stop;button.onblur=restartClock;});
 $('home-continue').onclick=continueGame;$('home-start').onclick=()=>{stop();window.PokerView.openLobby();};$('home-settings').onclick=()=>{stop();window.PokerPanels.open('settings');};$('home-info').onclick=info;$('home-open').onclick=show;
 $('home-info-characters').onclick=gallery;$('home-info-review').onclick=()=>{$('review-open')?.click();};$('home-info-summary').onclick=()=>{$('summary-open').click();};$('home-info-rules').onclick=()=>{$('rules').showModal();};
 for(const button of document.querySelectorAll('[data-home-close]'))button.onclick=()=>$(button.dataset.homeClose).close();
 $('quick-start').onclick=()=>{if(window.PokerTableUI.blocked()){$('quick-status').textContent='请横屏后开始对战。';return;}try{window.PokerView.startQuick();$('quick-setup-dialog').close();}catch(e){$('quick-status').textContent=e.message;}};
 // Move the existing form, preserving its IDs, values and controller bindings.
 $('quick-form-host').append($('setup'));
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('home-continue').disabled&&!document.querySelector('dialog[open]'))continueGame();});
 for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',restartClock);
 const observer=new MutationObserver(restartClock);observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else restartClock();});
 addEventListener('resize',scale);window.visualViewport?.addEventListener('resize',scale);
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',restartClock);$('motion-mode').addEventListener('change',restartClock);
 window.PokerHome={show,enterTable,openQuick,sync,isOpen:()=>!root.hidden,select:id=>{if(!order.includes(id))return;cursor=order.indexOf(id);paint(true);restartClock();},current:()=>order[cursor]};
 function onReady(){sync();scale();restartClock();}
 if(window.PokerReady)onReady();else addEventListener('poker-ready',onReady,{once:true});
 shell.inert=true;document.body.classList.add('home-open');scale();paint();sync();
})();
