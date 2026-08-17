(() => {
  "use strict";
  const APP_VERSION = "5";
  const $ = (id) => document.getElementById(id);
  const els = {};
  let provider;
  let mode = "local";
  let connected = false;
  let activePrinter = null;
  let waitingWorker = null;
  let dirty = false;
  let renderTimer;
  let shortcutAutoprint = false;
  let shortcutNotice = "";
  let quickChartReferenceSize = 0;

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-"+Date.now()+"-"+Math.random().toString(16).slice(2));
  const now = () => new Date().toISOString();
  const validLabelSizes = new Set(Object.keys(B1Printer.LABEL_PRESETS || {"40x40":1,"50x30":1}));

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
    return activePrinter || B1Printer.current();
  }

  function updateGeometryUi({resetOffset=false}={}) {
    const p = printerGeometry();
    const size = p.size;
    const validation = size.validated ? "kalibriert" : "abgeleitet";
    els.labelInfo.textContent = `${p.name.replace("NIIMBOT ","")} · ${size.w_mm} × ${size.h_mm} mm · ${size.w_px} × ${size.h_px} px · ${validation}`;
    if (resetOffset) {
      els.offsetY.value = size.offset_y_px ?? 0;
      LocalStore.setSetting("offsetY", Number(els.offsetY.value));
    }
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

  function captionFontPx(canvas, caption) {
    const pct = Math.max(0, Math.min(25, Number(els.captionScale.value) || 0));
    let fs = pct > 0 ? Math.round(canvas.width * pct / 100) : Math.max(15, Math.floor(canvas.height * 0.085));
    fs = Math.max(10, Math.min(Math.round(canvas.height*0.22), fs));
    return fs;
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
      updateGeometryUi();
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
        let fs = caption ? captionFontPx(c, caption) : 0;
        const captionH = caption ? Math.max(Math.round(c.height*0.15), Math.ceil(fs*1.45)+4) : 0;
        const maxQr = Math.min(c.width - margin*2, c.height - margin*2 - captionH);
        const modulePx = Math.max(1, Math.floor(maxQr / (n + 8)));
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

  function isQuickChartQrUrl(value) {
    try {
      const u = new URL(String(value).trim());
      return /(^|\.)quickchart\.io$/i.test(u.hostname) && /^\/qr\/?$/i.test(u.pathname);
    } catch (_) { return false; }
  }

  function parseQuickChart(value) {
    if (!isQuickChartQrUrl(value)) return null;
    const u = new URL(String(value).trim());
    const p = u.searchParams;
    const text = p.get("text");
    if (!text) throw new Error("QuickChart-Link enthält keinen text=-Parameter.");
    const caption = p.get("caption");
    const ec = String(p.get("ecLevel") || p.get("ecc") || "").toUpperCase();
    const refSize = Number.parseFloat(p.get("size") || "");
    const fontSize = Number.parseFloat(p.get("captionFontSize") || "");
    let captionPct = null;
    if (Number.isFinite(refSize) && refSize > 0 && Number.isFinite(fontSize) && fontSize > 0) {
      captionPct = Math.max(1, Math.min(25, (fontSize / refSize) * 100));
    }
    return { text, caption, ecLevel:["L","M","Q","H"].includes(ec) ? ec : null, refSize, fontSize, captionPct };
  }

  async function importQuickChartFromValue(value, {announce=true}={}) {
    let parsed;
    try { parsed = parseQuickChart(value); }
    catch(e) { if(announce) status("QuickChart-Link konnte nicht übernommen werden: "+e.message,"error"); return false; }
    if (!parsed) return false;
    els.qrText.value = parsed.text;
    if (parsed.caption !== null) els.caption.value = parsed.caption;
    if (parsed.ecLevel) els.ecc.value = parsed.ecLevel;
    if (parsed.captionPct !== null) els.captionScale.value = parsed.captionPct.toFixed(1).replace(/\.0$/,"");
    quickChartReferenceSize = Number.isFinite(parsed.refSize) ? parsed.refSize : 0;
    await LocalStore.setSetting("draftQr", els.qrText.value);
    await LocalStore.setSetting("draftCaption", els.caption.value);
    await LocalStore.setSetting("captionScale", Number(els.captionScale.value)||0);
    render(true);
    if (announce) {
      const fontInfo = parsed.captionPct !== null ? ` · Caption ${els.captionScale.value}%` : "";
      status(`QuickChart übernommen: QR-Ziel${parsed.caption!==null?" + Caption":""}${fontInfo}. Labelformat bleibt ${els.labelSize.value.replace("x","×")} mm.`,"ok");
      toast("QuickChart übernommen");
    }
    return true;
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
      renderItems(items); renderHistory(hist.slice(0,10));
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
      const small=document.createElement("small"); small.textContent=`${item.label_size || "50x30"} · ${item.qr_text || ""}`;
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
      strong.textContent = `${item.printer || "B1"} · ${(item.label_size || "50x30").replace("x","×")} · ${item.copies || 1}×`;
      const small=document.createElement("small");
      small.textContent = `${new Date(item.created_at).toLocaleString()} · ${item.qr_text || ""}`;
      text.append(strong,small); row.append(text); els.historyList.append(row);
    }
  }

  function setLabelSize(key, {persist=true, resetOffset=true}={}) {
    if (!validLabelSizes.has(key)) key="40x40";
    els.labelSize.value=key;
    activePrinter=B1Printer.setSize(key);
    if (persist) LocalStore.setSetting("labelSize",key);
    updateGeometryUi({resetOffset});
    render(true);
    const g=printerGeometry().size;
    if (!g.validated) status(`${g.w_mm}×${g.h_mm} mm ist für ${printerGeometry().name} abgeleitet. Bei Bedarf Vertikal-Offset nach Testdruck feinjustieren.`,"warn");
  }

  function applyItem(item) {
    els.qrText.value=item.qr_text || "";
    els.caption.value=item.caption || "";
    els.ecc.value=item.ecc || "M";
    els.density.value=item.density || 3; els.densityOut.value=els.density.value;
    els.captionScale.value = Number(item.caption_scale || 0);
    setLabelSize(validLabelSizes.has(item.label_size) ? item.label_size : "50x30", {persist:true,resetOffset:false});
    els.offsetY.value = item.offset_y ?? printerGeometry().size.offset_y_px ?? 0;
    render(true);
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
      label_size:els.labelSize.value, caption_scale:Number(els.captionScale.value)||0,
      created_at:t, updated_at:t
    };
    await provider.createItem(item); await refreshLists(); toast("Vorlage gespeichert");
  }

  async function canvasBlob() {
    render(true);
    return new Promise((resolve,reject)=>els.labelCanvas.toBlob(b=>b?resolve(b):reject(new Error("PNG konnte nicht erstellt werden.")),"image/png"));
  }

  function asciiBytes(text) { return new TextEncoder().encode(text); }

  function concatBytes(parts) {
    const total=parts.reduce((n,p)=>n+p.length,0);
    const out=new Uint8Array(total); let offset=0;
    for(const part of parts){ out.set(part,offset); offset+=part.length; }
    return out;
  }

  function pdfBlobFromCanvas() {
    render(true);
    const c=els.labelCanvas;
    const ctx=c.getContext("2d",{alpha:false});
    const rgba=ctx.getImageData(0,0,c.width,c.height).data;
    const rgb=new Uint8Array(c.width*c.height*3);
    for(let i=0,j=0;i<rgba.length;i+=4){
      const a=rgba[i+3]/255;
      rgb[j++]=Math.round(rgba[i]*a+255*(1-a));
      rgb[j++]=Math.round(rgba[i+1]*a+255*(1-a));
      rgb[j++]=Math.round(rgba[i+2]*a+255*(1-a));
    }

    const g=printerGeometry().size;
    const wPt=(Number(g.w_mm)*72/25.4);
    const hPt=(Number(g.h_mm)*72/25.4);
    const pageW=wPt.toFixed(4), pageH=hPt.toFixed(4);
    const content=asciiBytes(`q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`);
    const objects=[
      asciiBytes("<< /Type /Catalog /Pages 2 0 R >>"),
      asciiBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
      asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
      concatBytes([asciiBytes(`<< /Length ${content.length} >>\nstream\n`),content,asciiBytes("endstream")]),
      concatBytes([asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgb.length} >>\nstream\n`),rgb,asciiBytes("\nendstream")])
    ];

    const parts=[asciiBytes("%PDF-1.4\n%QRLabel\n")];
    const offsets=[0]; let pos=parts[0].length;
    objects.forEach((obj,idx)=>{
      offsets[idx+1]=pos;
      const head=asciiBytes(`${idx+1} 0 obj\n`), tail=asciiBytes("\nendobj\n");
      parts.push(head,obj,tail); pos+=head.length+obj.length+tail.length;
    });
    const xrefPos=pos;
    let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    for(let i=1;i<=objects.length;i++) xref+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
    xref+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
    parts.push(asciiBytes(xref));
    return new Blob([concatBytes(parts)],{type:"application/pdf"});
  }

  async function savePdf() {
    try {
      const blob=pdfBlobFromCanvas();
      const name=`qr-label-${els.labelSize.value}.pdf`;
      const file=new File([blob],name,{type:"application/pdf"});
      if(navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({files:[file],title:`QR Label ${printerGeometry().size.w_mm}×${printerGeometry().size.h_mm} mm`});
      } else downloadBlob(blob,name);
      toast(`PDF ${printerGeometry().size.w_mm}×${printerGeometry().size.h_mm} mm bereit`);
    } catch(e) { if(e.name!=="AbortError") status("PDF konnte nicht erstellt werden: "+e.message,"error"); }
  }

  async function connectPrinter() {
    try {
      els.connectBtn.disabled=true; status("Bluetooth-Gerät auswählen …","info");
      activePrinter=await B1Printer.connect();
      activePrinter=B1Printer.setSize(els.labelSize.value);
      setConnected(true, activePrinter.name.replace("NIIMBOT ","")+" verbunden");
      updateGeometryUi({resetOffset:false});
      render(true);
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
      const derived = !activePrinter.size.validated ? ` ${activePrinter.size.w_mm}×${activePrinter.size.h_mm} ist eine abgeleitete Geometrie; Offset bei Bedarf feinjustieren.` : "";
      const extra = ios && activePrinter.id===4096 ? " B1 + iOS/Bluefy bleibt ein Hardware-Testpunkt." : "";
      status(`${activePrinter.name} erkannt. Bereit zum Drucken.${derived}${extra}`, activePrinter.size.validated ? "ok" : "warn");
      if (shortcutAutoprint && els.qrText.value.trim()) {
        shortcutAutoprint = false;
        await printLabel();
      }
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
        density:Number(els.density.value), copies:Number(els.copies.value), offsetY:Number(els.offsetY.value),
        onProgress:(s)=>status(typeof s==="string" ? s : "Druck läuft …","info")
      });
      const entry={
        id:uuid(), qr_text:qr, caption:els.caption.value.trim(), printer:activePrinter?.name || "NIIMBOT",
        label_size:els.labelSize.value, copies:Number(els.copies.value), density:Number(els.density.value), created_at:now()
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
      const blob=await canvasBlob();
      const file=new File([blob],`qr-label-${els.labelSize.value}.png`,{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})) await navigator.share({files:[file],title:"QR Label"});
      else downloadBlob(blob,file.name);
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
      if(payload.format!=="qr-label-backup" || ![1,2].includes(Number(payload.version))) throw new Error("Unbekanntes Backup-Format.");
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

  function shortcutParams() {
    const merged = new URLSearchParams(location.search);
    let hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    if (hash.startsWith("?")) hash = hash.slice(1);
    if (hash && hash.includes("=")) for (const [k,v] of new URLSearchParams(hash)) merged.set(k,v);
    return merged;
  }

  function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  async function applyShortcutParams({announce=true}={}) {
    shortcutNotice = "";
    const params = shortcutParams();
    if (![...params.keys()].length) return false;
    let changed = false;

    const source = params.get("quickchart") ?? params.get("source");
    if (source !== null) {
      if (isQuickChartQrUrl(source)) changed = await importQuickChartFromValue(source,{announce:false}) || changed;
      else { els.qrText.value=source; changed=true; }
    } else {
      const qr = params.get("qr");
      const caption = params.get("text") ?? params.get("caption");
      if (qr !== null) {
        if (isQuickChartQrUrl(qr)) changed = await importQuickChartFromValue(qr,{announce:false}) || changed;
        else { els.qrText.value = qr; changed = true; }
      }
      if (caption !== null && !isQuickChartQrUrl(qr || "")) { els.caption.value = caption; changed = true; }
    }

    if (params.has("copies")) { els.copies.value = String(clampInt(params.get("copies"),1,20,1)); changed = true; }
    if (params.has("density")) { els.density.value = String(clampInt(params.get("density"),1,5,3)); els.densityOut.value = els.density.value; changed = true; }
    if (params.has("offset")) { els.offsetY.value = String(clampInt(params.get("offset"),-60,60,Number(els.offsetY.value)||0)); changed = true; }
    if (params.has("ecc")) {
      const ecc = String(params.get("ecc")||"").toUpperCase();
      if (["L","M","Q","H"].includes(ecc)) { els.ecc.value=ecc; changed=true; }
    }
    const sizeParam = String(params.get("label") ?? params.get("size") ?? "").toLowerCase().replace("×","x");
    if (sizeParam) {
      if (validLabelSizes.has(sizeParam)) { setLabelSize(sizeParam,{persist:false,resetOffset:!params.has("offset")}); changed=true; }
      else { shortcutNotice = `Labelformat ${sizeParam} wird nicht unterstützt. Verfügbar: ${[...validLabelSizes].join(", ")}.`; changed=true; }
    }
    if (params.has("captionpct")) {
      const pct=Math.max(0,Math.min(25,Number(params.get("captionpct"))||0));
      els.captionScale.value=String(pct); changed=true;
    }

    const ap = String(params.get("autoprint")||"").toLowerCase();
    shortcutAutoprint = ["1","true","yes","ja"].includes(ap);

    if (changed) {
      await LocalStore.setSetting("draftQr",els.qrText.value);
      await LocalStore.setSetting("draftCaption",els.caption.value);
      render(true); dirty = false;
      if (announce) {
        if (shortcutNotice) status(shortcutNotice,"warn");
        else if (shortcutAutoprint && connected) status("Kurzbefehl übernommen – Druck startet …","info");
        else if (shortcutAutoprint) status("Kurzbefehl übernommen. B1 verbinden – danach startet der Druck automatisch.","ok");
        else status("Kurzbefehl übernommen. Vorschau ist druckbereit.","ok");
      }
      if (shortcutAutoprint && connected) { shortcutAutoprint = false; await printLabel(); }
    }
    return changed;
  }

  function browserMessage() {
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
    if(B1Printer.supported()) status(ios ? "Web Bluetooth ist verfügbar – wahrscheinlich über Bluefy/WebBLE. B1 einschalten und verbinden." : "Web Bluetooth verfügbar. B1 einschalten und verbinden.","ok");
    else if(ios) status("iPhone/iPad erkannt: Safari/Chrome können den B1 nicht direkt ansprechen. Öffne diese Seite in Bluefy.","warn");
    else status("Web Bluetooth nicht verfügbar. Verwende auf Android Chrome/Edge oder auf Desktop Chrome/Edge.","warn");
  }

  async function registerSW() {
    if(!("serviceWorker" in navigator)) return;
    try{
      const reg=await navigator.serviceWorker.register("./service-worker.js");
      if(reg.waiting){ waitingWorker=reg.waiting; showUpdate(); }
      reg.addEventListener("updatefound",()=>{
        const nw=reg.installing;
        nw?.addEventListener("statechange",()=>{ if(nw.state==="installed" && navigator.serviceWorker.controller){ waitingWorker=nw; showUpdate(); } });
      });
      navigator.serviceWorker.addEventListener("message",e=>{ if(e.data?.type==="VERSION") els.updateStatus.textContent=`v${APP_VERSION} · Cache ${e.data.version}`; });
      navigator.serviceWorker.addEventListener("controllerchange",()=>{
        if(sessionStorage.getItem("qr-label-reloaded")==="1") return;
        sessionStorage.setItem("qr-label-reloaded","1");
        if(!dirty) location.reload();
      });
      if(reg.active) reg.active.postMessage({type:"GET_VERSION"});
    }catch(e){ els.updateStatus.textContent="Service Worker Fehler"; }
  }
  function showUpdate(){ els.updateStatus.textContent=`v${APP_VERSION} · neue Version bereit`; els.updateBtn.classList.remove("hidden"); }
  function applyUpdate(){
    if(!waitingWorker) return;
    if(dirty){ toast("Aktualisierung erst nach Abschluss der laufenden Aktion"); return; }
    sessionStorage.removeItem("qr-label-reloaded"); waitingWorker.postMessage({type:"SKIP_WAITING"});
  }

  async function init() {
    ["toast","statusBox","printerDot","connectBtn","connectLabel","printBtn","qrText","caption","labelSize","ecc","labelCanvas","labelInfo","renderState",
     "density","densityOut","copies","offsetY","captionScale","invert","savePresetBtn","presetList","historyList","refreshItemsBtn","shareBtn","savePngBtn","savePdfBtn",
     "modeBadge","serverSettings","backendUrl","cfClientId","cfClientSecret","testServerBtn","saveServerBtn","clearServerBtn",
     "exportBtn","importFile","updateStatus","updateBtn","appVersion","onlineState"].forEach(id=>els[id]=$(id));
    els.appVersion.textContent="v"+APP_VERSION;
    els.qrText.value=await LocalStore.getSetting("draftQr","");
    els.caption.value=await LocalStore.getSetting("draftCaption","");
    els.density.value=await LocalStore.getSetting("density",3); els.densityOut.value=els.density.value;
    els.copies.value=await LocalStore.getSetting("copies",1);
    els.captionScale.value=await LocalStore.getSetting("captionScale",0);
    const defaultSizeRevision=await LocalStore.getSetting("defaultLabelSizeRevision",0);
    let savedSize=await LocalStore.getSetting("labelSize","40x40");
    if (Number(defaultSizeRevision) < 5) {
      savedSize="40x40";
      await LocalStore.setSetting("labelSize",savedSize);
      await LocalStore.setSetting("defaultLabelSizeRevision",5);
      await LocalStore.setSetting("offsetY",B1Printer.LABEL_PRESETS["40x40"].sizes[4096].offset_y_px ?? 0);
    }
    setLabelSize(validLabelSizes.has(savedSize)?savedSize:"40x40",{persist:false,resetOffset:false});
    els.offsetY.value=await LocalStore.getSetting("offsetY",printerGeometry().size.offset_y_px ?? 0);
    await loadProvider();

    ["qrText","caption","ecc","invert","captionScale"].forEach(id=>els[id].addEventListener("input",()=>{ dirty=true; render(); }));
    els.qrText.addEventListener("input",()=>LocalStore.setSetting("draftQr",els.qrText.value));
    els.qrText.addEventListener("paste",()=>setTimeout(()=>importQuickChartFromValue(els.qrText.value,{announce:true}),0));
    els.qrText.addEventListener("change",()=>importQuickChartFromValue(els.qrText.value,{announce:true}));
    els.caption.addEventListener("input",()=>LocalStore.setSetting("draftCaption",els.caption.value));
    els.captionScale.addEventListener("change",()=>LocalStore.setSetting("captionScale",Number(els.captionScale.value)||0));
    els.labelSize.addEventListener("change",()=>setLabelSize(els.labelSize.value,{persist:true,resetOffset:true}));
    els.density.addEventListener("input",()=>{ els.densityOut.value=els.density.value; LocalStore.setSetting("density",Number(els.density.value)); });
    els.copies.addEventListener("change",()=>LocalStore.setSetting("copies",Number(els.copies.value)));
    els.offsetY.addEventListener("change",()=>LocalStore.setSetting("offsetY",Number(els.offsetY.value)));
    els.connectBtn.addEventListener("click",connectPrinter);
    els.printBtn.addEventListener("click",printLabel);
    els.shareBtn.addEventListener("click",sharePng);
    els.savePngBtn.addEventListener("click",async()=>downloadBlob(await canvasBlob(),`qr-label-${els.labelSize.value}.png`));
    els.savePdfBtn.addEventListener("click",savePdf);
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

    const shortcutApplied = await applyShortcutParams({announce:false});
    render(true); browserMessage();
    if (shortcutApplied) {
      if (shortcutNotice) status(shortcutNotice,"warn");
      else if (shortcutAutoprint) status("Kurzbefehl übernommen. B1 verbinden – danach startet der Druck automatisch.","ok");
      else status("Kurzbefehl übernommen. Vorschau ist druckbereit.","ok");
    }
    await refreshLists(); registerSW();
    addEventListener("hashchange",()=>applyShortcutParams({announce:true}));
    setTimeout(()=>{ dirty=false; },200);
  }
  addEventListener("DOMContentLoaded", init);
})();
