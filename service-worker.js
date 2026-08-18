"use strict";
const CACHE_VERSION = "qr-label-pwa-v15";
const CACHE = CACHE_VERSION;
const APP_SHELL = [
  "./","./index.html","./handoff.html","./handoff.js?v=15","./app.css?v=15","./app.js?v=15","./storage.js?v=15","./providers.js?v=15","./printer.js?v=15",
  "./manifest.webmanifest?v=15","./offline.html",
  "./icons/favicon.png","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png"
];
const VENDOR = [
  "https://unpkg.com/qrcode-generator@1.4.4/qrcode.js",
  "https://unpkg.com/jsqr@1.4.0/dist/jsQR.js",
  "https://unpkg.com/niimbot-web-bluetooth@2.4.0/src/niimbot.js"
];

const handoffReceivers = new Map();

async function sameOriginWindows() {
  const list=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  return list.filter(c=>{ try{return new URL(c.url).origin===self.location.origin;}catch(_){return false;} });
}

function handoffScore(client) {
  const state=handoffReceivers.get(client.id) || {};
  let score=0;
  if(state.connected) score+=10000;
  if(client.focused) score+=500;
  if(client.visibilityState==="visible") score+=250;
  score+=Math.min(200,Math.max(0,(state.ts||0)/1e12));
  return score;
}

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
        const handoffNav=/\/handoff\.html$/.test(url.pathname);
        try{
          const r=await fetch(req);
          if(r.ok) c.put(handoffNav ? "./handoff.html" : "./index.html",r.clone());
          return r;
        }catch(_){
          if(handoffNav) return await c.match("./handoff.html") || await c.match("./offline.html");
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
  const data=event.data || {};
  if(data.type==="SKIP_WAITING") { self.skipWaiting(); return; }
  if(data.type==="GET_VERSION") { event.source?.postMessage({type:"VERSION",version:CACHE_VERSION}); return; }

  if(data.type==="HANDOFF_REGISTER") {
    if(event.source?.id) handoffReceivers.set(event.source.id,{connected:!!data.connected,tabId:data.tabId||"",ts:Date.now()});
    return;
  }

  if(data.type==="HANDOFF_REQUEST") {
    event.waitUntil((async()=>{
      const source=event.source;
      const windows=await sameOriginWindows();
      const candidates=windows.filter(c=>c.id!==source?.id && !/\/handoff\.html(?:[?#]|$)/.test(c.url));
      candidates.sort((a,b)=>handoffScore(b)-handoffScore(a));
      const receiver=candidates[0];
      if(!receiver){ source?.postMessage({type:"HANDOFF_RESULT",requestId:data.requestId,ok:false,reason:"no_receiver"}); return; }
      receiver.postMessage({type:"HANDOFF_DELIVER",requestId:data.requestId,query:data.query||"",sourceTab:data.sourceTab||"",sourceClientId:source?.id||""});
      // Best effort. Some iOS WebViews allow WindowClient.focus(), others keep
      // the newly opened helper tab in front. The payload delivery itself does
      // not depend on focus succeeding.
      try { await receiver.focus(); } catch(_) {}
    })());
    return;
  }

  if(data.type==="HANDOFF_ACK") {
    event.waitUntil((async()=>{
      const target=data.targetClientId ? await self.clients.get(data.targetClientId) : null;
      target?.postMessage({type:"HANDOFF_RESULT",requestId:data.requestId,ok:true,receiverTab:data.receiverTab||"",connected:!!data.connected});
      try { if(event.source?.focus) await event.source.focus(); } catch(_) {}
    })());
  }
});
