(function(r){'use strict';
  r.PokerCoach={mount(){const $=id=>document.getElementById(id);let view=null,key='',token=0,busy=false;
    function paint(){$('coach-body').hidden=!$('coach-toggle').checked;$('coach-ask').disabled=!view||busy||!$('coach-toggle').checked;}
    function stop(){token++;if(busy)r.PokerCompute.cancel();busy=false;$('coach-advice').hidden=true;}
    $('coach-toggle').onchange=()=>{if(!$('coach-toggle').checked)stop();paint();};
    $('coach-ask').onclick=async()=>{if(!view||busy||!$('coach-toggle').checked)return;const current=++token,copy=view;busy=true;$('coach-state').textContent='本机估算中…';paint();
      try{const result=await r.PokerCompute.run({...copy,profile:'professor',emotion:null},Math.floor(Math.random()*4294967296));if(current!==token)return;
        const move=result.move,l=copy.legal;if(!l[move.type]||move.type==='raise'&&(!Number.isInteger(move.target)||move.target<l.minRaiseTo||move.target>l.maxRaiseTo))throw new Error('建议不合法，已拦截');
        const box=$('coach-advice');box.replaceChildren();const title=document.createElement('strong');title.textContent='建议：'+({fold:'弃牌',check:'过牌',call:`跟注 ${l.callAmount}`,raise:`加注至 ${move.target}`})[move.type];
        const reason=document.createElement('p');reason.textContent=({entry:'跟注成本较小，起手牌具备可玩性且筹码够深，可以考虑看翻牌；不等同于全下有利。',value:'牌力相对对手范围较强，可以争取价值。',bluff:'对手存在弃牌空间，可选择施压；这次建议有风险。',semi:'存在听牌机会，可以考虑半诈唬。',steal:'位置和公开行动提供了争夺底池的机会。',trap:'可以过牌控制底池或保留反击。',catch:'对手近期施压较多，价格允许继续验证。',price:move.type==='fold'?'当前价格相对估计胜率偏高。':'估计胜率与跟注价格可以接受。',free:'可以免费看下一步，无需额外投入。'})[move.reason];
        const info=document.createElement('p');info.textContent=`抽样胜率约 ${Math.round(move.eq*100)}% · 跟注赔率 ${Math.round(move.odds*100)}% · ${result.samples} 次抽样。估计有误差，最终由你决定。`;box.append(title,reason,info);box.hidden=false;$('coach-state').textContent='本地建议已生成，不代你操作。';
      }catch(error){if(current===token)$('coach-state').textContent='本地分析未完成，请重试。';}finally{if(current===token){busy=false;paint();}}};
    paint();return {setTurn(next){const nextKey=next?JSON.stringify(next):'';if(key!==nextKey){key=nextKey;stop();}view=next;paint();}};
  }};
})(globalThis);
