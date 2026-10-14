(function(r){'use strict';let serial=0,active=null;const jobs=[];
  function error(message,code){const e=new Error(message);e.code=code;return e;}
  function clean(job){clearTimeout(job.timer);job.worker?.terminate();if(job.url)URL.revokeObjectURL(job.url);}
  function settle(job,value,failure){if(job.done)return;job.done=true;clean(job);if(active===job)active=null;const i=jobs.indexOf(job);if(i>=0)jobs.splice(i,1);failure?job.reject(failure):job.resolve(value);pump();}
  function cancel(owner){for(const job of [active,...jobs].filter(Boolean))if(owner===undefined||job.owner===owner)settle(job,null,error('分析已取消','CANCELLED'));}
  function pump(){if(active||!jobs.length)return;jobs.sort((a,b)=>b.priority-a.priority||a.id-b.id);const job=active=jobs.shift();
    try{const source=r.PokerWorkerSource;if(source)job.url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));job.worker=new Worker(job.url||'worker.js');
      job.timer=setTimeout(()=>settle(job,null,error('本地计算超时','TIMEOUT')),1500);
      job.worker.onmessage=e=>{if(job.done||active!==job||e.data.id!==job.id)return;settle(job,e.data,e.data.error?error(e.data.error,'COMPUTE'):null);};
      job.worker.onerror=()=>settle(job,null,error('本地计算失败','COMPUTE'));job.worker.postMessage({id:job.id,view:job.view,seed:job.seed,task:job.task,actualHoles:job.actualHoles});
    }catch(e){settle(job,null,e);}
  }
  function run(view,seed,{owner='ai',priority=owner==='ai'?10:0,task='decision',actualHoles=null}={}){cancel(owner);return new Promise((resolve,reject)=>{const job={id:++serial,view,seed,owner,priority,task,actualHoles,resolve,reject,done:false};jobs.push(job);if(active&&active.priority<priority)settle(active,null,error('分析让位于牌桌行动','CANCELLED'));pump();});}
  r.PokerCompute={run,cancel};
})(globalThis);
