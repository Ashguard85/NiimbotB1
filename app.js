(() => {
  "use strict";
  const APP_VERSION = "1";
  const $ = (id) => document.getElementById(id);
  const els = {};
  let provider;
  let mode = "local";
  let connected = false;
  let activePrinter = null;
  let waitingWorker = null;
  let dirty = false;
  let renderTimer;

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-"+Date.now()+"-"+Math.random().toString(16).slice(2));
  const now = () => new Date().toISOString();

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>els.toast.classList.remove("show"), 2400);
  }

  function status(msg, type="info") {
    els.statusBox.textContent = msg;
    els.statusBox.className = "status " + type;
  }

  function setConnected(on, label) {
    connected = on;
    els.printerDot.classList.toggle("ok", on);
    els.connectLabel.textContent = label || (on ? "B1 verbunden" : "B1 verbinden");
    els.printBtn.disabled = !on || !els.qrText.value.trim();
  }

  function printerGeometry() {
    const p = activePrinter || B1Printer.current();
    return p;
  }

  function utf8ByteLength(s) {
    return new TextEncoder().encode(s).length;
  }

  function drawPlaceholder(ctx, w, h) {
    ctx.fillStyle = "#fff"; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = "#d7dbe1"; ctx.lineWidth = Math.max(1, Math.round(w/384));
    ctx.setLineDash([7,6]); ctx.strokeRect(12,12,w-24,h-24); ctx.setLineDash([]);
    ctx.fillStyle = "#a1a7b0"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.max(15, Math.round(h*0.07))}px system-ui`;
    ctx.fillText("QR-Inhalt eingeben", w/2, h/2);
  }

  function render(immediate=false) {
    clearTimeout(renderTimer);
    const draw = () => {
      const p = printerGeometry();
      const c = els.labelCanvas;
      if (c.width !== p.size.w_px || c.height !== p.size.h_px) {
        c.width = p.size.w_px; c.height = p.size.h_px;
        c.style.aspectRatio = `${p.size.w_px} / ${p.size.h_px}`;
      }
      const ctx = c.getContext("2d", {alpha:false});
      const text = els.qrText.value.trim();
      const caption = els.caption.value.trim();
      if (!text) {
        drawPlaceholder(ctx,c.width,c.height);
        els.renderState.textContent = "bereit";
        els.printBtn.disabled = true;
        return;
      }
      try {
        if (!window.qrcode) throw new Error("QR-Bibliothek nicht geladen.");
        const qr = qrcode(0, els.ecc.value);
        qr.addData(text, "Byte");
        qr.make();
        const n = qr.getModuleCount();
        const margin = Math.max(8, Math.round(c.width * 0.035));
        const captionH = caption ? Math.max(32, Math.round(c.height*0.18)) : 0;
        const maxQr = Math.min(c.width - margin*2, c.height - margin*2 - captionH);
        const modulePx = Math.max(1, Math.floor(maxQr / (n + 8))); // 4 module quiet zone each side
        const qrPx = n * modulePx;
        const quiet = 4 * modulePx;
        const total = qrPx + quiet*2;
        const x0 = Math.round((c.width-total)/2) + quiet;
        const yArea = c.height - captionH;
        const y0 = Math.round((yArea-total)/2) + quiet;

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height);
        ctx.fillStyle = "#000";
        for (let r=0;r<n;r++) for (let col=0;col<n;col++) {
          if (qr.isDark(r,col)) ctx.fillRect(x0+col*modulePx, y0+r*modulePx, modulePx, modulePx);
        }
        if (caption) {
          const maxFont = Math.max(15, Math.floor(c.height*0.085));
          let fs = maxFont;
          ctx.font = `700 ${fs}px system-ui`;
          while (fs > 10 && ctx.measureText(caption).width > c.width-margin*2) {
            fs--; ctx.font = `700 ${fs}px system-ui`;
          }
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle="#000";
          ctx.fillText(caption, c.width/2, c.height-captionH/2);
        }
        if (els.invert.checked) {
          const img=ctx.getImageData(0,0,c.width,c.height);
          for(let i=0;i<img.data.length;i+=4){
            img.data[i]=255-img.data[i]; img.data[i+1]=255-img.data[i+1]; img.data[i+2]=255-img.data[i+2];
          }
          ctx.putImageData(img,0,0);
        }
        els.renderState.textContent = `${n}×${n} · ${utf8ByteLength(text)} B`;
        els.printBtn.disabled = !connected;
      } catch (e) {
        drawPlaceholder(ctx,c.width,c.height);
        els.renderState.textContent = "Fehler";
        status("QR-Code konnte nicht erzeugt werden: " + e.message, "error");
      }
    };
    if (immediate) draw(); else renderTimer = setTimeout(draw, 60);
  }
  async function loadProvider() {
    mode = await LocalStore.getSetting("mode","local");
    document.querySelectorAll('input[name="mode"]').forEach(r=>r.checked=r.value===mode);
    els.modeBadge.textContent = mode === "server" ? "Server" : "Lokal";
    els.serverSettings.classList.toggle("hidden", mode !== "server");
    if (mode === "server") {
      const config = {
        backendUrl: await LocalStore.getSetting("backendUrl",""),
        cfClientId: await LocalStore.getSetting("cfClientId",""),
        cfClientSecret: await LocalStore.getSetting("cfClientSecret","")
      };
      els.backendUrl.value=config.backendUrl;
      els.cfClientId.value=config.cfClientId;
      els.cfClientSecret.value=config.cfClientSecret;
      provider = new DataProviders.ServerProvider(config);
    } else provider = new DataProviders.LocalProvider();
  }

  async function refreshLists() {
    try {
      const [items,hist] = await Promise.all([provider.getItems(), provider.getHistory()]);
      renderItems(items);
      renderHistory(hist.slice(0,10));
    } catch(e) {
      renderItems([]); renderHistory([]);
      status(mode==="server" ? "Serverdaten konnten nicht geladen werden: "+e.message : "Lokale Daten konnten nicht geladen werden: "+e.message, "warn");
    }
  }

  function renderItems(items) {
    els.presetList.innerHTML="";
    els.presetList.classList.toggle("empty", !items.length);
    if (!items.length) { els.presetList.textContent="Noch keine Vorlagen."; return; }
    for (const item of items) {
      const row=document.createElement("div"); row.className="list-item";
      const text=document.createElement("div");
      const strong=document.createElement("strong"); strong.textContent=item.name || "Vorlage";
      const small=document.createElement("small"); small.textContent=item.qr_text || "";
      text.append(strong,small);
      const actions=document.createElement("div"); actions.className="mini-actions";
      const use=document.createElement("button"); use.className="mini"; use.type="button"; use.textContent="Laden";
      use.addEventListener("click",()=>{ applyItem(item); toast("Vorlage geladen"); });
      const del=document.createElement("button"); del.className="mini"; del.type="button"; del.textContent="×";
      del.setAttribute("aria-label","Vorlage löschen");
      del.addEventListener("click",async()=>{ if(confirm("Vorlage wirklich löschen?")){ await provider.deleteItem(item.id); await refreshLists(); }});
      actions.append(use,del); row.append(text,actions); els.presetList.append(row);
    }
  }

  function renderHistory(items) {
    els.historyList.innerHTML="";
    els.historyList.classList.toggle("empty", !items.length);
    if (!items.length) { els.historyList.textContent="Noch keine Drucke."; return; }
    for (const item of items) {
      const row=document.createElement("div"); row.className="list-item";
      const text=document.createElement("div");
      const strong=document.createElement("strong");
      strong.textContent = `${item.printer || "B1"} · ${item.copies || 1}×`;
      const small=document.createElement("small");
      small.textContent = `${new Date(item.created_at).toLocaleString()} · ${item.qr_text || ""}`;
      text.append(strong,small); row.append(text); els.historyList.append(row);
    }
  }

  function applyItem(item) {
    els.qrText.value=item.qr_text || "";
    els.caption.value=item.caption || "";
    els.ecc.value=item.ecc || "M";
    els.density.value=item.density || 3; els.densityOut.value=els.density.value;
    els.offsetY.value = item.offset_y ?? printerGeometry().size.offset_y_px ?? 0;
    render();
  }

  async function savePreset() {
    const qr=els.qrText.value.trim();
    if(!qr){ toast("Zuerst QR-Inhalt eingeben"); return; }
    const name = prompt("Name der Vorlage:", els.caption.value.trim() || "QR Label");
    if(!name) return;
    const t=now();
    const item={
      id:uuid(), name, qr_text:qr, caption:els.caption.value.trim(), ecc:els.ecc.value,
      density:Number(els.density.value), offset_y:Number(els.offsetY.value),
      created_at:t, updated_at:t
    };
    await provider.createItem(item); await refreshLists(); toast("Vorlage gespeichert");
  }

  function canvasDataUrl(){ render(true); return els.labelCanvas.toDataURL("image/png"); }
  async function canvasBlob() {
    return new Promise((resolve,reject)=>els.labelCanvas.toBlob(b=>b?resolve(b):reject(new Error("PNG konnte nicht erstellt werden.")),"image/png"));
  }

  async function connectPrinter() {
    try {
      els.connectBtn.disabled=true; status("Bluetooth-Gerät auswählen …","info");
      activePrinter=await B1Printer.connect();
      setConnected(true, activePrinter.name.replace("NIIMBOT ","")+" verbunden");
      els.labelInfo.textContent=`${activePrinter.name.replace("NIIMBOT ","")} · 50 × 30 mm · ${activePrinter.size.w_px} × ${activePrinter.size.h_px} px`;
      els.offsetY.value=activePrinter.size.offset_y_px || 0;
      render();
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
      const extra = ios && activePrinter.id===4096 ? " B1 + iOS/Bluefy ist in dieser v1 ein Hardware-Testpunkt." : "";
      status(`${activePrinter.name} erkannt. Bereit zum Drucken.${extra}`,"ok");
    } catch(e) {
      setConnected(false);
      status("Verbindung fehlgeschlagen: "+e.message,"error");
    } finally { els.connectBtn.disabled=false; }
  }

  async function printLabel() {
    const qr=els.qrText.value.trim();
    if(!qr || !connected) return;
    try {
      dirty=true; els.printBtn.disabled=true; els.connectBtn.disabled=true;
      render(true);
      status("Druckdaten werden übertragen …","info");
      const dataUrl=els.labelCanvas.toDataURL("image/png");
      await B1Printer.print(dataUrl,{
        density:Number(els.density.value),
        copies:Number(els.copies.value),
        offsetY:Number(els.offsetY.value),
        onProgress:(s)=>status(typeof s==="string" ? s : "Druck läuft …","info")
      });
      const entry={
        id:uuid(), qr_text:qr, caption:els.caption.value.trim(), printer:activePrinter?.name || "NIIMBOT",
        copies:Number(els.copies.value), density:Number(els.density.value), created_at:now()
      };
      try { await provider.addHistory(entry); await refreshLists(); } catch(_){}
      status("Druckauftrag vom Drucker bestätigt.","ok"); toast("Gedruckt");
    } catch(e) {
      status("Druckfehler: "+e.message+" – falls bereits Papier ausgegeben wurde, Druckbild prüfen.","error");
    } finally {
      dirty=false; els.connectBtn.disabled=false; els.printBtn.disabled=!connected || !els.qrText.value.trim();
    }
  }

  async function sharePng() {
    try {
      render(true);
      const blob=await canvasBlob();
      const file=new File([blob],"qr-label.png",{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({files:[file],title:"QR Label"});
      } else downloadBlob(blob,"qr-label.png");
    } catch(e){ if(e.name!=="AbortError") status("Teilen fehlgeschlagen: "+e.message,"warn"); }
  }
  function downloadBlob(blob,name) {
    const a=document.createElement("a"); const u=URL.createObjectURL(blob);
    a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
  }

  async function exportBackup() {
    try {
      const payload=await provider.exportData();
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const name=`qr-label-backup-${new Date().toISOString().slice(0,10)}.json`;
      if(navigator.canShare) {
        const f=new File([blob],name,{type:"application/json"});
        if(navigator.canShare({files:[f]})){ await navigator.share({files:[f],title:"QR Label Backup"}); return; }
      }
      downloadBlob(blob,name);
    } catch(e){ status("Backup fehlgeschlagen: "+e.message,"error"); }
  }

  async function importBackup(file) {
    try {
      const payload=JSON.parse(await file.text());
      if(payload.format!=="qr-label-backup" || payload.version!==1) throw new Error("Unbekanntes Backup-Format.");
      const ni=payload.data?.items?.length||0, nh=payload.data?.history?.length||0;
      const replace=confirm(`Backup enthält ${ni} Vorlagen und ${nh} Verlaufseinträge.\n\nOK = bestehende Daten ERSETZEN\nAbbrechen = zusammenführen`);
      if(!replace && !confirm("Backup mit bestehenden Daten zusammenführen?")) return;
      await provider.importData(payload, replace ? "replace" : "merge");
      await refreshLists(); toast("Backup importiert");
    } catch(e){ status("Import fehlgeschlagen: "+e.message,"error"); }
  }

  async function saveServerSettings() {
    const url=els.backendUrl.value.trim().replace(/\/+$/,"");
    if(url && !/^https:\/\//i.test(url) && !/^http:\/\/localhost(?::\d+)?$/i.test(url)){
      status("Backend URL muss HTTPS verwenden.","error"); return;
    }
    await LocalStore.setSetting("backendUrl",url);
    await LocalStore.setSetting("cfClientId",els.cfClientId.value.trim());
    await LocalStore.setSetting("cfClientSecret",els.cfClientSecret.value);
    await loadProvider(); await refreshLists(); toast("Serverzugang gespeichert");
  }

  async function clearServerSettings() {
    for(const k of ["backendUrl","cfClientId","cfClientSecret"]) await LocalStore.deleteSetting(k);
    els.backendUrl.value=els.cfClientId.value=els.cfClientSecret.value="";
    await loadProvider(); toast("Serverzugang gelöscht");
  }

  async function changeMode(value) {
    if(value===mode) return;
    const ok=confirm(`Zu ${value==="server"?"Server":"Lokal"} wechseln?\n\nDabei werden keine Daten automatisch übertragen oder synchronisiert. Es wird nur der aktive Datenspeicher gewechselt.`);
    if(!ok){ document.querySelector(`input[name="mode"][value="${mode}"]`).checked=true; return; }
    await LocalStore.setSetting("mode",value); await loadProvider(); await refreshLists();
  }

  async function testServer() {
    try { await saveServerSettings(); const h=await provider.health(); status("Server erreichbar: "+(h.status||"ok"),"ok"); }
    catch(e){ status("Server nicht erreichbar: "+e.message,"error"); }
  }

  function browserMessage() {
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
    if(B1Printer.supported()){
      status(ios ? "Web Bluetooth ist verfügbar – wahrscheinlich über Bluefy/WebBLE. B1 einschalten und verbinden." : "Web Bluetooth verfügbar. B1 einschalten und verbinden.","ok");
    } else if(ios) {
      status("iPhone/iPad erkannt: Safari/Chrome können den B1 nicht direkt ansprechen. Öffne diese Seite in Bluefy.","warn");
    } else {
      status("Web Bluetooth nicht verfügbar. Verwende auf Android Chrome/Edge/Samsung Internet oder auf Desktop Chrome/Edge.","warn");
    }
  }

  async function registerSW() {
    if(!("serviceWorker" in navigator)) return;
    try{
      const reg=await navigator.serviceWorker.register("./service-worker.js");
      if(reg.waiting){ waitingWorker=reg.waiting; showUpdate(); }
      reg.addEventListener("updatefound",()=>{
        const nw=reg.installing;
        nw?.addEventListener("statechange",()=>{
          if(nw.state==="installed" && navigator.serviceWorker.controller){ waitingWorker=nw; showUpdate(); }
        });
      });
      navigator.serviceWorker.addEventListener("message",e=>{
        if(e.data?.type==="VERSION") els.updateStatus.textContent=`v${APP_VERSION} · Cache ${e.data.version}`;
      });
      navigator.serviceWorker.addEventListener("controllerchange",()=>{
        if(sessionStorage.getItem("qr-label-reloaded")==="1") return;
        sessionStorage.setItem("qr-label-reloaded","1");
        if(!dirty) location.reload();
      });
      if(reg.active) reg.active.postMessage({type:"GET_VERSION"});
    }catch(e){ els.updateStatus.textContent="Service Worker Fehler"; }
  }
  function showUpdate(){
    els.updateStatus.textContent=`v${APP_VERSION} · neue Version bereit`;
    els.updateBtn.classList.remove("hidden");
  }
  function applyUpdate(){
    if(!waitingWorker) return;
    if(dirty){ toast("Aktualisierung erst nach Abschluss der laufenden Aktion"); return; }
    sessionStorage.removeItem("qr-label-reloaded");
    waitingWorker.postMessage({type:"SKIP_WAITING"});
  }

  async function init() {
    ["toast","statusBox","printerDot","connectBtn","connectLabel","printBtn","qrText","caption","ecc","labelCanvas","labelInfo","renderState",
     "density","densityOut","copies","offsetY","invert","savePresetBtn","presetList","historyList","refreshItemsBtn","shareBtn","savePngBtn",
     "modeBadge","serverSettings","backendUrl","cfClientId","cfClientSecret","testServerBtn","saveServerBtn","clearServerBtn",
     "exportBtn","importFile","updateStatus","updateBtn","appVersion","onlineState"].forEach(id=>els[id]=$(id));
    els.appVersion.textContent="v"+APP_VERSION;
    els.qrText.value=await LocalStore.getSetting("draftQr","");
    els.caption.value=await LocalStore.getSetting("draftCaption","");
    els.density.value=await LocalStore.getSetting("density",3); els.densityOut.value=els.density.value;
    els.copies.value=await LocalStore.getSetting("copies",1);
    els.offsetY.value=await LocalStore.getSetting("offsetY",4);
    await loadProvider();

    ["qrText","caption","ecc","invert"].forEach(id=>els[id].addEventListener("input",()=>{ dirty=true; render(); }));
    els.qrText.addEventListener("input",()=>LocalStore.setSetting("draftQr",els.qrText.value));
    els.caption.addEventListener("input",()=>LocalStore.setSetting("draftCaption",els.caption.value));
    els.density.addEventListener("input",()=>{ els.densityOut.value=els.density.value; LocalStore.setSetting("density",Number(els.density.value)); });
    els.copies.addEventListener("change",()=>LocalStore.setSetting("copies",Number(els.copies.value)));
    els.offsetY.addEventListener("change",()=>LocalStore.setSetting("offsetY",Number(els.offsetY.value)));
    els.connectBtn.addEventListener("click",connectPrinter);
    els.printBtn.addEventListener("click",printLabel);
    els.shareBtn.addEventListener("click",sharePng);
    els.savePngBtn.addEventListener("click",async()=>{ render(true); downloadBlob(await canvasBlob(),"qr-label.png"); });
    els.savePresetBtn.addEventListener("click",savePreset);
    els.refreshItemsBtn.addEventListener("click",refreshLists);
    document.querySelectorAll('input[name="mode"]').forEach(r=>r.addEventListener("change",()=>changeMode(r.value)));
    els.modeBadge.addEventListener("click",()=>document.querySelector("details[open]")?.scrollIntoView({behavior:"smooth"}));
    els.testServerBtn.addEventListener("click",testServer);
    els.saveServerBtn.addEventListener("click",saveServerSettings);
    els.clearServerBtn.addEventListener("click",clearServerSettings);
    els.exportBtn.addEventListener("click",exportBackup);
    els.importFile.addEventListener("change",()=>{ const f=els.importFile.files?.[0]; if(f) importBackup(f).finally(()=>els.importFile.value=""); });
    els.updateBtn.addEventListener("click",applyUpdate);

    const online=()=>{ els.onlineState.textContent=navigator.onLine?"online":"offline"; };
    addEventListener("online",online); addEventListener("offline",online); online();

    render(); browserMessage(); await refreshLists(); registerSW();
    setTimeout(()=>{ dirty=false; },200);
  }
  addEventListener("DOMContentLoaded", init);
})();
