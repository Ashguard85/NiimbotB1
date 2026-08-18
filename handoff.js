(()=>{"use strict";
const status=document.getElementById("status"), fallback=document.getElementById("fallback"), closeBtn=document.getElementById("closeTab");
const params=()=>{const q=new URLSearchParams(location.search);let h=location.hash.startsWith("#")?location.hash.slice(1):location.hash;if(h.startsWith("?"))h=h.slice(1);if(h&&h.includes("="))for(const [k,v] of new URLSearchParams(h))q.set(k,v);return q;};
const uuid=()=>crypto.randomUUID?crypto.randomUUID():"handoff-"+Date.now()+"-"+Math.random().toString(16).slice(2);
const openFull=()=>{const p=params();p.delete("handoff");p.delete("relay");location.replace("./#"+p.toString());};
fallback.addEventListener("click",openFull);

let closeTimers=[];
function cancelCloseTimers(){closeTimers.forEach(clearTimeout);closeTimers=[];}
function tryClose(){
  try { window.close(); } catch(_) {}
  // Some WKWebView hosts ignore close() even for a script-closable context.
  // We cannot force the host app to remove the tab, so keep a user-gesture retry.
  if(!window.closed){ closeBtn.hidden=false; }
}
function closeBestEffort(){
  cancelCloseTimers();
  // Avoid adding further history entries; a single-entry top-level context is
  // script-closable according to the HTML standard.
  try { history.replaceState(null,"",location.pathname+location.search+location.hash); } catch(_) {}
  [0,120,400,900,1600].forEach(ms=>closeTimers.push(setTimeout(tryClose,ms)));
}
closeBtn.addEventListener("click",()=>{
  tryClose();
  setTimeout(()=>{
    if(!window.closed){
      status.textContent="Übergabe ist abgeschlossen. Bluefy verhindert das automatische Schließen dieses Tabs; bitte den Tab einmal manuell schließen.";
      status.className="ok";
    }
  },180);
});

(async()=>{
 if(!("serviceWorker" in navigator)){status.textContent="Service Worker nicht verfügbar.";status.className="err";fallback.hidden=false;return;}
 try{
  await navigator.serviceWorker.register("./service-worker.js");
  const reg=await navigator.serviceWorker.ready;
  const sw=navigator.serviceWorker.controller||reg.active;
  const p=params();p.delete("handoff");p.delete("relay");
  if(!p.toString()){status.textContent="Keine Label-Daten übergeben.";status.className="err";fallback.hidden=false;return;}
  const requestId=uuid();
  let done=false;
  navigator.serviceWorker.addEventListener("message",e=>{
   const m=e.data||{}; if(m.type!=="HANDOFF_RESULT"||m.requestId!==requestId)return;
   done=true;
   if(m.ok){
     status.textContent=m.connected?"Label übernommen – zurück zum verbundenen Drucktab.":"Label an bestehenden Drucktab übergeben.";
     status.className="ok";
     closeBestEffort();
   } else {
     status.textContent="Kein bestehender Drucktab gefunden.";status.className="err";fallback.hidden=false;
   }
  });
  sw?.postMessage({type:"HANDOFF_REQUEST",requestId,sourceTab:"helper",query:p.toString(),ts:Date.now()});
  setTimeout(()=>{if(!done){status.textContent="Keine Antwort vom bestehenden Drucktab. Falls er offen ist, zurück zu diesem Tab wechseln; sonst hier fortfahren.";status.className="err";fallback.hidden=false;}},2600);
 }catch(e){status.textContent="Übergabe fehlgeschlagen: "+(e?.message||e);status.className="err";fallback.hidden=false;}
})();
})();