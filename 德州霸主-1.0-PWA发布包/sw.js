'use strict';
const CACHE='dezhou-bazhu-pwa-v4',FILES=['./','index.html','style.css','core.js','emotion.js','state.js','ai.js','experience.js','language.js','compute.js','helper.js','worker.js','app.js','pwa.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dezhou-bazhu-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='activate')self.skipWaiting();});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin)return;
  e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(e.request);if(cached)return cached;try{return await fetch(e.request);}catch(error){if(e.request.mode==='navigate')return c.match(new URL('index.html',self.registration.scope));throw error;}}));
});
