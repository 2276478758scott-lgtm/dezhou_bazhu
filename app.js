/* Browser controller: the engine remains the only source of legal actions. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),P=window.Poker,A=window.PokerAI,E=window.PokerExperience;
  const phaseNames={idle:'准备开局',preflop:'翻牌前',flop:'翻牌',turn:'转牌',river:'河牌',complete:'本手结束'};
  const S=window.PokerState,M=window.PokerEmotion,L=window.PokerLanguage,H=window.PokerChallenge;
  let response=null,responseTimer=null;
  function clearResponse(){clearTimeout(responseTimer);response=null;}
  let game=S?S.create():new P.Game(),epoch=0,timer=null,busy=false,paused=false,stage='',displaySeat=null,selectedResult=null,resultShown=0;
  let pendingJob=null,deadline=0,remaining=0,logCursor=0,unread=0,revealedHand=0;
  const conversation=[],lastSpeech={};
  const speechMemory={};let saveError='',restored=false;
  let storage=null;try{storage=window.localStorage;}catch{saveError='本浏览器禁止存储，游戏可继续，但刷新后不能恢复。';}
  const coach=window.PokerCoach.mount();
  function hydratePlayers(){game.players.forEach((p,i)=>{if(i&&A.PROFILES?.[p.profile])p.name=A.PROFILES[p.profile].name;if(M&&!p.emotion)p.emotion=M.initial();});}
  hydratePlayers();
  for(let i=1;i<4;i++){const select=$('ai-'+i);if(A.PROFILES){select.replaceChildren();for(const [value,profile] of Object.entries(A.PROFILES)){const option=document.createElement('option');option.value=value;option.textContent=profile.name;select.append(option);}select.value=['','maniac','calculator','gambler'][i];}$('chips-'+i).value=1500;}
  function persist(){if(!S)return;if(!storage){$('save-state').textContent=saveError||'本浏览器无法保存，刷新后不能恢复。';return;}try{S.save(storage,game,{conversation,lastSpeech,speechMemory,pace:$('pace').value,difficulty:$('difficulty').value,resultShown});saveError='';}catch{saveError='自动保存失败：存储不可用或空间不足，请保持页面打开。';}$('save-state').textContent=saveError||'进度已自动保存于本机';}
  function appendMessage(text,kind='action',speaker=null) {
    const list=$('history'),follow=list.scrollHeight-list.scrollTop-list.clientHeight<45;
    const entry={text,kind,speaker,hand:game.hand};conversation.push(entry);
    const li=document.createElement('li');li.className='message '+kind;
    const stamp=document.createElement('span');stamp.className='message-stamp';stamp.textContent=`第 ${game.hand} 手`;
    const body=document.createElement('div');body.textContent=speaker?`${speaker}：「${text}」`:text;
    li.append(stamp,body);list.append(li);
    if(follow){list.scrollTop=list.scrollHeight;unread=0;}else unread++;
    $('latest').hidden=follow;$('latest').textContent=unread?`新消息 ${unread} · 回到最新`:'回到最新消息';
  }
  function syncLog(speech=null) {
    const lines=game.log.slice(logCursor);logCursor=game.log.length;
    if(speech&&lines.length){appendMessage(lines.shift());appendMessage(speech.text,'chat',speech.name);}
    for(const line of lines)appendMessage(line,/^(第 |翻牌：|转牌：|河牌：|底池 |退回)/.test(line)?'system':'action');
  }
  function queue(fn,delay) {
    clearTimeout(timer);pendingJob=fn;remaining=delay;deadline=Date.now()+delay;
    if(!paused)timer=setTimeout(()=>{pendingJob=null;fn();},delay);
  }
  function card(c,hidden=false) {
    const e=document.createElement('span');e.className='card';
    if(hidden){e.classList.add('back');e.textContent='◆';e.setAttribute('aria-label','未公开底牌');}
    else if(c===undefined){e.classList.add('empty');e.setAttribute('aria-label','待发公共牌');}
    else {if([1,2].includes(P.suit(c)))e.classList.add('red');e.textContent=P.cardText(c);e.setAttribute('aria-label',P.cardText(c));if(game.phase==='complete'&&game.result.hands?.[selectedResult]?.bestFive.includes(c))e.classList.add('best');}
    return e;
  }
  function render() {
    const complete=game.phase==='complete',started=game.phase!=='idle';
    $('hand-info').textContent=`第 ${game.hand} 手 · ${phaseNames[game.phase]}`;
    $('difficulty').disabled=started&&!complete;
    for(let i=1;i<4;i++){$('ai-'+i).disabled=started;$('chips-'+i).disabled=started;}
    $('setup').hidden=started;
    const displayedPot=complete?game.result.pots.filter(p=>!p.refund).reduce((s,p)=>s+p.amount,0):game.pot();
    $('pot').textContent=(complete?'本手底池 ':'底池 ')+displayedPot.toLocaleString();
    $('street').textContent=`${phaseNames[game.phase]} · 盲注 10 / 20`;
    $('board').replaceChildren(...Array.from({length:5},(_,i)=>card(game.board?.[i])));
    const speaking=stage==='reading'?{seat:displaySeat,text:lastSpeech[displaySeat]}:response;
    $('top-speech').hidden=!(speaking?.seat===2);$('top-speech').textContent=speaking?.seat===2?speaking.text:'';
    game.players.forEach((p,i)=>{
      const seat=$('seat-'+i);seat.className=seat.className.replace(/\s(active|folded|showdown)/g,'');
      if(complete&&game.result.hands?.[i])seat.classList.add('showdown');
      if((busy?displaySeat:game.actor)===i)seat.classList.add('active');if(p.folded&&started&&!complete)seat.classList.add('folded');
      seat.replaceChildren();
      const name=document.createElement('div');name.className='seat-name';name.textContent=p.name;
      for(const [condition,label] of [[i===game.dealer,'D'],[i===game.sbSeat,'SB'],[i===game.bbSeat,'BB']])if(condition&&started){const b=document.createElement('span');b.className='badge';b.textContent=label;name.append(b);}
      const stack=document.createElement('div');stack.className='seat-stack';stack.textContent=p.stack.toLocaleString();
      const cards=document.createElement('div');cards.className='cards';
      const reveal=i===0||(complete&&game.result.kind==='showdown'&&!p.folded);
      for(const c of p.hole)cards.append(card(c,!reveal));
      const meta=document.createElement('div');meta.className='seat-meta';
      meta.textContent=!p.hole.length&&p.stack===0?'已淘汰':p.folded&&started?'已弃牌':complete?(game.result.awards[i]?`收回 ${game.result.awards[i]}`:'未获底池'):p.stack===0&&started?'已全下':p.bet?`本轮投入 ${p.bet}`:i>0?['','强势施压','狡猾设局','谨慎反击'][i]:'你的底牌';
      const contribution=document.createElement('div');contribution.className='seat-contribution';
      contribution.setAttribute('data-total',p.total.toLocaleString());contribution.setAttribute('data-last',(p.lastContribution||0).toLocaleString());
      const total=document.createElement('div');total.textContent=`本手累计投入 ${p.total.toLocaleString()}`;
      const current=document.createElement('div');current.textContent=`本次投入 ${(p.lastContribution||0).toLocaleString()}`;
      contribution.append(total,current);seat.append(name,stack,contribution,cards,meta);
      if(i&&M){const mood=document.createElement('div');mood.className='seat-mood';mood.textContent=M.label(p.emotion,p.profile);seat.append(mood);}
      if(complete&&game.result.hands?.[i]){const show=document.createElement('button');show.className='best-select compact';show.textContent=P.NAMES[game.result.scores[i][0]]+' · 看最佳牌';show.onclick=()=>{selectedResult=i;render();};seat.append(show);}
      if(i!==2&&speaking?.seat===i&&speaking.text){
        const bubble=document.createElement('div');bubble.className='speech-bubble';bubble.setAttribute('role','status');bubble.textContent=speaking.text;seat.append(bubble);
      }
    });
    const l=game.actor===0&&!busy&&!paused?game.legal():null;
    $('challenge-open').disabled=!l||!H?.available(game)||!game.players.some((p,i)=>i&&!p.folded&&p.stack>0&&p.hole.length===2);
    $('fold').disabled=!l;$('call').disabled=!l;
    $('call').textContent=l?(l.check?'过牌':l.callAmount===game.players[0].stack?`全下跟注 ${l.callAmount}`:`跟注 ${l.callAmount}`):'过牌 / 跟注';
    $('raise').disabled=!l?.raise;$('raise-to').disabled=!l?.raise;
    $('raise').textContent=game.currentBet===0?'下注':'加注';
    const canAllin=l&&(l.raise||l.call&&game.players[0].stack<=l.toCall);
    $('allin').disabled=!canAllin;
    document.querySelectorAll('[data-size]').forEach(b=>b.disabled=!l?.raise);
    if(l?.raise) {
      $('raise-to').min=l.minRaiseTo;$('raise-to').max=l.maxRaiseTo;
      $('raise-to').value=l.minRaiseTo;
      $('limits').textContent=`本轮总额 ${l.minRaiseTo}–${l.maxRaiseTo}；需跟注 ${l.toCall}。${l.maxRaiseTo<l.fullRaiseTo?'只能不足额全下。':''}`;
    } else $('limits').textContent=l?.call&&!l.raise?'当前可跟注或弃牌；加注权未开放，或没有可继续下注的对手。':'加注金额包含你本轮已投入的筹码。';
    const alive=game.players.filter(p=>p.stack>0);
    $('next').disabled=busy||paused||started&&!complete||complete&&alive.length<2;
    $('next').textContent=!started?'开始对战':alive.length<2?'对战结束':game.players[0].stack===0?'下一手 · 观战':'下一手';
    $('status').textContent=paused?'牌桌已暂停，可以慢慢翻阅聊天记录。':stage==='revealing'?(game.result.kind==='showdown'?'本手摊牌：仍有资格争夺底池的玩家亮牌。':'其他人全部弃牌，本手无需公开赢家底牌。'):stage==='reading'?`${game.players[displaySeat].name}已行动 · 留一点时间读台词…`:!started?'为三个对手选择性格和筹码，再开始对战。':complete?(alive.length===1?`${alive[0].name}赢下整张桌子！`:game.players[0].stack===0?'你已被淘汰，可以继续观战或重新开局。':'本手结算完成，点击下一手继续。'):game.actor===0?'轮到你：跟、反加，还是放手？':`${game.players[game.actor].name}正在思考…`;
    $('balance').textContent=`总筹码 ${(game.players.reduce((s,p)=>s+p.stack,0)+(complete?0:game.pot())).toLocaleString()}`;
    $('readout').textContent=E.styleText[A.modelOpponent(game.players[0]).style];
    $('pause').disabled=!started||complete&&!busy&&!paused;$('pause').textContent=paused?'继续':'暂停';
    coach.setTurn(l?A.observe(game,0,$('difficulty').value):null);
    $('result').hidden=!complete;
    if(complete) {
      const box=$('result');box.replaceChildren();
      for(const [i,score] of Object.entries(game.result.scores)){const p=document.createElement('p');p.textContent=`${game.players[i].name}：${P.NAMES[score[0]]}`;box.append(p);}
      game.result.pots.forEach((pot,k)=>{const p=document.createElement('p');p.textContent=`${pot.refund?'退回':k===0?'主池':'边池'} ${pot.amount} → ${pot.winners.map(i=>game.players[i].name).join(' / ')}`;box.append(p);});
      for(const [i,p] of game.players.entries()){const row=document.createElement('p');row.textContent=`${p.name}：净变化 ${(game.result.net?.[i]||0)>=0?'+':''}${game.result.net?.[i]||0}`;box.append(row);}
    }
  }
  function resultDialog(){
    if(resultShown===game.hand)return;resultShown=game.hand;const box=$('hand-result-body');box.replaceChildren();
    const alive=game.players.filter(p=>p.stack>0);$('hand-result-title').textContent=game.players[0].stack===0?'你已被淘汰':alive.length===1?'胜利！你拿下了整桌':(game.result.net[0]>0?'本手获利':game.result.net[0]<0?'本手失利':'本手持平');
    for(const [i,detail] of Object.entries(game.result.hands||{})){const row=document.createElement('div'),name=document.createElement('p'),hole=document.createElement('div'),cards=document.createElement('div');name.textContent=`${game.players[i].name}：${P.NAMES[detail.score[0]]} · 底牌 / 最佳五张`;hole.className='cards revealed-hole';game.players[i].hole.forEach(c=>hole.append(card(c)));cards.className='cards';detail.bestFive.forEach(c=>cards.append(card(c)));row.append(name,hole,cards);box.append(row);}
    game.result.pots.forEach((pot,k)=>{const row=document.createElement('p');row.textContent=`${pot.refund?'超额退还':k===0?'主池':'边池'} ${pot.amount} → ${pot.winners.map(i=>game.players[i].name).join(' / ')}`;box.append(row);});
    game.players.forEach((p,i)=>{const row=document.createElement('p');row.textContent=`${p.name}：${game.result.net[i]>=0?'+':''}${game.result.net[i]}，剩余 ${p.stack}`;box.append(row);});
    if(game.result.kind==='fold'){const row=document.createElement('p');row.textContent='本手由其他玩家弃牌结束，不公开赢家底牌。';box.append(row);}
    if($('hand-result').showModal&&!$('hand-result').open)$('hand-result').showModal();persist();
  }
  function commit(seat,move){game.act(seat,move.type,move.target);if(Number.isFinite(move.eq))game.players[seat].expectedEquity=move.eq;if(M){const event=game.history[game.history.length-1];game.players.forEach((p,i)=>M.action(p.emotion,event,game.history.length,p.stack,game.bb,{profile:p.profile,seat:i,playing:p.hole.length===2,folded:p.folded}));if(game.phase==='complete')game.players.forEach((p,i)=>M.finish(p.emotion,p.profile,game.hand,game.result.net[i],game.handStart[i],p.expectedEquity||.5));}persist();}
  function schedule() {
    if(game.phase==='complete'&&revealedHand!==game.hand){
      revealedHand=game.hand;const token=epoch;busy=true;stage='revealing';displaySeat=null;
      if(M)game.players.forEach((p,i)=>M.finish(p.emotion,p.profile,game.hand,game.result.net[i],game.handStart[i],p.expectedEquity||.5));
      selectedResult=Object.keys(game.result.hands||{})[0]??null;
      appendMessage(game.result.kind==='showdown'?'本手摊牌 · '+game.players.filter(p=>p.hole.length&&!p.folded).map(p=>`${p.name}：${p.hole.map(P.cardText).join(' ')}`).join('；'):'本手独赢 · 不公开底牌','system');
      if(L)game.players.forEach((p,i)=>{if(i&&p.hole.length){const event=p.stack===0?'bust':game.result.net[i]>0?'win':game.result.net[i]<0?'lose':'tie',text=L.choose(p.profile,event,{emotion:p.emotion},speechMemory[i]||[],game.rng);appendMessage(text,'chat',p.name);(speechMemory[i]||= []).push(text);}});
      persist();render();queue(()=>{if(token!==epoch)return;busy=false;stage='';render();resultDialog();},3000);return;
    }
    if(game.actor===null||game.actor===0){busy=false;stage='';displaySeat=null;render();return;}
    const token=epoch,seat=game.actor;busy=true;stage='thinking';displaySeat=seat;render();
    queue(()=>{
      if(token!==epoch)return;
      try {
        const view=A.observe(game,seat,$('difficulty').value);
        const apply=move=>{if(token!==epoch)return;if(paused){queue(()=>apply(move),0);return;}
          const event=move.target===view.legal.maxRaiseTo&&move.type==='raise'?'allin':move.type==='raise'?move.reason==='steal'?'steal':move.reason==='value'?'value':'raise':move.type;
          const text=L?L.choose(game.players[seat].profile,event,{emotion:game.players[seat].emotion,model:A.modelOpponent(view.seats[0]),targetPresent:!view.seats[0].folded&&view.seats[0].playing},speechMemory[seat]||[],game.rng):E.speech(seat,move.type,A.modelOpponent(view.seats[0]),lastSpeech[seat],Math.random,!view.seats[0].folded&&view.seats[0].playing);
          lastSpeech[seat]=text;(speechMemory[seat]||=[]).push(text);speechMemory[seat]=speechMemory[seat].slice(-8);
          commit(seat,move);syncLog({text,name:game.players[seat].name});$('talk').textContent=`${game.players[seat].name}：「${text}」`;stage='reading';persist();render();
          queue(()=>{if(token!==epoch)return;stage='';busy=false;schedule();},Math.max(3000,E.timing($('pace').value,move.type,text).hold));
        };
        if(window.PokerCompute&&typeof Worker!=='undefined')window.PokerCompute.run(view,Math.floor(game.rng()*4294967296)).then(result=>apply(result.move)).catch(error=>{if(token!==epoch)return;console.warn('AI task:',error);appendMessage('本地计算未完成，本次采用安全操作。','system');apply({type:view.legal.check?'check':'fold'});});
        else apply(A.decide(view,game.rng));
      }catch(e){busy=false;stage='';render();$('status').textContent='牌局异常：'+e.message+'。请重新开局。';console.error(e);}
    },E.timing($('pace').value,'think').think);
  }
  function action(type,target) {
    if(game.actor!==0||busy||paused)return;
    try {commit(0,{type,target});syncLog();persist();render();schedule();}
    catch(e){$('status').textContent=e.message;}
  }
  $('fold').onclick=()=>action('fold');
  $('challenge-open').onclick=()=>{
    if(busy||paused||!H?.available(game))return;
    const select=$('challenge-target'),previous=select.value;select.replaceChildren();
    game.players.forEach((p,i)=>{if(i&&!p.folded&&p.stack>0&&p.hole.length===2){const o=document.createElement('option');o.value=i;o.textContent=p.name;select.append(o);}});
    if([...select.options].some(o=>o.value===previous))select.value=previous;
    const used=game.challenges?.hand===game.hand?game.challenges.used:0;
    $('challenge-state').textContent=`本手还可喊 ${2-used} 次，每次出牌机会一次。喊话不花筹码，也不代替出牌。`;
    $('challenge-dialog').showModal?.();
  };
  if(H)H.presets.forEach(text=>{const b=document.createElement('button');b.className='quiet';b.textContent=text;b.onclick=()=>{$('challenge-text').value=text;};$('challenge-presets').append(b);});
  $('challenge-close').onclick=()=>$('challenge-dialog').close?.();
  $('challenge-send').onclick=()=>{
    if(busy||paused){$('challenge-state').textContent='请等轮到你再发话。';return;}
    try{
      const target=Number($('challenge-target').value),sent=H.send(game,target,$('challenge-text').value,speechMemory[target]||[]),p=game.players[target];
      appendMessage(sent.text,'chat',`你 → ${p.name}`);appendMessage(sent.reply,'chat',p.name);
      lastSpeech[target]=sent.reply;(speechMemory[target]||=[]).push(sent.reply);speechMemory[target]=speechMemory[target].slice(-8);
      clearResponse();response={seat:target,text:sent.reply};responseTimer=setTimeout(()=>{response=null;render();},4500);
      $('talk').textContent=`${p.name}：「${sent.reply}」`;$('challenge-dialog').close?.();persist();render();
    }catch(e){$('challenge-state').textContent=e.message;}
  };
  $('call').onclick=()=>action(game.legal()?.check?'check':'call');
  $('raise').onclick=()=>action('raise',Number($('raise-to').value));
  $('raise-to').onkeydown=e=>{if(e.key==='Enter')$('raise').click();};
  $('allin').onclick=()=>{const l=game.legal();if(l)action(l.raise?'raise':'call',l.maxRaiseTo);};
  document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{
    const l=game.legal();if(!l?.raise)return;
    const mult={half:0.5,pot:1,double:2}[b.dataset.size];
    const target=b.dataset.size==='min'?l.minRaiseTo:game.currentBet+Math.round((game.pot()+l.toCall)*mult);
    $('raise-to').value=Math.max(l.minRaiseTo,Math.min(l.maxRaiseTo,target));
  });
  $('next').onclick=()=>{if(busy||paused)return;try{if(game.phase==='idle'){
    const stacks=[1500,...[1,2,3].map(i=>Number($('chips-'+i).value||1500))];if(stacks.some(n=>!Number.isInteger(n)||n<1||n>1000000))throw new Error('初始筹码须为 1–1,000,000 的整数');
    const profiles=['human',...[1,2,3].map(i=>$('ai-'+i).value||['','maniac','calculator','gambler'][i])];if(A.PROFILES&&profiles.slice(1).some(id=>!A.PROFILES[id]))throw new Error('请选择有效的对手');
    game=S?S.create({stacks,profiles},Date.now()):new P.Game({stacks,profiles});hydratePlayers();
  }clearResponse();$('challenge-dialog').close?.();selectedResult=null;game.startHand();game.players.forEach(p=>{if(p.emotion)M.begin(p.emotion);});logCursor=0;syncLog();if(game.hand===1&&L)game.players.forEach((p,i)=>{if(i)appendMessage(L.choose(p.profile,'open',{},[],game.rng),'chat',p.name);});persist();render();schedule();}catch(e){$('status').textContent=e.message;}};
  $('restart').onclick=()=>{if(game.phase!=='idle'&&!confirm('重新开始四人对战？筹码、聊天记录与对手记忆将重置。'))return;epoch++;clearResponse();$('challenge-dialog').close?.();clearTimeout(timer);window.PokerCompute?.cancel();pendingJob=null;busy=false;paused=false;stage='';displaySeat=null;logCursor=0;unread=0;revealedHand=0;resultShown=0;selectedResult=null;conversation.length=0;for(const key of Object.keys(lastSpeech))delete lastSpeech[key];for(const key of Object.keys(speechMemory))delete speechMemory[key];$('history').replaceChildren();$('latest').hidden=true;game=S?S.create():new P.Game();hydratePlayers();$('talk').textContent='新的一桌，重新选择对手与筹码。';$('hand-result').close?.();coach.setTurn(null);persist();render();};
  $('pause').onclick=()=>{
    if(!paused){paused=true;if(pendingJob){remaining=Math.max(0,deadline-Date.now());clearTimeout(timer);}}
    else {paused=false;if(pendingJob){const job=pendingJob;queue(job,remaining);}else if(restored){restored=false;schedule();}}
    render();
  };
  $('latest').onclick=()=>{$('history').scrollTop=$('history').scrollHeight;unread=0;$('latest').hidden=true;};
  $('history').onscroll=()=>{const list=$('history'),bottom=list.scrollHeight-list.scrollTop-list.clientHeight<45;$('latest').hidden=bottom;if(bottom)unread=0;};
  $('help').onclick=()=>$('rules').showModal();
  $('result-close').onclick=()=>$('hand-result').close?.();$('view-result').onclick=()=>{if(game.phase==='complete'){resultShown=0;resultDialog();}};
  if(S&&storage){try{const saved=S.load(storage);if(saved&&saved.game.phase!=='idle'){
    game=saved.game;hydratePlayers();paused=true;restored=true;logCursor=game.log.length;
    $('pace').value=saved.extras.pace||'standard';$('difficulty').value=saved.extras.difficulty||'pressure';
    Object.assign(lastSpeech,saved.extras.lastSpeech||{});Object.assign(speechMemory,saved.extras.speechMemory||{});resultShown=0;
    for(const entry of saved.extras.conversation||[]){const hand=game.hand;game.hand=entry.hand;appendMessage(entry.text,entry.kind,entry.speaker);game.hand=hand;}
    if(game.phase==='complete'){revealedHand=game.hand;resultDialog();}
    $('save-state').textContent='已恢复本机存档，点击继续。';
  }}catch{$('save-state').textContent='存档损坏或版本不兼容，未覆盖旧存档；开始新对战会替换存档。';}}
  if(saveError)$('save-state').textContent=saveError;
  render();
})();
