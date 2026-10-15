(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PokerTableUI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 function formatAmount(value){const n=BigInt(value),abs=n<0n?-n:n,unit=abs>=100000000n?100000000n:abs>=10000n?10000n:1n;if(unit===1n)return n.toLocaleString('zh-CN');const h=abs*100n/unit;return (n<0n?'-':'')+(h/100n)+(h%100n?'.'+String(h%100n).padStart(2,'0').replace(/0+$/,''):'')+(unit===10000n?'万':'亿');}
 function chipModel(stack,total){if(stack<=0||total<=0)return [];const ratio=Math.min(1,stack/total),groups=ratio<=.05?1:ratio<=.15?2:ratio<=.3?3:4,height=Math.min(6,Math.ceil(ratio*18));return Array.from({length:groups},(_,i)=>({color:i%3,layers:Math.max(1,height-[0,2,4,5][i])}));}
 function potModel(amount,blind){if(amount<=0)return [];const level=Math.max(1,Math.ceil(Math.log2(1+amount/Math.max(1,blind)))),height=Math.min(6,level+1);return Array.from({length:Math.min(5,Math.ceil(level/2))},(_,i)=>({color:i%3,layers:Math.max(1,height-i)}));}
 function blocked(){return typeof window!=='undefined'&&(innerWidth<640||innerWidth<1000&&innerHeight>innerWidth);}
 // Keep card and plaque nodes alive across controller renders, including active animations.
 function reconcile(parent,next){
  if(!parent.childNodes||typeof parent.insertBefore!=='function'){parent.replaceChildren(...next);return;}
  const key=(n,i)=>n.nodeType===1?(n.id||n.getAttribute('data-view-key')||n.tagName+':'+(n.classList[0]||'')+':'+i):'#text:'+i;
  const previous=[...parent.childNodes],byKey=new Map(previous.map((n,i)=>[key(n,i),n])),kept=new Set();
  next.forEach((fresh,i)=>{let node=byKey.get(key(fresh,i));if(!node||node.nodeType!==fresh.nodeType||node.nodeName!==fresh.nodeName)node=fresh;
   else if(node!==fresh){
    if(node.nodeType===3){if(node.nodeValue!==fresh.nodeValue)node.nodeValue=fresh.nodeValue;}
    else if(!(node.tagName.toLowerCase()==='svg'&&node.outerHTML===fresh.outerHTML)){
     for(const a of [...node.attributes])if(a.name!=='data-motion-hidden'&&!fresh.hasAttribute(a.name))node.removeAttribute(a.name);
     for(const a of [...fresh.attributes])if(node.getAttribute(a.name)!==a.value)node.setAttribute(a.name,a.value);
     node.onclick=fresh.onclick;node.onkeydown=fresh.onkeydown;node.onerror=fresh.onerror;
     reconcile(node,[...fresh.childNodes]);
    }
   }
   kept.add(node);if(parent.childNodes[i]!==node)parent.insertBefore(node,parent.childNodes[i]||null);
  });
  for(const node of previous)if(!kept.has(node)&&node.parentNode===parent)node.remove();
 }
 function contribution(container,total,last){container.replaceChildren();for(const [label,value]of [['累计',total],['本次',last]]){const group=document.createElement('span');group.className='amount-group';const key=document.createElement('span');key.className='amount-label';key.textContent=label;const amount=document.createElement('span');amount.className='amount-value';amount.textContent=formatAmount(value);group.append(key,amount);container.append(group);}}
 function makePile(model,i,pot=false){
  const palette=[['#358bd7','#1a5893'],['#ef6b78','#a53e50'],['#edbd4c','#a97825']];
   const pile=document.createElement('span');pile.className='chip-pile chip-color-'+model.color;pile.style.setProperty('--pile-x',(pot?[0,1,-1,2,-1]:[0,1,-1,1])[i]+'px');pile.style.setProperty('--pile-y',(pot?[2,-1,3,0,4]:[0,7,-2,10])[i]+'px');
   const [face,side]=palette[model.color];let drawing='<ellipse cx="23" cy="51" rx="20" ry="3" fill="#003c742b"/>';
   for(let j=0;j<model.layers;j++){
    const y=38-j*3.5,angle=[8,-12,17,-5,11][i]+j*3;
    drawing+=`<path d="M5 ${y}h36v3.5a18 12.6 0 0 1-36 0Z" fill="${side}"/><g transform="translate(23 ${y}) scale(1 .7)"><circle r="18" fill="${face}" stroke="${side}" stroke-width="1"/><g transform="rotate(${angle})" fill="#fff5df">${Array.from({length:6},(_,k)=>`<rect x="-2.8" y="-17.5" width="5.6" height="6" rx=".6" transform="rotate(${k*60})"/>`).join('')}</g><circle r="10.8" fill="${face}" stroke="#fff5df" stroke-opacity=".72" stroke-width="1.2"/></g>`;
   }
   pile.innerHTML='<svg viewBox="0 0 46 56" aria-hidden="true" focusable="false">'+drawing+'</svg>';return pile;
 }
 function chips(seat,stack,total){
  const box=document.createElement('div');box.className='bankroll-chips';box.setAttribute('aria-hidden','true');box.title='剩余筹码示意，非按面额计数；精确金额见信息框';
  for(const [i,model]of chipModel(stack,total).entries())box.append(makePile(model,i));
  seat.append(box);
 }
 function potChips(box,amount,blind){if(!box||box.getAttribute('data-amount')===String(amount)&&box.getAttribute('data-blind')===String(blind))return;reconcile(box,potModel(amount,blind).map((m,i)=>makePile(m,i,true)));box.setAttribute('data-amount',String(amount));box.setAttribute('data-blind',String(blind));}
 let amountDialog,frame=0;
 function showAmounts(p){window.PokerView?.pause('amount-details');if(!amountDialog){amountDialog=document.createElement('dialog');amountDialog.id='amount-dialog';document.body.append(amountDialog);}amountDialog.replaceChildren();const h=document.createElement('h2');h.textContent=p.name+' · 筹码明细';amountDialog.append(h);for(const [label,value]of [['剩余筹码',p.stack],['本手累计投入',p.total],['本次投入',p.lastContribution||0]]){const row=document.createElement('p');row.className='exact-amount';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=BigInt(value).toLocaleString('zh-CN');row.append(a,b);amountDialog.append(row);}const close=document.createElement('button');close.className='primary';close.textContent='回到牌桌';close.onclick=()=>amountDialog.close();amountDialog.append(close);if(!amountDialog.open)amountDialog.showModal();}
 function fit(){frame=0;const status=document.getElementById('status');status?.classList.toggle('long-status',status.textContent.length>16);for(const info of document.querySelectorAll('.seat-info')){if(!info.clientWidth)continue;info.classList.remove('wide-amount');const amount=info.querySelector('.seat-stack');if(amount&&amount.scrollWidth>amount.clientWidth+1)info.classList.add('wide-amount');}for(const c of document.querySelectorAll('.seat-contribution')){const groups=[...c.children],sum=groups.reduce((s,g)=>s+g.getBoundingClientRect().width,0)+12;const need=sum>c.clientWidth;c.classList.toggle('stacked',need);}placeBubbles();}
 function placeBeside(node,seat,{bubble=false,extra=[]}={}){
  const stage=document.querySelector('.board-stage'),info=seat?.querySelector('.seat-info');if(!stage||!info||!node.offsetWidth)return false;
  const bounds=stage.getBoundingClientRect(),frame=info.getBoundingClientRect(),cards=seat.querySelector('.cards')?.getBoundingClientRect()||frame,w=node.offsetWidth,h=node.offsetHeight;
  const obstacles=[...document.querySelectorAll('.seat-info,.seat>.cards .card,.center,.table-header h1,.table-toolbar,.drink-table')].filter(e=>e.offsetWidth&&!e.hidden).map(e=>e.getBoundingClientRect());
  if(!bubble)for(const e of document.querySelectorAll('.speech-bubble:not([hidden]),.motion-action-tag,.motion-emotion'))if(e!==node&&e.offsetWidth)obstacles.push(e.getBoundingClientRect());
  obstacles.push(...extra);
  const belowCards=Math.max(frame.bottom-22,cards.bottom+7),above=[frame.left,frame.top-h-8],left=[frame.left-w-8,frame.top+5],right=[Math.max(frame.right,cards.right)+8,frame.top+5],below=[frame.left,frame.bottom+8];
  let candidates=seat.classList.contains('top')?[[frame.left+frame.width*.65,frame.top-h-8],left,right,above,below]:seat.classList.contains('bottom')?[left,right,above,below]:seat.classList.contains('right')?[[frame.left-w-8,belowCards],above,below,left,right]:[[frame.right+8,belowCards],above,below,left,right];
  candidates=candidates.concat([[frame.right-w,frame.top-h-8],[frame.right-w,frame.bottom+8],[bounds.left+8,frame.top-h-8],[bounds.right-w-8,frame.bottom+8]]);
  const intersects=(a,b)=>a.left<b.right+3&&a.right>b.left-3&&a.top<b.bottom+3&&a.bottom>b.top-3;
  for(const [cx,cy]of candidates){const x=Math.max(bounds.left+8,Math.min(bounds.right-w-8,cx)),y=Math.max(bounds.top+6,Math.min(bounds.bottom-h-6,cy)),rect={left:x,right:x+w,top:y,bottom:y+h};if(obstacles.some(b=>intersects(rect,b)))continue;
   const parent=bubble?seat.getBoundingClientRect():bounds;node.style.left=x-parent.left+'px';node.style.top=y-parent.top+'px';node.style.right='auto';node.style.bottom='auto';node.style.transform='none';
   if(bubble){const side=rect.bottom<=frame.top?'above':rect.top>=frame.bottom?'below':rect.right<=frame.left?'left':'right';node.setAttribute('data-tail',side);node.style.setProperty('--tail-x',Math.max(12,Math.min(w-12,frame.left+frame.width/2-x))+'px');node.style.setProperty('--tail-y',Math.max(10,Math.min(h-10,frame.top+frame.height/2-y))+'px');}
   return true;
  }
  return false;
 }
 function placeBubbles(){const placed=[];for(const bubble of document.querySelectorAll('.table .speech-bubble:not([hidden])')){
  const seat=bubble.closest('.seat');if(!seat)continue;bubble.classList.remove('bubble-above','speech-compact');bubble.style.removeProperty('width');bubble.title=bubble.textContent;
  let fits=placeBeside(bubble,seat,{bubble:true,extra:placed});
  if(!fits)for(const width of [110,94]){bubble.style.width=width+'px';if(placeBeside(bubble,seat,{bubble:true,extra:placed})){fits=true;break;}}
  if(!fits){bubble.classList.add('speech-compact');fits=placeBeside(bubble,seat,{bubble:true,extra:placed});}
  if(fits)placed.push(bubble.getBoundingClientRect());
 }}
 function scheduleLayout(){if(!frame&&typeof requestAnimationFrame==='function')frame=requestAnimationFrame(fit);}
 function drinkSvg(kind){const liquid=kind==='wine'?'#b84564':kind==='water'?'#a5e9ff':'#d99735';return '<svg viewBox="0 0 60 60" focusable="false"><circle cx="30" cy="30" r="27" fill="#0968b0" stroke="#a3e7ff" stroke-width="2"/><circle cx="30" cy="30" r="20" fill="'+liquid+'" stroke="#fff5df" stroke-width="2"/>'+(kind==='water'?'<circle cx="24" cy="22" r="3" fill="white"/><circle cx="37" cy="33" r="4" fill="white"/><circle cx="23" cy="39" r="2" fill="white"/>':'<rect x="18" y="20" width="13" height="13" rx="2" fill="#ffe8b7" transform="rotate(-15 24 26)"/><rect x="32" y="32" width="11" height="11" rx="2" fill="#ffe8b7" transform="rotate(15 37 37)"/>')+'</svg>';}
 function mount(){document.querySelector('.raise-row').insertBefore(document.querySelector('.presets'),document.getElementById('raise'));document.querySelector('[data-size=double]').addEventListener('click',()=>window.PokerPanels?.close());const select=document.getElementById('drink-select'),button=document.getElementById('drink-table'),icon=document.getElementById('drink-icon');try{const s=JSON.parse(localStorage.getItem('dezhou-bazhu-ui')||'{}');if(['whiskey','wine','water','none'].includes(s.drink))select.value=s.drink;}catch{}
 function paint(){button.hidden=select.value==='none';icon.innerHTML=drinkSvg(select.value);button.title={whiskey:'威士忌',wine:'红酒',water:'气泡水',none:'空桌面'}[select.value];}select.onchange=()=>{paint();try{localStorage.setItem('dezhou-bazhu-ui',JSON.stringify({drink:select.value}));}catch{}};paint();button.onclick=()=>{button.classList.remove('cheers');void button.offsetWidth;button.classList.add('cheers');let toast=document.getElementById('drink-toast');if(!toast){toast=document.createElement('span');toast.id='drink-toast';button.append(toast);}toast.textContent='敬这一手';clearTimeout(button.toastTimer);button.toastTimer=setTimeout(()=>{toast.textContent='';button.classList.remove('cheers');},1000);};
 addEventListener('resize',scheduleLayout);document.fonts?.ready.then(scheduleLayout);if(typeof ResizeObserver==='function'){const ro=new ResizeObserver(scheduleLayout);ro.observe(document.querySelector('.board-stage'));}scheduleLayout();}
 if(typeof document!=='undefined')addEventListener('poker-ready',mount,{once:true});
 return {formatAmount,chipModel,potModel,blocked,contribution,chips,potChips,showAmounts,scheduleLayout,reconcile,placeBubbles,placeBeside};
});
