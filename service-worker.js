"use strict";
const CACHE_VERSION = "qr-label-pwa-v10";
const CACHE = CACHE_VERSION;
const APP_SHELL = [
  "./","./index.html","./app.css?v=10","./app.js?v=10","./storage.js?v=10","./providers.js?v=10","./printer.js?v=10",
  "./manifest.webmanifest?v=10","./offline.html",
  "./icons/favicon.png","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png"
];
const VENDOR = [
  "https://unpkg.com/qrcode-generator@1.4.4/qrcode.js",
  "https://unpkg.com/jsqr@1.4.0/dist/jsQR.js",
  "https://unpkg.com/niimbot-web-bluetooth@2.4.0/src/niimbot.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await c.addAll(APP_SHELL);
    // Cross-origin vendor files are optional during install so a CDN hiccup
    // never breaks installation. They are cached opportunistically.
    await Promise.all(VENDOR.map(async url=>{
      try { const r=await fetch(url,{mode:"no-cors",cache:"no-cache"}); await c.put(url,r); } catch(_){}
    }));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("qr-label-pwa-") && k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req=event.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);

  if(VENDOR.includes(req.url)){
    event.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const cached=await c.match(req.url);
      const network=fetch(req).then(r=>{ if(r.ok || r.type==="opaque") c.put(req.url,r.clone()); return r; }).catch(()=>null);
      return cached || await network || Response.error();
    })());
    return;
  }

  if(url.origin===self.location.origin){
    if(req.mode==="navigate"){
      event.respondWith((async()=>{
        const c=await caches.open(CACHE);
        try{
          const r=await fetch(req);
          if(r.ok) c.put("./index.html",r.clone());
          return r;
        }catch(_){
          return await c.match("./index.html") || await c.match("./offline.html");
        }
      })());
    } else {
      event.respondWith((async()=>{
        const c=await caches.open(CACHE);
        const hit=await c.match(req);
        if(hit) return hit;
        try{
          const r=await fetch(req);
          if(r.ok) c.put(req,r.clone());
          return r;
        }catch(_){ return Response.error(); }
      })());
    }
  }
});

self.addEventListener("message", event => {
  if(event.data?.type==="SKIP_WAITING") self.skipWaiting();
  if(event.data?.type==="GET_VERSION") event.source?.postMessage({type:"VERSION",version:CACHE_VERSION});
});
