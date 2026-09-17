const CACHE="limited-grader-v1-3";
const SHELL=["./","./index.html","./styles.css?v=1.3","./app.js?v=1.3","./manifest.webmanifest?v=1.3"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const isAppAsset=sameOrigin&&(e.request.mode==="navigate"||/\/(index\.html|app\.js|styles\.css|manifest\.webmanifest)$/.test(url.pathname));
  if(isAppAsset){
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(e.request,{cache:"no-store"});
        if(fresh&&fresh.ok){const c=await caches.open(CACHE);c.put(e.request,fresh.clone())}
        return fresh;
      }catch(err){return (await caches.match(e.request))||(await caches.match("./index.html"))}
    })());
    return;
  }
  e.respondWith((async()=>{
    const hit=await caches.match(e.request);
    if(hit)return hit;
    try{const r=await fetch(e.request);if(r&&r.ok&&sameOrigin){const c=await caches.open(CACHE);c.put(e.request,r.clone())}return r}catch(err){return hit}
  })());
});
