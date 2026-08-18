(()=>{"use strict";
const CHANNEL="niimbot-qr-handoff-v1";
const STORAGE_KEY="niimbotQrHandoffV1";
const ACK_KEY="niimbotQrHandoffAckV1";
const RECEIVER_PREFIX="niimbotQrReceiverV2:";
const INBOX_PREFIX="niimbotQrInboxV1:";
const PRIMARY_PRINTER_TAB_KEY="niimbotQrPrimaryPrinterTabV1";
const LOCK_PREFIX="niimbotQrHandoffLockV1:";
const PRINT_WINDOW_NAME="niimbot-print";
const statusEl=document.getElementById("status");
const focusBtn=document.getElementById("focusTab");
const closeBtn=document.getElementById("closeTab");
const diagEl=document.getElementById("diagnostics");
const workingUi=document.getElementById("workingUi");
const doneUi=document.getElementById("doneUi");
const uuid=()=>crypto.randomUUID?crypto.randomUUID():"handoff-"+Date.now()+"-"+Math.random().toString(16).slice(2);
const helperTabId=uuid();
let channel=null, acked=false, directTarget=null, closeTimers=[], lockKey="";

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

function receiverCandidate(){
  if(!storageOK) return null;
  const now=Date.now(); let best=null; const stale=[]; let primaryTabId="";
  try{const primary=JSON.parse(localStorage.getItem(PRIMARY_PRINTER_TAB_KEY)||"{}");if(primary.tabId&&now-Number(primary.ts||0)<12*60*60*1000)primaryTabId=primary.tabId;}catch(_){}
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(!k?.startsWith(RECEIVER_PREFIX)) continue;
      let v; try{v=JSON.parse(localStorage.getItem(k)||"{}");}catch(_){stale.push(k);continue;}
      const age=now-Number(v.ts||0);
      if(!v?.tabId || age>90000){stale.push(k);continue;}
      const score=(v.tabId===primaryTabId?100000000:0)+(v.connected?1000000:0)+(v.focused?10000:0)+(v.visible?5000:0)+Math.max(0,90000-age);
      if(!best||score>best.score) best={...v,ageMs:age,score};
    }
    for(const k of stale) try{localStorage.removeItem(k);}catch(_){}
  }catch(_){}
  if(!best && primaryTabId) return {tabId:primaryTabId,connected:true,persistentPrimary:true,score:100000000};
  return best;
}

function diagnostics(){
  const handlers=[]; try{const h=window.webkit?.messageHandlers;if(h) handlers.push(...Object.keys(h));}catch(_){}
  const native=[]; try{if(window.BLENative) native.push(...Object.keys(window.BLENative));}catch(_){}
  const receivers=[];
  if(storageOK){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith(RECEIVER_PREFIX))continue;try{const v=JSON.parse(localStorage.getItem(k)||"{}");receivers.push(`${v.tabId||k.slice(RECEIVER_PREFIX.length)} connected=${!!v.connected} visible=${!!v.visible} focused=${!!v.focused} age=${Math.max(0,Math.round((Date.now()-(v.ts||0))/1000))}s`);}catch(_){}}}catch(_){}}
  return [
    `Handoff-Handler: v26 transactional`,
    `BroadcastChannel: ${"BroadcastChannel" in window?"ja":"nein"}`,
    `localStorage: ${storageOK?"ja":"nein"}`,
    `history.length: ${history.length}`,
    `window.opener: ${window.opener?"ja":"nein"}`,
    `webkit.messageHandlers: ${handlers.length?handlers.join(", "):"keine sichtbaren"}`,
    `BLENative: ${native.length?native.join(", "):"nicht sichtbar / keine enumerierbaren Methoden"}`,
    `Empfänger: ${receivers.length?receivers.join(" | "):"keine Registry gefunden"}`
  ].join("\n");
}
function refreshDiagnostics(){diagEl.textContent=diagnostics();}

function acquireLock(tabId,requestId){
  if(!storageOK||!tabId) return true;
  lockKey=LOCK_PREFIX+tabId;
  try{
    const now=Date.now();
    const old=JSON.parse(localStorage.getItem(lockKey)||"{}");
    if(old.requestId && now-Number(old.ts||0)<8000) return false;
    localStorage.setItem(lockKey,JSON.stringify({requestId,helperTabId,ts:now}));
    return true;
  }catch(_){return true;}
}
function releaseLock(requestId){
  if(!storageOK||!lockKey) return;
  try{const x=JSON.parse(localStorage.getItem(lockKey)||"{}");if(!x.requestId||x.requestId===requestId)localStorage.removeItem(lockKey);}catch(_){}
}

function enqueueForTarget(tabId,message){
  if(!storageOK||!tabId||!message?.requestId) return false;
  try{
    const key=INBOX_PREFIX+tabId;
    let q=[]; try{const p=JSON.parse(localStorage.getItem(key)||"[]");if(Array.isArray(p))q=p;}catch(_){}
    q=q.filter(x=>x?.requestId&&x.requestId!==message.requestId).slice(-29);
    q.push({...message,targetTab:tabId,queuedAt:Date.now()});
    localStorage.setItem(key,JSON.stringify(q));
    return true;
  }catch(_){return false;}
}

function tryNamedWindow(message){
  try{
    const w=window.open("",PRINT_WINDOW_NAME); if(!w) return false;
    let marker=false; try{marker=w.__NIIMBOT_HANDOFF_RECEIVER__===true;}catch(_){}
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
  if(storageOK){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(m));}catch(_) {}}
}

function nativeCloseAttempt(){
  const names=["closeTab","dismissTab","closeWindow","dismissWindow","closeWebView","dismissWebView","close","dismiss"];
  try{const h=window.webkit?.messageHandlers;for(const n of names){if(h?.[n]?.postMessage){try{h[n].postMessage({reason:"handoff-complete"});return true;}catch(_){}}}}catch(_){}
  try{const b=window.BLENative;for(const n of names){if(typeof b?.[n]==="function"){try{b[n]();return true;}catch(_){}}}}catch(_){}
  return false;
}
function closeAttempt(){
  nativeCloseAttempt();
  const fns=[
    ()=>window.close(),
    ()=>self.close(),
    ()=>top.close(),
    ()=>window.open("","_self")?.close(),
    ()=>window.open("","_top")?.close(),
    ()=>window.open(location.href,"_self")?.close()
  ];
  for(const fn of fns){try{fn();}catch(_){} if(window.closed)return true;}
  return !!window.closed;
}
function focusTarget(){
  let ok=false;
  const w=directTarget||(()=>{try{return window.open("",PRINT_WINDOW_NAME);}catch(_){return null;}})();
  if(w){try{w.postMessage({type:"NIIMBOT_FOCUS_REQUEST",ts:Date.now()},location.origin);}catch(_){};try{w.focus();ok=true;}catch(_){};}
  return ok;
}
function settleHelper(){
  // Scrub all transferred label data from the helper URL and DOM.
  try{history.replaceState(null,"",location.pathname+"#done");}catch(_){}
  document.title="Label übernommen · NIIMBOT";
  try{workingUi.hidden=true;doneUi.hidden=false;}catch(_){}
}
function bestEffortReturnAndClose(){
  closeTimers.forEach(clearTimeout); closeTimers=[];
  const schedule=[0,80,180,350,700,1200,2000];
  schedule.forEach(ms=>closeTimers.push(setTimeout(()=>{
    focusTarget();
    if(closeAttempt()) return;
    if(ms===2000){
      settleHelper();
    }
  },ms)));
}

function postAckHandler(m){
  if(!m||m.requestId!==requestId) return;
  if(m.type!=="ack"&&m.type!=="NIIMBOT_HANDOFF_ACK") return;
  if(message.targetTab && m.receiverTab && m.receiverTab!==message.targetTab) return;
  if(acked) return;
  acked=true; releaseLock(requestId);
  settleHelper();
  bestEffortReturnAndClose();
}

focusBtn.addEventListener("click",()=>{
  focusTarget();
  setTimeout(()=>{if(!document.hidden)setStatus("Bluefy hat den sichtbaren Tabwechsel nicht zugelassen. Das Label befindet sich trotzdem im verbundenen Drucktab.","warn");},250);
});
closeBtn.addEventListener("click",()=>{
  focusTarget();
  if(closeAttempt()) return;
  if(history.length>1){try{history.back();return;}catch(_) {}}
  settleHelper();
  setStatus("Bluefy verhindert das Schließen dieses Tabs. Bitte nur diesen Hilfstab manuell schließen; die Druckerverbindung bleibt bestehen.","warn");
});

const p=params(); const query=p.toString(); const requestId=uuid(); const candidate=receiverCandidate();
const message={type:"handoff",requestId,sourceTab:helperTabId,query,ts:Date.now(),targetTab:candidate?.tabId||""};
if(!query){setStatus("Keine Label-Daten übergeben.","err");focusBtn.hidden=false;closeBtn.hidden=false;refreshDiagnostics();return;}
if(candidate?.tabId && !acquireLock(candidate.tabId,requestId)){
  setStatus("Eine vorherige Übergabe läuft noch. Einen Moment warten und erneut versuchen.","warn");focusBtn.hidden=false;closeBtn.hidden=false;refreshDiagnostics();return;
}
if("BroadcastChannel" in window){try{channel=new BroadcastChannel(CHANNEL);channel.addEventListener("message",e=>postAckHandler(e.data));}catch(_){channel=null;}}
addEventListener("storage",e=>{if(e.key===ACK_KEY&&e.newValue){try{postAckHandler(JSON.parse(e.newValue));}catch(_){}}});
addEventListener("message",e=>{if(e.origin===location.origin)postAckHandler(e.data);});
addEventListener("pagehide",()=>releaseLock(requestId),{once:true});
refreshDiagnostics();
setStatus(candidate?.connected?"Verbundenen Drucktab gefunden. Label wird übertragen …":"Drucktab gefunden. Label wird übertragen …","info");
if(candidate?.tabId) enqueueForTarget(candidate.tabId,message);
tryNamedWindow(message);
sendBroadcast(message,!!candidate);
setTimeout(()=>{if(!acked&&candidate)sendBroadcast({...message,targetTab:""},false);},600);
setTimeout(()=>{if(!acked&&candidate?.tabId){enqueueForTarget(candidate.tabId,message);sendBroadcast(message,true);}},1500);
setTimeout(()=>{
  if(acked)return;
  releaseLock(requestId);
  setStatus(candidate?.tabId?"Übergabe ist im Postfach des verbundenen Drucktabs vorgemerkt. Sobald Bluefy ihn wieder ausführt, wird das Label übernommen.":"Kein verbundener Drucktab gefunden. NIIMBOT-Seite einmal normal öffnen und Drucker verbinden.",candidate?.tabId?"warn":"err");
  focusBtn.hidden=false;closeBtn.hidden=false;refreshDiagnostics();
},4000);
})();
