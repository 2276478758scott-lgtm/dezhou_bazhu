(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./state.js'):r.PokerState);if(typeof module==='object'&&module.exports)module.exports=a;else r.PokerArchive=a;})(globalThis,S=>{
  'use strict';const DB='dezhou-bazhu-history',LIMIT=2000;
  function openDB(factory){return new Promise((resolve,reject)=>{if(!factory)return reject(Error('IndexedDB unavailable'));let settled=false;const request=factory.open(DB,1),timer=setTimeout(()=>{settled=true;reject(Error('IndexedDB timeout'));},2500);
    request.onupgradeneeded=()=>{const db=request.result;for(const [name,key]of [['checkpoints','key'],['events','id']])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:key});const events=request.transaction.objectStore('events');if(!events.indexNames.contains('tableId'))events.createIndex('tableId','tableId');};
    request.onsuccess=()=>{clearTimeout(timer);if(settled){request.result.close();return;}settled=true;resolve(request.result);};request.onerror=()=>{clearTimeout(timer);settled=true;reject(request.error);};request.onblocked=()=>{clearTimeout(timer);settled=true;reject(Error('IndexedDB blocked'));};});}
  function transact(db,names,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(names,mode);let result;try{result=fn(tx);}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(typeof result==='function'?result():result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Archive transaction aborted'));});}
  function merge(previous,events){const rows=new Map(previous.map(e=>[e.id,e]));events.forEach(e=>rows.set(e.id,e));return [...rows.values()];}
  class Repository{
    constructor({storage=null,indexedDB=null,onStatus=()=>{}}={}){this.storage=storage;this.factory=indexedDB;this.onStatus=onStatus;this.db=null;this.tail=Promise.resolve();this.fallback=[];this.unsaved=new Map();this.truncated=false;this.failed=false;this.ready=this.init();}
    async init(){try{this.db=await openDB(this.factory);this.db.onversionchange=()=>{this.db.close();this.db=null;this.status('记录数据库已变更，请刷新后继续。');};}catch{this.status('使用备用存储：完整复盘最多保留最近 2,000 条事件，战绩继续累计。');}return this;}
    status(text){this.warning=text;this.onStatus(text);}
    async load(){await this.ready;let local=null,archived=null,localError=null;
      if(this.storage){try{const raw=this.storage.getItem(S.KEY);if(raw){local=JSON.parse(raw);S.restore(local);this.fallback=local.eventArchive||[];}}catch(error){localError=error;local=null;}}
      if(this.db){try{archived=await transact(this.db,['checkpoints'],'readonly',tx=>{const request=tx.objectStore('checkpoints').get('current');return ()=>request.result?.data;});if(archived)S.restore(archived);}catch{archived=null;this.status('历史记录读取失败，尝试本机备用存档。');}}
      const data=local&&(local.revision||0)>=(archived?.revision||0)?local:archived;
      if(!data){if(localError)throw localError;return null;}this.fallback=merge(this.fallback,data.game.events||[]);S.adopt(data);return S.restore(data);
    }
    save(game,extras,{additionalEvents=[]}={}){const data=S.stamp(S.snapshot(game,extras)),events=merge(additionalEvents,data.game.events||[]);
      // The small mirror completes synchronously, before a tab can disappear.
      events.forEach(e=>this.unsaved.set(e.id,e));
      let mirrorSaved=false;if(this.storage){try{const old=this.storage.getItem(S.KEY);let version;try{version=old?JSON.parse(old).version:null;}catch{if(!this.storage.getItem(S.KEY+'-backup-corrupt'))this.storage.setItem(S.KEY+'-backup-corrupt',old);}if(version===2&&!this.storage.getItem(S.KEY+'-backup-v2'))this.storage.setItem(S.KEY+'-backup-v2',old);
        if(!this.db||this.failed){const merged=merge(this.fallback,[...this.unsaved.values()]);this.truncated||=merged.length>LIMIT;this.fallback=merged.slice(-LIMIT);data.eventArchive=this.fallback;}this.storage.setItem(S.KEY,JSON.stringify(data));mirrorSaved=true;
      }catch{this.status('备用保存失败：存储空间不足或不可用，请保持页面打开。');}}
      const batch=[...this.unsaved.values()],archiveBatch=merge(this.fallback,batch);const save=this.tail.then(async()=>{await this.ready;if(!this.db){if(!mirrorSaved)throw Error('本浏览器不能保存进度');batch.forEach(e=>this.unsaved.delete(e.id));return;}
        await transact(this.db,['checkpoints','events'],'readwrite',tx=>{tx.objectStore('checkpoints').put({key:'current',data});for(const event of archiveBatch)tx.objectStore('events').put(event);});
        batch.forEach(e=>this.unsaved.delete(e.id));this.failed=false;
      });this.tail=save.catch(()=>{this.failed=true;this.status(mirrorSaved?'完整历史保存失败，当前进度以备用存档为准；后续操作会重试保存。':'保存失败，请保持页面打开；后续操作会重试保存。');
        // Preserve failed event batches alongside the newest synchronous mirror.
        if(this.storage)try{const raw=this.storage.getItem(S.KEY),latest=raw?JSON.parse(raw):null;if(latest&&(latest.revision||0)>=(data.revision||0)){const all=merge(this.fallback,[...this.unsaved.values()]);this.truncated||=all.length>LIMIT;this.fallback=all.slice(-LIMIT);latest.eventArchive=this.fallback;this.storage.setItem(S.KEY,JSON.stringify(latest));}}catch{}
      });return save;
    }
    async events(tableId,options){await this.tail;await this.ready;let records;if(this.db)records=await transact(this.db,['events'],'readonly',tx=>{const req=tableId?tx.objectStore('events').index('tableId').getAll(tableId):tx.objectStore('events').getAll();return ()=>req.result;});else records=this.fallback.filter(e=>!tableId||e.tableId===tableId);
      records=merge(records,merge(this.fallback,[...this.unsaved.values()])).filter(e=>!tableId||e.tableId===tableId).sort((a,b)=>a.tableId.localeCompare(b.tableId)||a.seq-b.seq);
      // A read-only API for later replay/plots; callers must request a projection.
      const K=typeof module==='object'&&module.exports?require('./kernel.js'):globalThis.PokerKernel;
      const completed=new Set(records.filter(e=>e.type==='settlement').map(e=>e.tableId+':'+e.hand)),revealed=new Set(records.filter(e=>e.type==='identity-reveal'||e.hidden===false).map(e=>e.tableId));
      if(options?.mode)records=records.filter(e=>e.mode===options.mode);if(options?.campaignId)records=records.filter(e=>e.campaignId===options.campaignId);if(options?.seriesId)records=records.filter(e=>e.seriesId===options.seriesId);if(options?.hand!==undefined)records=records.filter(e=>e.hand===options.hand);if(options?.phase)records=records.filter(e=>e.phase===options.phase);if(options?.raw)return records;return records.map(e=>K.publicEvent(e,{viewer:options?.viewer??0,completed:completed.has(e.tableId+':'+e.hand),identityRevealed:revealed.has(e.tableId)}));
    }
    async flush(){await this.tail;}
    close(){this.db?.close();}
  }
  return {Repository,merge,DB,LIMIT};
});
