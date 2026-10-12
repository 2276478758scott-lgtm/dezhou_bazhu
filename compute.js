(function(r){'use strict';let serial=0,worker=null,pending=null,blobURL=null;
  function clean(){if(worker)worker.terminate();worker=null;if(blobURL)URL.revokeObjectURL(blobURL);blobURL=null;}
  function cancel(){clean();if(pending){pending.reject(new Error('分析已取消'));clearTimeout(pending.timer);pending=null;}}
  function run(view,seed){cancel();return new Promise((resolve,reject)=>{const id=++serial;
    try{const source=r.PokerWorkerSource;if(source)blobURL=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(blobURL||'worker.js');
      const timer=setTimeout(()=>{cancel();},1500);pending={reject,timer};
      worker.onmessage=e=>{if(e.data.id!==id)return;clearTimeout(timer);clean();pending=null;e.data.error?reject(new Error(e.data.error)):resolve(e.data);};worker.onerror=()=>cancel();worker.postMessage({id,view,seed});
    }catch(error){cancel();reject(error);}
  });}
  r.PokerCompute={run,cancel};
})(globalThis);
