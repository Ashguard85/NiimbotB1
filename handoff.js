(()=>{"use strict";
const CHANNEL="niimbot-qr-handoff-v1";
const STORAGE_KEY="niimbotQrHandoffV1";
const ACK_KEY="niimbotQrHandoffAckV1";
const RECEIVER_PREFIX="niimbotQrReceiverV2:";
const PRINT_WINDOW_NAME="niimbot-print";
const statusEl=document.getElementById("status");
const focusBtn=document.getElementById("focusTab");
const closeBtn=document.getElementById("closeTab");
const diagEl=document.getElementById("diagnostics");
const uuid=()=>crypto.randomUUID?crypto.randomUUID():"handoff-"+Date.now()+"-"+Math.random().toString(16).slice(2);
const helperTabId=uuid();
let channel=null, acked=false, directTarget=null, closeTimers=[];

function params(){
  const q=new URLSearchParams(location.search);
  let h=location.hash.startsWith("#")?location.hash.slice(1):location.hash;
  if(h.startsWith("?")) h=h.slice(1);
  if(h&&h.includes("=")) for(const [k,v] of new URLSearchParams(h)) q.set(k,v);
  q.delete("handoff"); q.delete("relay");
  return q;
}
function setStatus(text,cls=""){statusEl.textContent=text;statusEl.className=cls;}
function canUseStorage(){try{const k="__niimbot_test__";localStorage.setItem(k,"1");localStorage.removeItem(k);return true;}catch(_){return false;}}
const storageOK=canUseStorage();

function diagnostics(){
  const handlers=[];
  try{const h=window.webkit?.messageHandlers;if(h) handlers.push(...Object.keys(h));}catch(_){}
  const native=[];
  try{if(window.BLENative) native.push(...Object.keys(window.BLENative));}catch(_){}
  const receivers=[];
  if(storageOK){
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i); if(!k?.startsWith(RECEIVER_PREFIX)) continue;
        try{const v=JSON.parse(localStorage.getItem(k)||"{}");receivers.push(`${v.tabId||k.slice(RECEIVER_PREFIX.length)} connected=${!!v.connected} visible=${!!v.visible} age=${Math.max(0,Math.round((Date.now()-(v.ts||0))/1000))}s`);}catch(_){}
      }
    }catch(_){}
  }
  return [
    `BroadcastChannel: ${"BroadcastChannel" in window?"ja":"nein"}`,
    `localStorage: ${storageOK?"ja":"nein"}`,
    `Service Worker: ${"serviceWorker" in navigator?"vorhanden (für Handoff nicht benötigt)":"nicht vorhanden – für Handoff egal"}`,
    `history.length: ${history.length}`,
    `window.opener: ${window.opener?"ja":"nein"}`,
    `webkit.messageHandlers: ${handlers.length?handlers.join(", "):"keine sichtbaren"}`,
    `BLENative: ${native.length?native.join(", "):"nicht sichtbar / keine enumerierbaren Methoden"}`,
    `Empfänger: ${receivers.length?receivers.join(" | "):"keine Registry gefunden"}`
  ].join("\n");
}
function refreshDiagnostics(){diagEl.textContent=diagnostics();}

function receiverCandidate(){
  if(!storageOK) return null;
  const now=Date.now(); let best=null;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(!k?.startsWith(RECEIVER_PREFIX)) continue;
      let v; try{v=JSON.parse(localStorage.getItem(k)||"{}");}catch(_){continue;}
      if(!v?.tabId || now-(v.ts||0)>45000) continue;
      const score=(v.connected?1000:0)+(v.visible?100:0)+Math.max(0,45-Math.floor((now-v.ts)/1000));
      if(!best||score>best.score) best={...v,score};
    }
  }catch(_){}
  return best;
}

function postAckHandler(m){
  if(!m||m.requestId!==requestId) return;
  if(m.type!=="ack"&&m.type!=="NIIMBOT_HANDOFF_ACK") return;
  complete(m);
}
function complete(m={}){
  if(acked) return; acked=true;
  setStatus(m.connected?"Label übernommen. Der verbundene Drucktab bleibt aktiv.":"Label an den bestehenden Drucktab übergeben.","ok");
  focusBtn.hidden=false; closeBtn.hidden=false;
  try{directTarget?.focus();}catch(_){}
  bestEffortClose();
}

function tryNamedWindow(message){
  try{
    const w=window.open("",PRINT_WINDOW_NAME);
    if(!w) return false;
    let marker=false;
    try{marker=w.__NIIMBOT_HANDOFF_RECEIVER__===true;}catch(_){marker=false;}
    if(!marker){try{w.close();}catch(_){} return false;}
    directTarget=w;
    w.postMessage({...message,type:"NIIMBOT_HANDOFF"},location.origin);
    try{w.focus();}catch(_){}
    return true;
  }catch(_){return false;}
}

function sendBroadcast(message,targeted=true){
  const m={...message,targetTab:targeted?message.targetTab||"":""};
  try{channel?.postMessage(m);}catch(_){}
  if(storageOK){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(m));}catch(_){}}
}

function nativeCloseAttempt(){
  const exact=["closeTab","dismissTab","closeWindow","dismissWindow","closeWebView","dismissWebView"];
  try{
    const handlers=window.webkit?.messageHandlers;
    for(const name of exact){if(handlers?.[name]?.postMessage){try{handlers[name].postMessage({reason:"handoff-complete"});return true;}catch(_){}}}
  }catch(_){}
  try{
    const n=window.BLENative;
    for(const name of exact){if(typeof n?.[name]==="function"){try{n[name]();return true;}catch(_){}}}
  }catch(_){}
  return false;
}
function closeAttempt(){
  nativeCloseAttempt();
  try{window.close();}catch(_){}
  if(window.closed) return true;
  try{const selfWin=window.open("","_self"); if(selfWin&&selfWin!==window) selfWin.close(); else selfWin?.close();}catch(_){}
  return !!window.closed;
}
function bestEffortClose(){
  closeTimers.forEach(clearTimeout); closeTimers=[];
  [0,120,350,800,1500].forEach(ms=>closeTimers.push(setTimeout(()=>{if(!closeAttempt()&&ms===1500){setStatus("Label ist übergeben. Bluefy blockiert das automatische Schließen; mit „Zum Drucktab wechseln“ kannst du wenigstens direkt zurückspringen.","warn");}},ms)));
}
function focusExisting(){
  let ok=false;
  try{
    const w=directTarget||window.open("",PRINT_WINDOW_NAME);
    if(w){
      let marker=false; try{marker=w.__NIIMBOT_HANDOFF_RECEIVER__===true;}catch(_){}
      if(marker){w.focus();ok=true;} else if(!directTarget){try{w.close();}catch(_){}}
    }
  }catch(_){}
  if(!ok) setStatus("Bluefy konnte den bestehenden Tab nicht direkt fokussieren. Das Label ist trotzdem bereits dort angekommen.","warn");
}
focusBtn.addEventListener("click",focusExisting);
closeBtn.addEventListener("click",()=>{
  if(closeAttempt()) return;
  // User-gesture fallback: navigating back is the last web-standard option.
  // It may return to Bluefy's previous page but cannot force the host to remove the tab.
  if(history.length>1){try{history.back();return;}catch(_){}}
  setStatus("Bluefy verhindert das Schließen dieses extern erzeugten Tabs. Bitte den Tab manuell schließen; der Drucktab bleibt verbunden.","warn");
});

const p=params();
const query=p.toString();
const requestId=uuid();
if(!query){setStatus("Keine Label-Daten übergeben.","err");focusBtn.hidden=false;closeBtn.hidden=false;refreshDiagnostics();return;}
const candidate=receiverCandidate();
const message={type:"handoff",requestId,sourceTab:helperTabId,query,ts:Date.now(),targetTab:candidate?.tabId||""};

if("BroadcastChannel" in window){try{channel=new BroadcastChannel(CHANNEL);channel.addEventListener("message",e=>postAckHandler(e.data));}catch(_){channel=null;}}
addEventListener("storage",e=>{if(e.key===ACK_KEY&&e.newValue){try{postAckHandler(JSON.parse(e.newValue));}catch(_){}}});
addEventListener("message",e=>{if(e.origin===location.origin) postAckHandler(e.data);});

refreshDiagnostics();
// Fast path: named print tab. This can focus the old tab without navigating it.
tryNamedWindow(message);
// Primary no-Service-Worker transport.
sendBroadcast(message,!!candidate);
// Stale registry fallback: after a short wait, broadcast to every same-origin receiver.
setTimeout(()=>{if(!acked&&candidate) sendBroadcast({...message,targetTab:""},false);},700);
setTimeout(()=>{
  if(acked) return;
  setStatus("Kein bestehender Drucktab hat geantwortet. Öffne die NIIMBOT-Seite einmal normal in Bluefy und lasse diesen Tab offen.","err");
  focusBtn.hidden=false; closeBtn.hidden=false; refreshDiagnostics();
},2600);
})();