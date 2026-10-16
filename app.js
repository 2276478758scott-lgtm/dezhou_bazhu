/* Browser controller: the engine remains the only source of legal actions. */
(async()=>{
  'use strict';window.PokerReady=false;
  const $=id=>document.getElementById(id),P=window.Poker,A=window.PokerAI,E=window.PokerExperience;
  const phaseNames={idle:'准备开局',preflop:'翻牌前',flop:'翻牌',turn:'转牌',river:'河牌',complete:'本手结束'};
  const S=window.PokerState,M=window.PokerEmotion,L=window.PokerLanguage,H=window.PokerChallenge,U=window.PokerSummary,F=window.PokerFace;
  const V=window.PokerTableUI,amount=n=>V?V.formatAmount(n):n.toLocaleString();
  const controls=window.PokerControls,draft=controls?.createDraft();
  const audio=window.PokerAudio?.mount(),audioCursor=window.PokerAudio?.createCursor();let audioSerial=0,soundedResult=null;
  function sound(cue){try{audio?.play(cue.kind,cue);}catch{}}
  const FX=window.PokerMotion?.mount({formatAmount:amount,onCue:sound});
  const C=window.PokerCareer;let career=C?C.create():null,archiveCarry=[];let ledger=U?U.create():null;
  let response=null,responseTimer=null;
  function clearResponse(){clearTimeout(responseTimer);response=null;}
  let game=S?S.create():new P.Game(),epoch=0,timer=null,busy=false,paused=false,stage='',displaySeat=null,selectedResult=null,resultShown=0;
  let pendingJob=null,deadline=0,remaining=0,logCursor=0,unread=0,revealedHand=0;
  const K=window.PokerKernel;let decisionSeed=null,recording=true;const conversation=[],lastSpeech={};
  const speechMemory={};let saveError='',restored=false;
  let storage=null;try{storage=window.localStorage;}catch{saveError='本浏览器禁止存储，游戏可继续，但刷新后不能恢复。';}
  let database=null;try{database=window.indexedDB;}catch{}
  const repository=window.PokerArchive?new window.PokerArchive.Repository({storage,indexedDB:database,onStatus:text=>{saveError=text;$('save-state').textContent=text;}}):null;
  let initializing=!!repository;
  window.PokerAnalysisSeed=()=>{const n=Math.floor((game.random?.analysis||Math.random)()*4294967296);persist();return n;};
  // Read-only archive access for the upcoming replay and graph interfaces.
  window.PokerRecords={events:(options={})=>repository?repository.events(options.tableId,options):Promise.resolve([])};
  const coach=window.PokerCoach.mount();
  function hydratePlayers(){game.players.forEach((p,i)=>{if(i&&A.PROFILES?.[p.profile]&&!game.pokerface?.enabled)p.name=A.PROFILES[p.profile].name;if(M)p.emotion={...M.initial(),...p.emotion};p.aiMemory||={reads:{}};});}
  if(F)F.hydrate(game,A.PROFILES);hydratePlayers();
  for(let i=1;i<4;i++){const select=$('ai-'+i);if(A.PROFILES){select.replaceChildren();for(const [value,profile] of Object.entries(A.PROFILES)){const option=document.createElement('option');option.value=value;option.textContent=profile.name;select.append(option);}select.value=['','maniac','calculator','gambler'][i];}$('chips-'+i).value=1500;}
  function safeSpeech(text){return game.pokerface?.enabled&&!game.pokerface.revealed&&F?F.safe(text):text;}
  function syncMode(){const hidden=$('pokerface').checked;for(let i=1;i<4;i++)$('ai-'+i).hidden=hidden;}
  $('pokerface').onchange=syncMode;
  function persist(updateLedger=true){if(initializing)return;if(C&&game.match)C.process(career,game);if(U&&updateLedger){U.start(ledger,game);U.record(ledger,game);}if(!S)return;
    const extras={career,conversation,lastSpeech,speechMemory,ledger,pace:$('pace').value,difficulty:$('difficulty').value,resultShown,decisionSeed};
    if(repository){repository.save(game,extras,{additionalEvents:archiveCarry}).catch(()=>{});archiveCarry=[];$('save-state').textContent=repository.warning||'进度已自动保存于本机';return;}
    if(!storage){$('save-state').textContent=saveError||'本浏览器无法保存，刷新后不能恢复。';return;}
    try{S.save(storage,game,extras);saveError='';}catch{saveError='自动保存失败：存储不可用或空间不足，请保持页面打开。';}$('save-state').textContent=saveError||'进度已自动保存于本机';}
  function appendMessage(text,kind='action',speaker=null) {
    const list=$('history'),follow=list.scrollHeight-list.scrollTop-list.clientHeight<45;
    const entry={text,kind,speaker,hand:game.hand};conversation.push(entry);
    if(recording&&kind==='chat'&&text)K?.emit(game,'speech',{text,speaker,seat:speaker?.startsWith('你 → ')?0:game.players.findIndex(p=>p.name===speaker)},{responseSerial:game.players.find(p=>p.name===speaker)?.emotion?.reactionSerial??0});
    const li=document.createElement('li');li.className='message '+kind;
    const stamp=document.createElement('span');stamp.className='message-stamp';stamp.textContent=`第 ${game.hand} 手`;
    const body=document.createElement('div');body.textContent=speaker?`${speaker}：「${text}」`:text;
    li.append(stamp,body);list.append(li);
    if(follow){list.scrollTop=list.scrollHeight;unread=0;}else unread++;
    $('latest').hidden=follow;$('latest').textContent=unread?`新消息 ${unread} · 回到最新`:'回到最新消息';
  }
  function syncLog(speech=null) {
    const lines=game.log.slice(logCursor);logCursor=game.log.length;
    if(speech&&lines.length){appendMessage(lines.shift());if(speech.text)appendMessage(speech.text,'chat',speech.name);}
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
    else {if([1,2].includes(P.suit(c)))e.classList.add('red');const face=P.cardText(c),rank=document.createElement('span'),suit=document.createElement('span');rank.className='card-rank';suit.className='card-suit';rank.textContent=face.slice(0,-1);suit.textContent=face.slice(-1);e.append(rank,suit);e.setAttribute('aria-label',face);if(game.phase==='complete'&&game.result.hands?.[selectedResult]?.bestFive.includes(c))e.classList.add('best');}
    return e;
  }
  function render() {
    const complete=game.phase==='complete',started=game.phase!=='idle';
    try{audio?.setTableActive(started&&!paused&&!document.hidden);}catch{}
    $('hand-info').textContent=`第 ${game.hand} 手 · ${phaseNames[game.phase]}${game.match?' · '+game.match.name:''}`;
    $('difficulty').disabled=started&&!complete;
    for(let i=1;i<4;i++){$('ai-'+i).disabled=started;$('chips-'+i).disabled=started;}
    $('setup').hidden=started;$('pokerface').disabled=started;
    const displayedPot=complete?game.result.pots.filter(p=>!p.refund).reduce((s,p)=>s+p.amount,0):game.pot();
    $('pot').textContent=(complete?'本手底池 ':'底池 ')+amount(displayedPot);
    $('street').textContent=`${phaseNames[game.phase]} · 盲注 ${amount(game.sb)} / ${amount(game.bb)}`;
    V.reconcile($('board'),Array.from({length:5},(_,i)=>card(game.board?.[i])));
    const speaking=stage==='reading'?{seat:displaySeat,text:lastSpeech[displaySeat]}:response;
    const topSpeech=$('top-speech');topSpeech.hidden=!(speaking?.seat===2);topSpeech.textContent=speaking?.seat===2?speaking.text:'';
    game.players.forEach((p,i)=>{
      const seat=$('seat-'+i);seat.className=seat.className.replace(/\s(active|folded|showdown)/g,'');
      if(complete&&p.hole.length===2)seat.classList.add('showdown');
      if((busy?displaySeat:game.actor)===i)seat.classList.add('active');if(p.folded&&started&&!complete)seat.classList.add('folded');
      const draft=document.createElement('div');
      const avatar=document.createElement('div');avatar.className='seat-avatar';avatar.innerHTML=`<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="avatar-bg-${i}" x2="1" y2="1"><stop stop-color="#1686c4"/><stop offset="1" stop-color="#00528f"/></linearGradient><linearGradient id="avatar-person-${i}" x2="0" y2="1"><stop stop-color="#69cefa"/><stop offset="1" stop-color="#94e1ff"/></linearGradient><clipPath id="avatar-clip-${i}"><circle cx="32" cy="32" r="29.5"/></clipPath></defs><circle cx="32" cy="32" r="30.5" fill="url(#avatar-bg-${i})"/><g clip-path="url(#avatar-clip-${i})" fill="url(#avatar-person-${i})"><circle cx="32" cy="26" r="11.5"/><path d="M10 64v-6c0-10 9.8-16 22-16s22 6 22 16v6Z"/></g><circle cx="32" cy="32" r="30.5" fill="none" stroke="#78d7ff" stroke-width="3"/></svg>`;avatar.setAttribute('aria-hidden','true');draft.append(avatar);
      const portrait=window.PokerPortraits?.forPlayer(p,i,game.pokerface);
      if(portrait){avatar.classList.add('has-portrait');const image=document.createElement('img');image.className='seat-portrait';image.src=portrait;image.alt='';image.width=192;image.height=192;image.draggable=false;image.decoding='async';image.onerror=function(){this.hidden=true;};avatar.append(image);}
      const name=document.createElement('div');name.className='seat-name';name.title=p.name;name.textContent=i&&!game.pokerface?.enabled&&p.profile==='professor'?'教授':p.name;
      for(const [condition,label] of [[i===game.dealer,'D'],[i===game.sbSeat,'SB'],[i===game.bbSeat,'BB']])if(condition&&started){const b=document.createElement('span');b.className='badge';b.textContent=label;name.append(b);}
      const stack=document.createElement('div');stack.className='seat-stack';stack.textContent=amount(p.stack);stack.tabIndex=0;stack.setAttribute('role','button');stack.setAttribute('aria-label','查看'+p.name+'的精确筹码');stack.onclick=()=>V.showAmounts(p);stack.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();V.showAmounts(p);}};
      const cards=document.createElement('div');cards.className='cards';
      const reveal=i===0||complete;
      for(const c of p.hole)cards.append(card(c,!reveal));
      const meta=document.createElement('div');meta.className='seat-meta';
      meta.textContent=!p.hole.length&&p.stack===0?'已淘汰':p.folded&&started?'已弃牌':complete?(game.result.awards[i]?`收回 ${game.result.awards[i]}`:'未获底池'):p.stack===0&&started?'已全下':p.bet?`本轮投入 ${p.bet}`:i>0?['','强势施压','狡猾设局','谨慎反击'][i]:'你的底牌';
      const contribution=document.createElement('div');contribution.className='seat-contribution';
      contribution.setAttribute('data-total',C?C.compact(p.total):p.total.toLocaleString());contribution.setAttribute('data-last',(C?C.compact(p.lastContribution||0):(p.lastContribution||0).toLocaleString()));
      const total=document.createElement('div');total.textContent=`本手累计投入 ${p.total.toLocaleString()}`;
      const current=document.createElement('div');current.textContent=`本次投入 ${(p.lastContribution||0).toLocaleString()}`;
      contribution.title='本手累计投入 '+p.total+'；本次投入 '+(p.lastContribution||0);contribution.onclick=()=>V.showAmounts(p);contribution.append(total,current);V.contribution(contribution,p.total,p.lastContribution||0);draft.append(name,stack,contribution,cards,meta);if(i===2)draft.append(topSpeech);
      if(i&&M){const mood=document.createElement('div');mood.className='seat-mood';mood.textContent=M.label(p.emotion,p.profile);draft.append(mood);}
      if(complete&&game.result.hands?.[i]){const show=document.createElement('button');show.className='best-select compact';show.textContent=P.NAMES[game.result.scores[i][0]]+' · 看最佳牌';show.onclick=()=>{selectedResult=i;render();};draft.append(show);}
      if(i!==2&&speaking?.seat===i&&speaking.text){
        const bubble=document.createElement('div');bubble.className='speech-bubble';bubble.setAttribute('role','status');bubble.textContent=speaking.text;draft.append(bubble);
      }
      if(i===0&&response?.playerText){const bubble=document.createElement('div');bubble.className='speech-bubble player-speech';bubble.setAttribute('role','status');bubble.textContent=response.playerText;draft.append(bubble);}
      const info=document.createElement('div');info.className='seat-info';for(const child of [...draft.children])if(!child.classList.contains('cards')&&!child.classList.contains('speech-bubble'))info.append(child);draft.prepend(info);V.chips(draft,p.stack,game.players.reduce((sum,x)=>sum+x.stack,0)+(complete?0:game.pot()));V.reconcile(seat,[...draft.children]);
    });
    const l=game.actor===0&&!busy&&!paused&&!initializing?game.legal():null;
    $('challenge-open').disabled=!l||!H?.available(game)||!game.players.some((p,i)=>i&&!p.folded&&p.stack>0&&p.hole.length===2);
    $('fold').disabled=!l;$('call').disabled=!l;
    const short=amount;$('call').textContent=l?(l.check?'过牌':l.callAmount===game.players[0].stack?`全下跟注 ${short(l.callAmount)}`:`跟注 ${short(l.callAmount)}`):'过牌 / 跟注';
    $('raise').disabled=!l?.raise;$('raise-to').disabled=!l?.raise;$('raise-down').disabled=!l?.raise;$('raise-up').disabled=!l?.raise;
    $('raise').textContent=game.currentBet===0?'下注':'加注';
    const canAllin=l&&(l.raise||l.call&&game.players[0].stack<=l.toCall);
    $('allin').disabled=!canAllin;
    document.querySelectorAll('[data-size]').forEach(b=>b.disabled=!l?.raise);
    if(l?.raise) {
      $('raise-to').min=l.minRaiseTo;$('raise-to').max=l.maxRaiseTo;
      if(draft){const event=(game.events||[]).filter(e=>['hand-start','blind','action','community'].includes(e.type)).slice(-1)[0];draft.sync([game.tableId,game.hand,game.phase,game.actor,event?.seq??game.history.length].join('/'),{min:l.minRaiseTo,max:l.maxRaiseTo,step:Math.max(game.bb,l.minRaiseTo-game.currentBet),bet:game.players[0].bet});$('raise-to').value=draft.view().text;raisePreview();}
      else $('raise-to').value=l.minRaiseTo;
      $('limits').textContent=`本轮总额 ${amount(l.minRaiseTo)}–${amount(l.maxRaiseTo)}；需跟注 ${amount(l.toCall)}。${l.maxRaiseTo<l.fullRaiseTo?'只能不足额全下。':''}`;
    } else $('limits').textContent=l?.call&&!l.raise?'当前可跟注或弃牌；加注权未开放，或没有可继续下注的对手。':'加注金额包含你本轮已投入的筹码。';
    const alive=game.players.filter(p=>p.stack>0);
    $('next').disabled=initializing||busy||paused||started&&!complete||complete&&alive.length<2&&!game.match;
    $('next').textContent=game.match?.finalized?(game.mode==='tournament'&&career?.tournament?.status==='between'?'晋级下一桌':'返回赛事大厅'):!started?'开始对战':alive.length<2?'对战结束':game.players[0].stack===0?'下一手 · 观战':'下一手';
    $('status').textContent=paused?'牌桌已暂停，可以慢慢翻阅聊天记录。':stage==='revealing'?'本手亮牌：所有参赛者公开底牌，弃牌者也展示。':stage==='reading'?`${game.players[displaySeat].name}已行动 · 留一点时间读台词…`:!started?'为三个对手选择性格和筹码，再开始对战。':game.match?.finalized?(game.match.status==='won'?'本桌夺冠，资金已结算；返回赛事大厅。':game.match.status==='lost'?'本桌失利；返回大厅可降档、重试或重建资金。':'已退赛，剩余筹码已返还；返回赛事大厅。'):complete?(alive.length===1?`${alive[0].name}赢下整张桌子！`:game.players[0].stack===0?'你已被淘汰，可以继续观战或重新开局。':'本手结算完成，点击下一手继续。'):game.actor===0?'轮到你行动':`${game.players[game.actor].name}正在思考…`;
    $('balance').textContent=`总筹码 ${(game.players.reduce((s,p)=>s+p.stack,0)+(complete?0:game.pot())).toLocaleString()}`;
    $('readout').textContent=E.styleText[A.modelOpponent(game.players[0]).style];
    $('pause').disabled=!started||complete&&!busy&&!paused;$('pause').textContent=paused?'继续':'暂停';
    const audioState={tableId:game.tableId,hand:game.hand,seq:game.eventSeq,phase:game.phase,paused:paused||!!document.hidden,actor:game.actor,canAct:!!l,events:(game.events||[]).map(e=>({id:e.id,seq:e.seq,hand:e.hand,type:e.type,actionType:e.actionType,amount:e.amount,stackAfter:e.stackAfter}))};
    for(const cue of audioCursor?.read(audioState)||[])sound(cue);
    V.scheduleLayout();FX?.sync(game,{paused,actor:busy?displaySeat:game.actor});
    coach.setTurn(l?A.observe(game,0,$('difficulty').value):null);window.PokerHome?.sync();
    $('result').hidden=!complete;$('view-result').disabled=!complete;
    if(complete) {
      const box=$('result');box.replaceChildren();
      for(const [i,score] of Object.entries(game.result.scores)){const p=document.createElement('p');p.textContent=`${game.players[i].name}：${P.NAMES[score[0]]}`;box.append(p);}
      game.result.pots.forEach((pot,k)=>{const p=document.createElement('p');p.textContent=`${pot.refund?'退回':k===0?'主池':'边池'} ${pot.amount} → ${pot.winners.map(i=>game.players[i].name).join(' / ')}`;box.append(p);});
      for(const [i,p] of game.players.entries()){const row=document.createElement('p');row.textContent=`${p.name}：净变化 ${(game.result.net?.[i]||0)>=0?'+':''}${game.result.net?.[i]||0}`;box.append(row);}
    }
  }
  function resultDialog(){
    if(window.PokerHome?.isOpen())return;
    if(game.phase==='complete'&&game.players.filter(p=>p.stack>0).length===1)F?.reveal(game);
    if(resultShown===game.hand)return;resultShown=game.hand;const box=$('hand-result-body');box.replaceChildren();
    const resultKey=game.tableId+':'+game.hand+':result';if(!restored&&!paused&&soundedResult!==resultKey){soundedResult=resultKey;sound({id:resultKey,kind:game.result.net[0]>0?'result-win':game.result.net[0]<0?'result-loss':'result-tie',scope:'table'});}
    const alive=game.players.filter(p=>p.stack>0);$('hand-result-title').textContent=game.players[0].stack===0?'你已被淘汰':alive.length===1?'胜利！你拿下了整桌':(game.result.net[0]>0?'本手获利':game.result.net[0]<0?'本手失利':'本手持平');
    for(const [i,detail] of Object.entries(game.result.hands||{})){const row=document.createElement('div'),name=document.createElement('p'),hole=document.createElement('div'),cards=document.createElement('div');name.textContent=`${game.players[i].name}：${P.NAMES[detail.score[0]]} · 底牌 / 最佳五张`;hole.className='cards revealed-hole';game.players[i].hole.forEach(c=>hole.append(card(c)));cards.className='cards';detail.bestFive.forEach(c=>cards.append(card(c)));row.append(name,hole,cards);box.append(row);}
    game.players.forEach((p,i)=>{if(p.hole.length===2&&!game.result.hands?.[i]){const row=document.createElement('div'),name=document.createElement('p'),hole=document.createElement('div');name.textContent=p.name+(p.folded?'（已弃牌，不参与结算）':'（独赢）');hole.className='cards revealed-hole';p.hole.forEach(c=>hole.append(card(c)));row.append(name,hole);box.append(row);}});
    game.result.pots.forEach((pot,k)=>{const row=document.createElement('p');row.textContent=`${pot.refund?'超额退还':k===0?'主池':'边池'} ${pot.amount} → ${pot.winners.map(i=>game.players[i].name).join(' / ')}`;box.append(row);});
    game.players.forEach((p,i)=>{const row=document.createElement('p');row.textContent=`${p.name}：${game.result.net[i]>=0?'+':''}${game.result.net[i]}，剩余 ${p.stack}`;box.append(row);});
    if(game.result.kind==='fold'){const row=document.createElement('p');row.textContent='本手由其他玩家弃牌结束；所有底牌供复盘，弃牌者不参与结算。';box.append(row);}
    if(U&&(alive.length===1||game.players[0].stack===0)){const section=document.createElement('section');section.className='end-summary';const title=document.createElement('h3');title.textContent=alive.length===1?'整场战绩总结':'你的本场战绩（牌桌尚未结束）';section.append(title);const body=document.createElement('div');persist();window.PokerSummaryUI?.fill(body,ledger,'current',false);section.append(body);box.append(section);if(alive.length===1)$('hand-result-title').textContent=alive[0]===game.players[0]?'胜利！你拿下了整桌':alive[0].name+'赢下整场';}
    for(const mapping of F?.mappings(game,A.PROFILES)||[]){const row=document.createElement('p');row.textContent='身份揭晓：'+mapping;box.append(row);}
    if($('hand-result').showModal&&!$('hand-result').open)$('hand-result').showModal();persist();
  }
  function commit(seat,move,expected=null){const before=game.players.map(p=>p.emotion?{...p.emotion}:null);
    const e=expected||{hand:game.hand,phase:game.phase,actor:game.actor,seq:game.eventSeq};
    if(game.execute){if(!game.execute({id:game.tableId+':action:'+e.seq,expected:e,seat,type:move.type,target:move.target}))return false;}else game.act(seat,move.type,move.target);decisionSeed=null;if(seat>0)A.remember?.(game,seat,move);if(Number.isFinite(move.eq))game.players[seat].expectedEquity=move.eq;if(M){const event=game.history[game.history.length-1];game.players.forEach((p,i)=>M.action(p.emotion,event,game.history.length,p.stack,game.bb,{profile:p.profile,seat:i,playing:p.hole.length===2,folded:p.folded}));if(game.phase==='complete')game.players.forEach((p,i)=>M.finish(p.emotion,p.profile,game.hand,game.result.net[i],game.handStart[i],p.expectedEquity||.5));}K?.emit(game,'emotion',{cause:'action',actionSeq:game.events?.slice().reverse().find(e=>e.type==='action')?.seq},{decision:{seat,reason:move.reason||null,eq:Number.isFinite(move.eq)?move.eq:null,odds:Number.isFinite(move.odds)?move.odds:null,analysis:move.analysis||null},emotions:game.players.map((p,i)=>({seat:i,before:before[i],after:p.emotion||null}))});if(game.phase==='complete'){A.learn?.(game);if(game.players.filter(p=>p.stack>0).length===1)F?.reveal(game);}persist();return true;}
  function schedule() {
    if(paused||document.hidden||initializing)return;
    if(game.phase==='complete'&&revealedHand!==game.hand){
      A.learn?.(game);if(game.players.filter(p=>p.stack>0).length===1)F?.reveal(game);revealedHand=game.hand;const token=epoch;busy=true;stage='revealing';displaySeat=null;
      if(M)game.players.forEach((p,i)=>M.finish(p.emotion,p.profile,game.hand,game.result.net[i],game.handStart[i],p.expectedEquity||.5));
      selectedResult=Object.keys(game.result.hands||{})[0]??null;
      appendMessage((game.result.kind==='showdown'?'本手摊牌':'本手独赢')+' · 全桌亮牌 · '+game.players.filter(p=>p.hole.length===2).map(p=>`${p.name}${p.folded?'（已弃牌）':''}：${p.hole.map(P.cardText).join(' ')}`).join('；'),'system');
      if(L)game.players.forEach((p,i)=>{if(i&&p.hole.length){const event=p.stack===0?'bust':game.result.net[i]>0?'win':game.result.net[i]<0?'lose':'tie',text=safeSpeech(L.choose(p.profile,event,{emotion:p.emotion},speechMemory[i]||[],game.random?.speech||game.rng));p.emotion.spokenSerial=p.emotion.reactionSerial||0;appendMessage(text,'chat',p.name);(speechMemory[i]||= []).push(text);}});
      const finishReveal=()=>{if(token!==epoch)return;const visuals=FX?.stats();if(visuals?.running||visuals?.activeEmotions){queue(finishReveal,100);return;}busy=false;stage='';render();resultDialog();};
      persist();render();queue(finishReveal,3000);return;
    }
    if(game.actor===null||game.actor===0){busy=false;stage='';displaySeat=null;render();return;}
    const token=epoch,seat=game.actor;busy=true;stage='thinking';displaySeat=seat;render();
    queue(()=>{
      if(token!==epoch)return;
      try {
        const view=A.observe(game,seat,$('difficulty').value),expected={hand:game.hand,phase:game.phase,actor:game.actor,seq:game.eventSeq};
        const key=game.tableId+':'+game.hand+':'+game.phase+':'+seat+':'+game.history.length;if(decisionSeed?.key!==key)decisionSeed={key,seed:Math.floor((game.random?.ai||game.rng)()*4294967296)};persist();
        const apply=move=>{if(token!==epoch)return;if(paused){queue(()=>apply(move),0);return;}if(FX?.stats().dealing){queue(()=>apply(move),100);return;}
          const event=move.target===view.legal.maxRaiseTo&&move.type==='raise'?'allin':move.type==='raise'?move.reason==='steal'?'steal':move.reason==='value'?'value':'raise':move.type;
          if(!commit(seat,move,expected))return;
          const text=safeSpeech(L?L.choose(game.players[seat].profile,event,{emotion:game.players[seat].emotion,rival:game.players[seat].rival,model:A.modelOpponent(view.seats[0]),targetPresent:!view.seats[0].folded&&view.seats[0].playing},speechMemory[seat]||[],game.random?.speech||game.rng):E.speech(seat,move.type,A.modelOpponent(view.seats[0]),lastSpeech[seat],game.random?.speech||Math.random,!view.seats[0].folded&&view.seats[0].playing));
          if(game.players[seat].emotion)game.players[seat].emotion.spokenSerial=game.players[seat].emotion.reactionSerial||0;
          if(game.players[seat].profile==='neymar'){const emoji=['🙃😮‍💨','😤🔥','😎🤫'][Math.floor(game.random.speech()*3)];K?.emit(game,'performance',{seat,emoji});}lastSpeech[seat]=text;(speechMemory[seat]||=[]).push(text);speechMemory[seat]=speechMemory[seat].slice(-8);
          syncLog({text,name:game.players[seat].name});$('talk').textContent=`${game.players[seat].name}：「${text}」`;stage='reading';persist();render();
          const hold=E.timing($('pace').value,move.type,text).hold;
          queue(()=>{if(token!==epoch)return;stage='';busy=false;schedule();},controls?controls.readingHold($('pace').value,hold):Math.max(3000,hold));
        };
        if(window.PokerCompute&&typeof Worker!=='undefined')window.PokerCompute.run(view,decisionSeed.seed,{owner:'ai'}).then(result=>apply(result.move)).catch(error=>{if(token!==epoch||error.code==='CANCELLED')return;console.warn('AI task:',error);appendMessage('本地计算未完成，本次采用安全操作。','system');apply({type:view.legal.check?'check':'fold'});});
        else {const random=K?K.random(decisionSeed.seed):game.rng;apply(window.PokerStrategy?window.PokerStrategy.decide(view,window.PokerStrategy.analyze(view,random),random):A.decide(view,random));}
      }catch(e){busy=false;stage='';render();$('status').textContent='牌局异常：'+e.message+'。请重新开局。';console.error(e);}
    },E.timing($('pace').value,'think').think);
  }
  function action(type,target) {
    if(initializing||game.actor!==0||busy||paused||V.blocked())return false;
    FX?.finish({keepEmotions:true});
    try {commit(0,{type,target});syncLog();if(L)game.players.forEach((p,i)=>{if(i)appendMessage(safeSpeech(L.choose(p.profile,'open',{rival:p.rival},[],game.random.speech)),'chat',p.name);});persist();render();schedule();return true;}
    catch(e){$('status').textContent=e.message;return false;}
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
  let speechIndex=0;function speechChoices(){if(!H)return;const intent=$('speech-intent').value||'challenge',lines=H.INTENTS[intent].lines;speechIndex=0;$('challenge-text').textContent=lines[0];$('challenge-presets').replaceChildren();lines.forEach((text,index)=>{const b=document.createElement('button');b.className='quiet';b.textContent=text;b.onclick=()=>{speechIndex=index;$('challenge-text').textContent=text;};$('challenge-presets').append(b);});}$('speech-intent').onchange=speechChoices;speechChoices();
  $('challenge-close').onclick=()=>$('challenge-dialog').close?.();
  $('challenge-send').onclick=()=>{
    if(busy||paused){$('challenge-state').textContent='请等轮到你再发话。';return;}
    try{
      const target=Number($('challenge-target').value),sent=H.speak(game,target,$('speech-intent').value||'challenge',speechIndex,speechMemory[target]||[]),p=game.players[target];sent.reply=safeSpeech(sent.reply);if(p.emotion)p.emotion.spokenSerial=p.emotion.reactionSerial||0;
      appendMessage(sent.text,'chat',`你 → ${p.name}`);appendMessage(sent.reply,'chat',p.name);
      K?.emit(game,'challenge',{seat:0,targetSeat:target,text:sent.text},{intent:$('speech-intent').value||'challenge',emotions:[{seat:target,after:p.emotion}]});lastSpeech[target]=sent.reply;(speechMemory[target]||=[]).push(sent.reply);speechMemory[target]=speechMemory[target].slice(-8);
      clearResponse();response={seat:target,text:sent.reply,playerText:sent.text};responseTimer=setTimeout(()=>{response=null;render();},4500);
      $('talk').textContent=`${p.name}：「${sent.reply}」`;$('challenge-dialog').close?.();persist();render();
    }catch(e){$('challenge-state').textContent=e.message;}
  };
  $('call').onclick=()=>action(game.legal()?.check?'check':'call');
  function raisePreview(){if(!draft)return;const value=draft.view(),node=$('raise-preview'),inline=$('raise-inline-preview');if(node){node.textContent=value.error||'本次还需投入 '+amount(value.additional);node.className='hint'+(value.error?' input-error':'');}if(inline)inline.textContent=value.error?'':'本次投入 '+amount(value.additional);return value;}
  $('raise-to').oninput=()=>{draft?.edit($('raise-to').value);raisePreview();};
  $('raise').onclick=()=>{if(game.actor!==0||busy||paused||V.blocked())return false;if(draft){draft.edit($('raise-to').value);const value=raisePreview();if(value.error){$('status').textContent=value.error;return false;}return action('raise',value.total);}return action('raise',Number($('raise-to').value));};
  for(const [id,direction]of [['raise-down',-1],['raise-up',1]])$(id).onclick=()=>{const l=game.legal();if(game.actor!==0||busy||paused||V.blocked()||!l?.raise)return false;if(draft){draft.edit($('raise-to').value);const changed=draft.step(direction);$('raise-to').value=draft.view().text;raisePreview();if(changed)sound({id:'adjust:'+ ++audioSerial,kind:'adjust',scope:'ui'});return changed;}const current=Number($('raise-to').value),step=Math.max(game.bb,l.minRaiseTo-game.currentBet);$('raise-to').value=Math.max(l.minRaiseTo,Math.min(l.maxRaiseTo,(Number.isSafeInteger(current)?current:l.minRaiseTo)+direction*step));};
  $('raise-to').onkeydown=e=>{if(e.key==='Enter')$('raise').click();};
  const steppers=['raise-down','raise-up'].map(id=>{const element=$(id);return controls&&element.addEventListener?controls.bindStepper(element,{onStep:element.onclick,canStep:()=>game.actor===0&&!busy&&!paused&&!V.blocked()&&!!game.legal()?.raise}):null;});
  $('allin').onclick=()=>{const l=game.legal();if(l)action(l.raise?'raise':'call',l.maxRaiseTo);};
  document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{
    const l=game.legal();if(game.actor!==0||busy||paused||V.blocked()||!l?.raise)return;
    const previous=$('raise-to').value;
    const mult={half:0.5,pot:1,double:2}[b.dataset.size];
    const target=b.dataset.size==='min'?l.minRaiseTo:game.currentBet+Math.round((game.pot()+l.toCall)*mult);
    $('raise-to').value=Math.max(l.minRaiseTo,Math.min(l.maxRaiseTo,target));
    draft?.edit($('raise-to').value);raisePreview();
    if(String(previous)!==String($('raise-to').value))sound({id:'adjust:'+ ++audioSerial,kind:'adjust',scope:'ui'});
  });
  $('next').onclick=()=>{if(initializing||busy||paused||V.blocked())return;FX?.finish();try{if(game.match?.finalized){if(game.mode==='tournament'&&career.tournament?.status==='between')launch(C.advance(career,game));else careerUI?.open();return;}if(game.phase==='idle'){
    const stacks=[1500,...[1,2,3].map(i=>Number($('chips-'+i).value||1500))];if(stacks.some(n=>!Number.isInteger(n)||n<1||n>1000000))throw new Error('初始筹码须为 1–1,000,000 的整数');
    const profiles=['human',...[1,2,3].map(i=>$('ai-'+i).value||['','maniac','calculator','gambler'][i])];if(A.PROFILES&&profiles.slice(1).some(id=>!A.PROFILES[id]))throw new Error('请选择有效的对手');
    game=S?S.create({stacks,profiles},Date.now()):new P.Game({stacks,profiles});F?.configure(game,A.PROFILES,$('pokerface').checked);hydratePlayers();
  }clearResponse();$('challenge-dialog').close?.();selectedResult=null;C?.blind(game);game.startHand();window.PokerHome?.enterTable();game.players.forEach(p=>{if(p.emotion)M.begin(p.emotion,p.profile);});window.PokerStrategy?.begin(game);K?.emit(game,'emotion',{cause:'hand-start'},{emotions:game.players.map((p,i)=>({seat:i,after:p.emotion||null}))});logCursor=0;syncLog();if(game.hand===1&&L)game.players.forEach((p,i)=>{if(i)appendMessage(safeSpeech(L.choose(p.profile,'open',{rival:p.rival},[],game.random?.speech||game.rng)),'chat',p.name);});persist();render();schedule();}catch(e){$('status').textContent=e.message;}};
  $('restart').onclick=()=>{if(game.match&&!game.match.finalized){try{C.withdraw(career,game);persist();render();careerUI.open();}catch(error){$('status').textContent=error.message;}return;}if(game.phase!=='idle'&&!confirm('重新开始四人对战？筹码、聊天记录与对手记忆将重置，历史战绩会保留。'))return;F?.reveal(game);if(U)U.abandon(ledger,game);K?.emit(game,'table-end',{reason:'restart'});persist(false);const revealed=F?.mappings(game,A.PROFILES)||[];epoch++;decisionSeed=null;clearResponse();$('challenge-dialog').close?.();clearTimeout(timer);window.PokerCompute?.cancel();pendingJob=null;busy=false;paused=false;stage='';displaySeat=null;logCursor=0;unread=0;revealedHand=0;resultShown=0;selectedResult=null;conversation.length=0;for(const key of Object.keys(lastSpeech))delete lastSpeech[key];for(const key of Object.keys(speechMemory))delete speechMemory[key];$('history').replaceChildren();$('latest').hidden=true;game=S?S.create():new P.Game();hydratePlayers();$('talk').textContent=revealed.length?'上一桌身份揭晓：'+revealed.join('；'):'新的一桌，重新选择对手与筹码。';if(revealed.length)appendMessage('上一桌身份揭晓：'+revealed.join('；'),'system');syncMode();$('hand-result').close?.();coach.setTurn(null);persist();render();};
  function setPaused(value,reason='manual'){
    if(value)steppers.forEach(stepper=>stepper?.cancel());
    if(paused===value||initializing||!value&&V.blocked())return;
    paused=value;
    if(paused){if(pendingJob){remaining=Math.max(0,deadline-Date.now());clearTimeout(timer);}else if(stage==='thinking'){epoch++;window.PokerCompute?.cancel('ai');busy=false;stage='';displaySeat=null;restored=true;}}
    else if(pendingJob){const job=pendingJob;queue(job,remaining);}else if(restored){restored=false;schedule();}
    K?.emit(game,'lifecycle',{state:paused?'pause':'resume',reason});persist();render();
  }
  $('pause').onclick=()=>setPaused(!paused);
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden&&game.phase!=='idle')setPaused(true,'background');});
  window.addEventListener?.('pagehide',()=>{if(game.phase!=='idle')setPaused(true,'pagehide');});
  $('latest').onclick=()=>{$('history').scrollTop=$('history').scrollHeight;unread=0;$('latest').hidden=true;};
  $('history').onscroll=()=>{const list=$('history'),bottom=list.scrollHeight-list.scrollTop-list.clientHeight<45;$('latest').hidden=bottom;if(bottom)unread=0;};
  $('help').onclick=()=>$('rules').showModal();
  $('result-close').onclick=()=>$('hand-result').close?.();$('view-result').onclick=()=>{if(game.phase==='complete'){resultShown=0;resultDialog();}};
  window.PokerSummaryUI?.mount(()=>ledger,()=>{if(game.phase!=='idle'&&game.phase!=='complete'&&!paused)$('pause').onclick();});
  if(S&&(storage||repository)){try{if(initializing){$('next').disabled=true;$('status').textContent='正在恢复本机进度…';}const saved=repository?await repository.load():S.load(storage);initializing=false;if(saved&&C){try{career=C.restore(saved.extras.career);C.validateMatch(career,saved.game);}catch(error){throw error;}}if(saved&&U){try{ledger=U.restore(saved.extras.ledger);}catch{ledger=U.create();appendMessage('历史战绩无法读取，从此处重新累计；牌局存档仍可恢复。','system');}}if(saved&&saved.game.phase!=='idle'){
    game=saved.game;F?.hydrate(game,A.PROFILES);hydratePlayers();$('pokerface').checked=!!game.pokerface?.enabled;syncMode();paused=true;restored=true;logCursor=game.log.length;
    $('pace').value=saved.extras.pace||'standard';$('difficulty').value=saved.extras.difficulty||'pressure';
    decisionSeed=saved.extras.decisionSeed||null;Object.assign(lastSpeech,saved.extras.lastSpeech||{});Object.assign(speechMemory,saved.extras.speechMemory||{});resultShown=0;
    recording=false;for(const entry of saved.extras.conversation||[]){const hand=game.hand;game.hand=entry.hand;appendMessage(entry.text,entry.kind,entry.speaker);game.hand=hand;}
    recording=true;if(game.phase==='complete'){revealedHand=game.hand;soundedResult=game.tableId+':'+game.hand+':result';resultDialog();}
    $('save-state').textContent='已恢复本机存档，点击继续。';
  }}catch{initializing=false;recording=true;$('save-state').textContent='存档损坏或版本不兼容，未覆盖旧存档；开始新对战会替换存档。';}}
  initializing=false;if(repository?.db&&storage){try{const saved=S.load(storage);if(saved?.game.historyPartial){$('save-state').textContent='旧版进度已恢复；旧牌局缺少完整复盘，之后开始记录。';}}catch{}}
  if(saveError)$('save-state').textContent=saveError;
  $('setup-career').onclick=()=>{$('mobile-panel-close').click?.();careerUI?.open();};
  const careerUI=window.PokerCareerUI?.mount(()=>({career,game}),{quick:()=>window.PokerHome.openQuick(),pause:()=>{if(!['idle','complete'].includes(game.phase)&&!paused)setPaused(true);},tournament:()=>{if(V.blocked())throw Error('请横屏后开始赛事');if(!['idle','complete'].includes(game.phase))throw Error('请先完成当前一手');launch(C.startTournament(career));},advance:()=>{if(V.blocked())throw Error('请横屏后晋级');launch(C.advance(career,game));},grandprix:pool=>{if(V.blocked())throw Error('请横屏后买入');if(!['idle','complete'].includes(game.phase))throw Error('请先完成当前一手');launch(C.enter(career,pool));},bailout:()=>{C.bailout(career);persist();},withdraw:()=>{C.withdraw(career,game);persist();render();}});
  function launch(next){if(V.blocked())throw Error('请横屏后开始赛事');if(!['idle','complete'].includes(game.phase))throw Error('请先完成当前一手');if(game.phase!=='idle'){F?.reveal(game);U?.abandon(ledger,game);}archiveCarry.push(...(game.events||[]),...(next.events||[]));epoch++;window.PokerCompute?.cancel();clearTimeout(timer);clearResponse();pendingJob=null;decisionSeed=null;busy=false;paused=false;restored=false;stage='';displaySeat=null;logCursor=0;unread=0;revealedHand=0;resultShown=0;conversation.length=0;for(const key of Object.keys(lastSpeech))delete lastSpeech[key];for(const key of Object.keys(speechMemory))delete speechMemory[key];$('history').replaceChildren();$('hand-result').close?.();game=next;hydratePlayers();$('pokerface').checked=!!game.pokerface?.enabled;syncMode();C.blind(game);game.startHand();window.PokerHome?.enterTable();game.players.forEach(p=>M?.begin(p.emotion,p.profile));window.PokerStrategy?.begin(game);K?.emit(game,'emotion',{cause:'hand-start'},{emotions:game.players.map((p,i)=>({seat:i,after:p.emotion}))});syncLog();if(L)game.players.forEach((p,i)=>{if(i)appendMessage(safeSpeech(L.choose(p.profile,'open',{rival:p.rival},[],game.random.speech)),'chat',p.name);});persist();render();schedule();}
  if(repository)window.PokerReview?.mount({repository,getLedger:()=>ledger,getCareer:()=>career,getGame:()=>game,pause:()=>{if(!['idle','complete'].includes(game.phase)&&!paused)setPaused(true);},persist:()=>persist()});
  window.PokerView={
    pause:reason=>{if(game.phase!=='idle')setPaused(true,reason);},
    status:()=>({started:game.phase!=='idle',phase:game.phase,paused,mode:game.mode||'quick',activeCareer:!!career?.active}),
    resume:()=>{if(initializing||game.phase==='idle')throw Error('请先从“开始游戏”选择一种玩法。');if(V.blocked())throw Error('请横屏后继续牌局。');setPaused(false,'home-continue');if(game.phase==='complete'&&!busy)resultDialog();},
    openLobby:()=>careerUI?.open(),
    prepareQuick:()=>{if(initializing)throw Error('正在恢复进度，请稍等。');if(!['idle','complete'].includes(game.phase))throw Error('请先继续游戏，完成当前一手后再切换模式。');if(career?.active||game.match&&!game.match.finalized)throw Error('请先在赛事大厅结算后退赛，剩余筹码会返还。');if(game.phase!=='idle'){$('restart').onclick();if(game.phase!=='idle')throw Error('已保留当前牌桌。');}},
    startQuick:()=>{if(game.phase!=='idle')throw Error('当前牌桌尚未结束。');$('next').onclick();if(game.phase==='idle')throw Error($('status').textContent);}
  };
  render();window.PokerReady=true;window.dispatchEvent?.(new Event('poker-ready'));
})();






