(() => {
  "use strict";
  const APP_VERSION = "41";
  let returnAfterPrintUrl = "";
  const $ = (id) => document.getElementById(id);
  const els = {};
  let provider;
  let mode = "local";
  let connected = false;
  let activePrinter = null;
  let beacioReady = false;
  let waitingWorker = null;
  let dirty = false;
  let renderTimer;
  let shortcutAutoprint = false;
  let autoPrintPending = false;
  let shortcutNotice = "";
  let quickChartReferenceSize = 0;
  let quickChartTemplateParams = null;
  let quickChartDetectTimer;
  let renderGeneration = 0;
  let quickChartCache = {url:"", blob:null};
  let previewZoom = 1;
  let scanStream = null;
  let scanRaf = 0;
  let scanLastFrame = 0;
  let autoCaptionValue = "";
  let nativeQrDetector = undefined;
  let bleChooserUiActive = false;
  let designerElement = "qr";
  let designerDrag = null;
  const DESIGN_DEFAULTS = Object.freeze({
    qr: Object.freeze({x:50,y:42,scale:100,rotation:0}),
    caption: Object.freeze({x:50,y:82,scale:100,rotation:0}),
    subcaption: Object.freeze({x:50,y:91,scale:100,rotation:0})
  });
  let designerState = {
    enabled:false,
    locked:false,
    qr:{...DESIGN_DEFAULTS.qr},
    caption:{...DESIGN_DEFAULTS.caption},
    subcaption:{...DESIGN_DEFAULTS.subcaption}
  };

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-"+Date.now()+"-"+Math.random().toString(16).slice(2));

  // v12 Bluefy handoff: an externally opened Bluefy tab can pass the new
  // Jira/QR payload to an already open NIIMBOT tab. The existing document
  // stays alive, so an active Web-Bluetooth/GATT connection can be retained.
  const HANDOFF_CHANNEL_NAME = "niimbot-qr-handoff-v1";
  const HANDOFF_STORAGE_KEY = "niimbotQrHandoffV1";
  const HANDOFF_ACK_KEY = "niimbotQrHandoffAckV1";
  const HANDOFF_RECEIVER_PREFIX = "niimbotQrReceiverV2:";
  const HANDOFF_INBOX_PREFIX = "niimbotQrInboxV1:";
  const PRINT_WINDOW_NAME = "niimbot-print";
  const PRIMARY_PRINTER_TAB_KEY = "niimbotQrPrimaryPrinterTabV1";
  const PRIMARY_LEASE_MS = 12 * 60 * 60 * 1000;
  const RECEIVER_LEASE_MS = 90 * 1000;
  const handoffTabId = sessionStorage.getItem("niimbotHandoffTabId") || uuid();
  sessionStorage.setItem("niimbotHandoffTabId", handoffTabId);
  const handledHandoffs = new Set();
  const pendingHandoffAcks = new Map();
  let handoffChannel = null;

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
    try { window.name = on ? PRINT_WINDOW_NAME : `niimbot-tab-${handoffTabId}`; } catch (_) {}
    els.printerDot.classList.toggle("ok", on);
    els.connectLabel.textContent = label || (on ? "NIIMBOT verbunden" : "NIIMBOT verbinden");
    els.printBtn.disabled = !on || !els.qrText.value.trim();
    try {
      if (on) localStorage.setItem(PRIMARY_PRINTER_TAB_KEY, JSON.stringify({tabId:handoffTabId,ts:Date.now(),version:24}));
      else {
        const primary=JSON.parse(localStorage.getItem(PRIMARY_PRINTER_TAB_KEY)||"{}");
        if(primary.tabId===handoffTabId) localStorage.removeItem(PRIMARY_PRINTER_TAB_KEY);
      }
    } catch (_) {}
    updateHandoffReceiverState();
  }

  function beginBleChooserUi() {
    if (bleChooserUiActive) return;
    bleChooserUiActive = true;
    clearTimeout(renderTimer);
    renderGeneration++;
    document.documentElement.classList.add("ble-choosing");
    document.body.classList.add("ble-choosing");
    try { window.scrollTo({top:0,left:0,behavior:"instant"}); } catch (_) { try { window.scrollTo(0,0); } catch (_) {} }
  }

  function endBleChooserUi() {
    if (!bleChooserUiActive) return;
    bleChooserUiActive = false;
    document.documentElement.classList.remove("ble-choosing");
    document.body.classList.remove("ble-choosing");
    requestAnimationFrame(()=>{ void render(true); });
  }

  function printerGeometry() {
    return activePrinter || B1Printer.current();
  }

  function updateGeometryUi({resetOffset=false}={}) {
    const p = printerGeometry();
    const size = p.size;
    const validation = size.validated ? "kalibriert" : "abgeleitet";
    els.labelInfo.textContent = `${p.name.replace("NIIMBOT ","")} · ${size.w_mm} × ${size.h_mm} mm · ${size.w_px} × ${size.h_px} px · ${validation}`;
    if (els.previewMm) els.previewMm.textContent = `${size.w_mm} × ${size.h_mm} mm`;
    if (els.pixelBadge) els.pixelBadge.textContent = `${size.w_px} × ${size.h_px} px`;
    document.querySelectorAll("[data-label-size]").forEach(btn=>btn.classList.toggle("active",btn.dataset.labelSize===els.labelSize.value));
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
    let fs = pct > 0 ? Math.round(canvas.width * pct / 100) : Math.max(15, Math.floor(canvas.width * 0.08));
    fs = Math.max(10, Math.min(Math.round(canvas.height*0.22), fs));
    return fs;
  }

  function quietZoneModules() {
    return Math.max(0, Math.min(8, Math.round(Number(els.quietZone?.value ?? 4) || 0)));
  }

  function updateQuietZoneUi() {
    if (!els.quietZone) return;
    const q = quietZoneModules();
    if (els.quietZoneOut) els.quietZoneOut.textContent = `${q} ${q===1 ? "Modul" : "Module"}`;
    if (els.quietZoneInfo) {
      if (q >= 4) {
        els.quietZoneInfo.className = "inline-status neutral";
        els.quietZoneInfo.innerHTML = `<span>✓</span><span>${q===4 ? "Standard-Ruheraum" : "Großer Ruheraum"} · ${q} Module</span>`;
      } else {
        els.quietZoneInfo.className = "inline-status warn";
        els.quietZoneInfo.innerHTML = `<span>!</span><span>Reduzierter Ruheraum · ${q} Module. Mehr QR-Fläche, aber geringere Scan-Reserve.</span>`;
      }
    }
    if (els.quietZoneBlock) {
      const local = activeRenderMode() === "local";
      els.quietZoneBlock.classList.toggle("is-disabled", !local);
      els.quietZone.disabled = !local;
      els.quietZone.title = local ? "" : "Der QR-Ruheraum wird nur vom Offline-Renderer verwendet.";
    }
  }

  function subcaptionFontPx(canvas, mainCaptionFont=0) {
    const base = mainCaptionFont > 0 ? mainCaptionFont : Math.max(12, Math.round(canvas.width * 0.065));
    return Math.max(9, Math.min(Math.round(canvas.height * 0.16), Math.round(base * 0.72)));
  }

  function fitTextFont(ctx, text, startPx, minPx, maxWidth, weight=700) {
    let fs = Math.max(minPx, Math.round(startPx));
    ctx.font = `${weight} ${fs}px Arial, Helvetica, sans-serif`;
    while (fs > minPx && ctx.measureText(text).width > maxWidth) {
      fs--;
      ctx.font = `${weight} ${fs}px Arial, Helvetica, sans-serif`;
    }
    return fs;
  }

  function activeRenderMode() {
    const selected = els.renderMode?.value || "auto";
    if (selected === "local") return "local";
    if (selected === "quickchart") return navigator.onLine ? "quickchart" : "local";
    return quickChartTemplateParams && navigator.onLine ? "quickchart" : "local";
  }

  function buildQuickChartUrl() {
    const text = els.qrText.value.trim();
    if (!text) throw new Error("QR-Inhalt fehlt.");
    const refSize = Math.max(150, Math.round(quickChartReferenceSize || 500));
    const p = new URLSearchParams();
    if (quickChartTemplateParams) {
      const keep = ["margin","dark","light","finderColor","dotStyle","finderStyle","finderDotStyle","captionFontFamily","captionFontColor"];
      for (const key of keep) {
        const v = quickChartTemplateParams.get(key);
        if (v !== null && v !== "") p.set(key, v);
      }
    }
    p.set("text", text);
    p.set("size", String(refSize));
    p.set("ecLevel", els.ecc.value);
    p.set("format", "png");
    const caption = els.caption.value.trim();
    if (caption) {
      p.set("caption", caption);
      const pct = Number(els.captionScale.value) || 0;
      let fontSize = pct > 0 ? Math.round(refSize * pct / 100) : Number.parseFloat(quickChartTemplateParams?.get("captionFontSize") || "");
      if (!Number.isFinite(fontSize) || fontSize <= 0) fontSize = Math.max(10, Math.round(refSize * 0.08));
      p.set("captionFontSize", String(fontSize));
    }
    return `https://quickchart.io/qr?${p.toString()}`;
  }

  async function loadQuickChartBitmap() {
    const url = buildQuickChartUrl();
    let blob = quickChartCache.url === url ? quickChartCache.blob : null;
    if (!blob) {
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);
      let response;
      try { response = await fetch(url, {method:"GET", mode:"cors", cache:"default", credentials:"omit", signal:controller.signal}); }
      catch(e) { if(e.name==="AbortError") throw new Error("QuickChart Timeout"); throw e; }
      finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error(`QuickChart HTTP ${response.status}`);
      blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("QuickChart lieferte kein Bild.");
      quickChartCache={url,blob};
    }
    if (window.createImageBitmap) return {image: await createImageBitmap(blob), url};
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve,reject)=>{
        const img=new Image(); img.onload=()=>resolve(img); img.onerror=()=>reject(new Error("QuickChart-Bild konnte nicht gelesen werden.")); img.src=objectUrl;
      });
      return {image, url};
    } finally { setTimeout(()=>URL.revokeObjectURL(objectUrl),1000); }
  }

  function designStorageKey(sizeKey=els.labelSize?.value || "40x40") {
    return `labelDesigner:${sizeKey}`;
  }

  function cloneDesignDefaults() {
    return {
      enabled:false,
      qr:{...DESIGN_DEFAULTS.qr},
      caption:{...DESIGN_DEFAULTS.caption},
      subcaption:{...DESIGN_DEFAULTS.subcaption}
    };
  }

  function normalizeDesignPart(value, fallback) {
    const v=value && typeof value==="object" ? value : {};
    return {
      x:Math.max(0,Math.min(100,Number(v.x ?? fallback.x))),
      y:Math.max(0,Math.min(100,Number(v.y ?? fallback.y))),
      scale:Math.max(40,Math.min(160,Number(v.scale ?? fallback.scale))),
      rotation:[0,90,180,270].includes(Number(v.rotation)) ? Number(v.rotation) : (fallback.rotation || 0)
    };
  }

  async function loadDesignerState(sizeKey=els.labelSize?.value || "40x40") {
    const saved=await LocalStore.getSetting(designStorageKey(sizeKey),null);
    const base=cloneDesignDefaults();
    if(saved && typeof saved==="object"){
      base.enabled=!!saved.enabled;
      base.locked=!!saved.locked;
      base.qr=normalizeDesignPart(saved.qr,DESIGN_DEFAULTS.qr);
      base.caption=normalizeDesignPart(saved.caption,DESIGN_DEFAULTS.caption);
      base.subcaption=normalizeDesignPart(saved.subcaption,DESIGN_DEFAULTS.subcaption);
    }
    designerState=base;
    if(els.designerEnabled) els.designerEnabled.checked=designerState.enabled;
    updateDesignerUi();
  }

  async function saveDesignerState() {
    await LocalStore.setSetting(designStorageKey(),{
      enabled:!!designerState.enabled,
      locked:!!designerState.locked,
      qr:{...designerState.qr},
      caption:{...designerState.caption},
      subcaption:{...designerState.subcaption}
    });
  }

  function currentDesignPart() {
    return designerState[designerElement] || designerState.qr;
  }

  function updateDesignerUi() {
    if(!els.designerControls) return;
    const enabled=!!designerState.enabled;
    els.designerControls.classList.toggle("is-disabled",!enabled);
    document.querySelectorAll("[data-design-element]").forEach(btn=>btn.classList.toggle("active",btn.dataset.designElement===designerElement));
    const part=currentDesignPart();
    if(els.designerEditBtn) els.designerEditBtn.classList.toggle("active",enabled && !designerState.locked);
    if(els.designerLockBtn) els.designerLockBtn.classList.toggle("active",enabled && designerState.locked);
    document.querySelectorAll("[data-design-rotation]").forEach(btn=>btn.classList.toggle("active",Number(btn.dataset.designRotation)===Number(part.rotation||0)));
    if(els.designerX){ els.designerX.value=String(Math.round(part.x)); els.designerXOut.textContent=`${Math.round(part.x)}%`; }
    if(els.designerY){ els.designerY.value=String(Math.round(part.y)); els.designerYOut.textContent=`${Math.round(part.y)}%`; }
    if(els.designerScale){ els.designerScale.value=String(Math.round(part.scale)); els.designerScaleOut.textContent=`${Math.round(part.scale)}%`; }
    if(els.designerInfo) els.designerInfo.innerHTML=`<span>i</span><span>${designerElement==="qr"?"QR":designerElement==="caption"?"Caption":"Subcaption"} ausgewählt · ${!enabled?"Designer ist deaktiviert.":designerState.locked?"Positionen gesperrt.":designerElement==="qr"?"QR füllt den Rahmen ohne automatischen Ruheraum.":"Tippen wählt aus, Ziehen verschiebt."}</span>`;
    if(els.designerSelection) els.designerSelection.classList.toggle("hidden",!enabled || activeRenderMode()!=="local");
    updateDesignerSelection();
  }

  function updateDesignerSelection(bounds=null) {
    if(!els.designerSelection || !designerState.enabled || activeRenderMode()!=="local") return;
    const c=els.labelCanvas;
    if(!c || !c.width || !c.height) return;
    let b=bounds;
    if(!b){
      const p=currentDesignPart();
      const w = designerElement==="qr" ? Math.min(84,70*p.scale/100) : Math.min(90,50*p.scale/100);
      const h = designerElement==="qr" ? w*(c.width/c.height) : Math.max(8,12*p.scale/100);
      b={x:p.x-w/2,y:p.y-h/2,w,h};
    }
    els.designerSelection.style.left=`${b.x}%`;
    els.designerSelection.style.top=`${b.y}%`;
    els.designerSelection.style.width=`${b.w}%`;
    els.designerSelection.style.height=`${b.h}%`;
  }

  function setDesignerPart(next,{persist=true}={}) {
    const part=currentDesignPart();
    if(next.x!==undefined) part.x=Math.max(0,Math.min(100,Number(next.x)));
    if(next.y!==undefined) part.y=Math.max(0,Math.min(100,Number(next.y)));
    if(next.scale!==undefined) part.scale=Math.max(40,Math.min(160,Number(next.scale)));
    if(next.rotation!==undefined) part.rotation=[0,90,180,270].includes(Number(next.rotation))?Number(next.rotation):0;
    updateDesignerUi();
    render(true);
    if(persist) void saveDesignerState();
  }

  function designerEnabledForLocal() {
    return !!designerState.enabled && activeRenderMode()==="local";
  }

  function qrMatrixMetrics(c,n,caption,subcaption) {
    const margin=Math.max(6,Math.round(c.width*.025));
    let mainFs=caption?captionFontPx(c,caption):0;
    let subFs=subcaption?subcaptionFontPx(c,mainFs):0;
    const mainGap=caption?Math.max(1,Math.round(mainFs*.06)):0;
    const between=caption&&subcaption?Math.max(1,Math.round(subFs*.08)):0;
    const subGap=!caption&&subcaption?Math.max(1,Math.round(subFs*.08)):0;
    const mainLineH=caption?Math.ceil(mainFs*1.08):0;
    const subLineH=subcaption?Math.ceil(subFs*1.08):0;
    const textBlockH=mainLineH+subLineH+mainGap+between+subGap;
    const maxQr=Math.max(1,Math.min(c.width-margin*2,c.height-margin*2-textBlockH));
    const q=quietZoneModules();
    return {margin,mainFs,subFs,maxQr,q};
  }

  function setDesignerHit(el,b,show=true) {
    if(!el) return;
    el.classList.toggle("hidden",!show || !designerState.enabled || activeRenderMode()!=="local");
    if(!show) return;
    el.style.left=`${b.x}%`; el.style.top=`${b.y}%`; el.style.width=`${b.w}%`; el.style.height=`${b.h}%`;
  }
  function updateDesignerHitTargets(c,total,caption,subcaption,m) {
    const q=designerState.qr, qw=total/c.width*100, qh=total/c.height*100;
    setDesignerHit(els.designerHitQr,{x:q.x-qw/2,y:q.y-qh/2,w:qw,h:qh});
    if(caption){ const d=designerState.caption, fs=m.mainFs*d.scale/100, w=Math.min(90,Math.max(18,caption.length*fs*.55/c.width*100)), h=Math.max(8,fs*1.5/c.height*100); setDesignerHit(els.designerHitCaption,{x:d.x-w/2,y:d.y-h/2,w,h}); } else setDesignerHit(els.designerHitCaption,{},false);
    if(subcaption){ const d=designerState.subcaption, fs=m.subFs*d.scale/100, w=Math.min(90,Math.max(18,subcaption.length*fs*.55/c.width*100)), h=Math.max(8,fs*1.5/c.height*100); setDesignerHit(els.designerHitSubcaption,{x:d.x-w/2,y:d.y-h/2,w,h}); } else setDesignerHit(els.designerHitSubcaption,{},false);
  }

  function drawDesignerLocalLabel(ctx,c,text,caption,subcaption) {
    if(!window.qrcode) throw new Error("QR-Bibliothek nicht geladen.");
    const qr=qrcode(0,els.ecc.value);
    qr.addData(text,"Byte"); qr.make();
    const n=qr.getModuleCount();
    const m=qrMatrixMetrics(c,n,caption,subcaption);
    const qrDesign=designerState.qr;
    const scale=Math.max(.4,Math.min(1.6,qrDesign.scale/100));
    // Manual designer: deliberately NO automatic quiet zone.
    // The user owns all whitespace through position and size.
    const maxMatrix=Math.max(1,Math.floor(Math.min(c.width,c.height)*0.72*scale));
    const modulePx=Math.max(1,Math.floor(maxMatrix/n));
    const qrPx=n*modulePx, quiet=0, total=qrPx;

    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle="#000";

    const centerX=c.width*qrDesign.x/100;
    const centerY=c.height*qrDesign.y/100;
    const left=Math.round(centerX-total/2);
    const top=Math.round(centerY-total/2);
    const x0=left+quiet, y0=top+quiet;
    ctx.save(); ctx.translate(centerX,centerY); ctx.rotate((qrDesign.rotation||0)*Math.PI/180); ctx.translate(-centerX,-centerY);
    for(let r=0;r<n;r++) for(let col=0;col<n;col++){
      if(qr.isDark(r,col)) ctx.fillRect(x0+col*modulePx,y0+r*modulePx,modulePx,modulePx);
    }
    ctx.restore();

    if(caption){
      const d=designerState.caption;
      let fs=fitTextFont(ctx,caption,m.mainFs*d.scale/100,8,c.width-m.margin*2,700);
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="#000";
      ctx.save(); ctx.translate(c.width*d.x/100,c.height*d.y/100); ctx.rotate((d.rotation||0)*Math.PI/180); ctx.fillText(caption,0,0); ctx.restore();
    }
    if(subcaption){
      const d=designerState.subcaption;
      let fs=fitTextFont(ctx,subcaption,m.subFs*d.scale/100,8,c.width-m.margin*2,600);
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="#000";
      ctx.save(); ctx.translate(c.width*d.x/100,c.height*d.y/100); ctx.rotate((d.rotation||0)*Math.PI/180); ctx.fillText(subcaption,0,0); ctx.restore();
    }

    updateDesignerHitTargets(c,total,caption,subcaption,m);
    const qrBounds={x:left/c.width*100,y:top/c.height*100,w:total/c.width*100,h:total/c.height*100};
    if(designerElement==="qr") updateDesignerSelection(qrBounds);
    return n;
  }

  function drawLocalLabel(ctx, c, text, caption, subcaption) {
    if (designerEnabledForLocal()) return drawDesignerLocalLabel(ctx,c,text,caption,subcaption);
    if (!window.qrcode) throw new Error("QR-Bibliothek nicht geladen.");
    const qr = qrcode(0, els.ecc.value);
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const margin = Math.max(6, Math.round(c.width * 0.025));

    let mainFs = caption ? captionFontPx(c, caption) : 0;
    let subFs = subcaption ? subcaptionFontPx(c, mainFs) : 0;
    const mainGap = caption ? Math.max(1, Math.round(mainFs * 0.06)) : 0;
    const betweenTextGap = caption && subcaption ? Math.max(1, Math.round(subFs * 0.08)) : 0;
    const subGap = !caption && subcaption ? Math.max(1, Math.round(subFs * 0.08)) : 0;
    const mainLineH = caption ? Math.ceil(mainFs * 1.08) : 0;
    const subLineH = subcaption ? Math.ceil(subFs * 1.08) : 0;
    const textBlockH = mainLineH + subLineH + mainGap + betweenTextGap + subGap;

    const maxQr = Math.min(c.width - margin*2, c.height - margin*2 - textBlockH);
    const quietModules = quietZoneModules();
    const modulePx = Math.max(1, Math.floor(maxQr / (n + quietModules*2)));
    const qrPx = n * modulePx;
    const quiet = quietModules * modulePx;
    const total = qrPx + quiet*2;
    const x0 = Math.round((c.width-total)/2) + quiet;
    const contentH = total + textBlockH;
    const top = Math.max(margin, Math.round((c.height-contentH)/2));
    const y0 = top + quiet;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle = "#000";
    for (let r=0;r<n;r++) for (let col=0;col<n;col++) {
      if (qr.isDark(r,col)) ctx.fillRect(x0+col*modulePx, y0+r*modulePx, modulePx, modulePx);
    }

    const maxTextWidth = c.width - margin*2;
    let cursorY = top + total;

    if (caption) {
      mainFs = fitTextFont(ctx, caption, mainFs, 10, maxTextWidth, 700);
      cursorY += mainGap;
      const captionY = Math.min(c.height-margin-Math.ceil(mainFs*0.5), cursorY + Math.ceil(mainFs*0.55));
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle="#000";
      ctx.fillText(caption, c.width/2, captionY);
      cursorY += Math.ceil(mainFs * 1.08);
    }

    if (subcaption) {
      subFs = fitTextFont(ctx, subcaption, subFs, 9, maxTextWidth, 600);
      cursorY += caption ? betweenTextGap : subGap;
      const subY = Math.min(c.height-margin-Math.ceil(subFs*0.5), cursorY + Math.ceil(subFs*0.55));
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle="#000";
      ctx.fillText(subcaption, c.width/2, subY);
    }
    return n;
  }

  async function drawQuickChartLabel(ctx, c, subcaption="") {
    const {image} = await loadQuickChartBitmap();
    try {
      ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";

      const margin = Math.max(6, Math.round(c.width * 0.025));
      let subFs = subcaption ? subcaptionFontPx(c, captionFontPx(c, els.caption.value.trim())) : 0;
      const subGap = subcaption ? Math.max(1, Math.round(subFs * 0.08)) : 0;
      const subLineH = subcaption ? Math.ceil(subFs * 1.12) : 0;
      const reservedBottom = subcaption ? subGap + subLineH + margin : 0;

      const iw=image.width, ih=image.height;
      const availableH = Math.max(1, c.height - reservedBottom);
      const scale=Math.min(c.width/iw, availableH/ih);
      const dw=Math.round(iw*scale), dh=Math.round(ih*scale);
      const dx=Math.round((c.width-dw)/2), dy=Math.max(0, Math.round((availableH-dh)/2));
      ctx.drawImage(image,dx,dy,dw,dh);

      if (subcaption) {
        subFs = fitTextFont(ctx, subcaption, subFs, 9, c.width-margin*2, 600);
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="#000";
        const y = Math.min(c.height-margin-Math.ceil(subFs*.5), availableH + subGap + Math.ceil(subFs*.55));
        ctx.fillText(subcaption,c.width/2,y);
      }
    } finally { if (typeof image.close === "function") image.close(); }
  }


  function updateCaptionScaleUi() {
    if (!els.captionScaleOut) return;
    const pct=Number(els.captionScale.value)||0;
    els.captionScaleOut.textContent=pct>0?`${pct}%`:"Auto";
  }

  function updateModeUi() {
    const selected=els.renderMode.value;
    document.querySelectorAll("[data-render-mode]").forEach(btn=>btn.classList.toggle("active",btn.dataset.renderMode===selected));
    if (els.renderModeInfo) {
      if (selected==="quickchart") {
        els.renderModeInfo.className="inline-status";
        els.renderModeInfo.innerHTML=`<span>✓</span><span>QuickChart API aktiv – verwendet QuickCharts eigenes QR-/Caption-Layout.</span>`;
      } else {
        els.renderModeInfo.className="inline-status neutral";
        els.renderModeInfo.innerHTML=`<span>✓</span><span>Offline-Modus aktiv – funktioniert ohne Internet.</span>`;
      }
    }
    updateQuietZoneUi();
    if(els.designerSelection) els.designerSelection.classList.toggle("hidden",!designerState.enabled || activeRenderMode()!=="local");
    if(els.designerInfo && designerState.enabled && activeRenderMode()!=="local") els.designerInfo.innerHTML="<span>!</span><span>Designer ist nur im Offline-Renderer aktiv.</span>";
  }

  function updateParamPanel(renderLabel) {
    const set=(id,val)=>{ if(els[id]) els[id].textContent=(val===null||val===undefined||val==="")?"–":String(val); };
    set("paramText",els.qrText.value.trim());
    set("paramCaption",els.caption.value.trim());
    set("paramSubcaption",els.subcaption.value.trim());
    set("paramCaptionSize",quickChartTemplateParams?.get("captionFontSize") || (Number(els.captionScale.value)?`${els.captionScale.value}%`:"Auto"));
    set("paramSize",quickChartTemplateParams?.get("size") || `${printerGeometry().size.w_px}×${printerGeometry().size.h_px} px`);
    set("paramEcc",els.ecc.value);
    set("paramRenderMode",renderLabel || (activeRenderMode()==="quickchart"?"QuickChart API":"Offline lokal"));
    set("paramQuietZone", activeRenderMode()==="local" ? `${quietZoneModules()} Module` : "nur lokal");
    if (els.captionStatus) {
      const cap=els.caption.value.trim();
      const sub=els.subcaption.value.trim();
      els.captionStatus.className="inline-status neutral";
      if (cap || sub) {
        const parts=[];
        if(cap) parts.push(`Caption „${cap.replace(/[<>]/g,"")}“`);
        if(sub) parts.push(`Subcaption „${sub.replace(/[<>]/g,"")}“`);
        els.captionStatus.innerHTML=`<span>✓</span><span>${parts.join(" · ")} wird ausgegeben.</span>`;
      } else {
        els.captionStatus.innerHTML=`<span>✓</span><span>Keine Caption gesetzt.</span>`;
      }
    }
  }

  function setPreviewZoom(next) {
    previewZoom=Math.max(.7,Math.min(1.5,next));
    if(els.previewStage) els.previewStage.style.transform=`scale(${previewZoom})`;
    if(els.zoomValue) els.zoomValue.textContent=`${Math.round(previewZoom*100)}%`;
  }

  function setImportStatus(on) {
    if(!els.importStatus) return;
    els.importStatus.classList.toggle("hidden",!on);
  }

  function render(immediate=false) {
    if (bleChooserUiActive && !immediate) return Promise.resolve();
    clearTimeout(renderTimer);
    const generation=++renderGeneration;
    const draw = async () => {
      const p = printerGeometry();
      const c = els.labelCanvas;
      if (c.width !== p.size.w_px || c.height !== p.size.h_px) {
        c.width = p.size.w_px; c.height = p.size.h_px;
        c.style.aspectRatio = `${p.size.w_px} / ${p.size.h_px}`;
        if (els.previewStage) els.previewStage.style.aspectRatio = `${p.size.w_px} / ${p.size.h_px}`;
      }
      updateGeometryUi();
      const ctx = c.getContext("2d", {alpha:false});
      const text = els.qrText.value.trim();
      const caption = els.caption.value.trim();
      const subcaption = els.subcaption.value.trim();
      if (!text) {
        drawPlaceholder(ctx,c.width,c.height);
        els.renderState.textContent = "bereit";
        els.printBtn.disabled = true;
        return;
      }
      try {
        const mode=activeRenderMode();
        if (mode === "quickchart") {
          els.renderState.textContent="QuickChart …";
          await drawQuickChartLabel(ctx,c,subcaption);
          if (generation !== renderGeneration) return;
          els.renderState.textContent=`QuickChart API · ${utf8ByteLength(text)} B`;
          updateParamPanel("QuickChart API");
        } else {
          const n=drawLocalLabel(ctx,c,text,caption,subcaption);
          els.renderState.textContent=`lokal · ${n}×${n} · ${utf8ByteLength(text)} B`;
          updateParamPanel("Offline lokal");
        }
        if (els.invert.checked) {
          const img=ctx.getImageData(0,0,c.width,c.height);
          for(let i=0;i<img.data.length;i+=4){
            img.data[i]=255-img.data[i]; img.data[i+1]=255-img.data[i+1]; img.data[i+2]=255-img.data[i+2];
          }
          ctx.putImageData(img,0,0);
        }
        els.printBtn.disabled = !connected;
        if (designerState.enabled) updateDesignerSelection();
      } catch (e) {
        if (generation !== renderGeneration) return;
        if (activeRenderMode() === "quickchart") {
          try {
            const n=drawLocalLabel(ctx,c,text,caption,subcaption);
            els.renderState.textContent=`Offline-Fallback · ${n}×${n}`;
            updateParamPanel("Offline-Fallback");
            status("QuickChart nicht erreichbar oder im Browser blockiert. Lokaler Renderer wird als Fallback verwendet: "+e.message,"warn");
            els.printBtn.disabled=!connected;
            return;
          } catch (_) {}
        }
        drawPlaceholder(ctx,c.width,c.height);
        els.renderState.textContent = "Fehler";
        status("QR-Code konnte nicht erzeugt werden: " + e.message, "error");
      }
    };
    if (immediate) return draw();
    renderTimer = setTimeout(()=>{ void draw(); },60);
    return Promise.resolve();
  }

  function quickChartParams(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    // Vollständige QuickChart-URL, auch ohne explizites https:// akzeptieren.
    let candidate = raw;
    if (/^(?:www\.)?quickchart\.io\/qr\?/i.test(candidate)) candidate = "https://" + candidate;
    try {
      const u = new URL(candidate);
      if (/(^|\.)quickchart\.io$/i.test(u.hostname) && /^\/qr\/?$/i.test(u.pathname)) return u.searchParams;
    } catch (_) {}

    // Bluefy/iOS kann beim Einfügen bzw. Teilen auch nur den Query-Teil liefern.
    // Beispiel: text=https://...&size=500&caption=IAM-43322&captionFontSize=40
    const query = raw.replace(/^[?#]/, "");
    if (/^text=/i.test(query) && /(?:^|&)(?:caption|captionFontSize|size|ecLevel|ecc)=/i.test(query)) {
      return new URLSearchParams(query);
    }
    return null;
  }

  function isQuickChartQrUrl(value) {
    return quickChartParams(value) !== null;
  }

  function parseQuickChart(value) {
    const p = quickChartParams(value);
    if (!p) return null;
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
    if (els.sourceInput) els.sourceInput.value = String(value).trim();
    els.qrText.value = parsed.text;
    if (parsed.caption !== null) { els.caption.value = parsed.caption; autoCaptionValue=parsed.caption; els.caption.dataset.auto="1"; }
    if (parsed.ecLevel) els.ecc.value = parsed.ecLevel;
    if (parsed.captionPct !== null) els.captionScale.value = parsed.captionPct.toFixed(1).replace(/\.0$/,"");
    quickChartReferenceSize = Number.isFinite(parsed.refSize) ? parsed.refSize : 0;
    quickChartTemplateParams = new URLSearchParams(quickChartParams(value));
    if (els.renderMode) {
      els.renderMode.value = "quickchart";
      updateModeUi();
      await LocalStore.setSetting("renderMode", "quickchart");
    }
    await LocalStore.setSetting("draftQr", els.qrText.value);
    if (els.sourceInput) await LocalStore.setSetting("draftSource", els.sourceInput.value);
    await LocalStore.setSetting("draftCaption", els.caption.value);
    await LocalStore.setSetting("draftSubcaption", els.subcaption.value);
    await LocalStore.setSetting("captionScale", Number(els.captionScale.value)||0);
    setImportStatus(true);
    updateCaptionScaleUi();
    updateParamPanel("QuickChart API");
    render(true);
    if (announce) {
      const fontInfo = parsed.captionPct !== null ? ` · Caption ${els.captionScale.value}%` : "";
      status(`QuickChart übernommen: QR-Ziel${parsed.caption!==null?" + Caption":""}${fontInfo}. Labelformat bleibt ${els.labelSize.value.replace("x","×")} mm.`,"ok");
      toast("QuickChart übernommen");
    }
    return true;
  }

  function sanitizePrefix(value) {
    const clean=String(value||"IAM").trim().toUpperCase().replace(/[^A-Z0-9_-]+/g,"").slice(0,20);
    return clean || "IAM";
  }

  function detectAssetCaption(value) {
    const raw=String(value||"").trim();
    if(!raw) return null;
    const direct=raw.match(/\b([A-Z][A-Z0-9_]{1,20}-\d+)\b/i);
    try {
      const u=new URL(raw);
      const candidates=[u.searchParams.get("objectKey"),u.searchParams.get("key"),u.searchParams.get("assetKey")].filter(Boolean);
      for(const v of candidates){ const m=String(v).match(/^([A-Z][A-Z0-9_]{1,20}-\d+)$/i); if(m) return m[1].toUpperCase(); }
      const pathKey=u.pathname.match(/(?:browse|object|objects|assets?)\/([A-Z][A-Z0-9_]{1,20}-\d+)/i);
      if(pathKey) return pathKey[1].toUpperCase();
      const id=u.searchParams.get("id") || u.searchParams.get("objectId") || u.searchParams.get("assetId");
      const jiraish=/ShowObject\.jspa/i.test(u.pathname) || /atlassian|jira/i.test(u.hostname+u.pathname) || /\/assets?\//i.test(u.pathname);
      if(jiraish && id && /^\d+$/.test(id)) return `${sanitizePrefix(els.jiraPrefix?.value)}-${id}`;
    } catch(_) {}
    if(direct && /^IAM-/i.test(direct[1])) return direct[1].toUpperCase();
    return null;
  }

  async function maybeApplyAssetCaption(value,{force=false}={}) {
    if(!els.autoAssetCaption?.checked) return null;
    const derived=detectAssetCaption(value);
    if(!derived) return null;
    const current=els.caption.value.trim();
    if(force || !current || current===autoCaptionValue) {
      els.caption.value=derived;
      autoCaptionValue=derived;
      els.caption.dataset.auto="1";
      await LocalStore.setSetting("draftCaption",derived);
      if(els.captureStatus){ els.captureStatus.className="inline-status"; els.captureStatus.innerHTML=`<span>✓</span><span>Jira/Assets erkannt: Caption <b>${derived}</b> automatisch übernommen.</span>`; }
      return derived;
    }
    return null;
  }

  async function applyCapturedValue(value,{origin="Eingabe",announce=true}={}) {
    const raw=String(value||"").trim();
    if(!raw) return false;
    els.sourceInput.value=raw;
    await LocalStore.setSetting("draftSource",raw);
    if(isQuickChartQrUrl(raw)) {
      const ok=await importQuickChartFromValue(raw,{announce:false});
      if(ok && announce) status(`${origin}: QuickChart-Link übernommen.`,'ok');
      return ok;
    }
    quickChartTemplateParams=null; quickChartReferenceSize=0; setImportStatus(false);
    els.qrText.value=raw;
    await LocalStore.setSetting("draftQr",raw);
    const cap=await maybeApplyAssetCaption(raw,{force:false});
    render(true);
    if(announce) status(cap ? `${origin}: QR-Ziel übernommen · Caption ${cap}.` : `${origin}: QR-Ziel übernommen.`,'ok');
    return true;
  }

  function stopScanner() {
    if(scanRaf){ cancelAnimationFrame(scanRaf); scanRaf=0; }
    if(scanStream){ for(const t of scanStream.getTracks()) t.stop(); scanStream=null; }
    if(els.scanVideo) els.scanVideo.srcObject=null;
    els.scanModal?.classList.add("hidden");
  }

  async function getNativeQrDetector() {
    if(nativeQrDetector!==undefined) return nativeQrDetector;
    nativeQrDetector=null;
    try{
      if("BarcodeDetector" in window){
        const formats=BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : ["qr_code"];
        if(formats.includes("qr_code")) nativeQrDetector=new BarcodeDetector({formats:["qr_code"]});
      }
    }catch(_) { nativeQrDetector=null; }
    return nativeQrDetector;
  }

  function decodeQrImageData(imageData) {
    if(typeof window.jsQR!=="function") return null;
    return window.jsQR(imageData.data,imageData.width,imageData.height,{inversionAttempts:"attemptBoth"});
  }

  async function decodeQrCanvas(canvas,ctx) {
    const native=await getNativeQrDetector();
    if(native){
      try{ const found=await native.detect(canvas); if(found?.length) return {data:found[0].rawValue}; }catch(_){}
    }
    const code=decodeQrImageData(ctx.getImageData(0,0,canvas.width,canvas.height));
    if(code) return code;
    if(!native && typeof window.jsQR!=="function") throw new Error("Kein QR-Decoder verfügbar. Für den ersten Scanner-Start bitte einmal online laden.");
    return null;
  }

  async function scanLoop(ts) {
    if(!scanStream || !els.scanVideo) return;
    if(ts-scanLastFrame>120 && els.scanVideo.readyState>=2 && els.scanVideo.videoWidth>0){
      scanLastFrame=ts;
      try{
        const maxW=900;
        const scale=Math.min(1,maxW/els.scanVideo.videoWidth);
        const w=Math.max(1,Math.round(els.scanVideo.videoWidth*scale));
        const h=Math.max(1,Math.round(els.scanVideo.videoHeight*scale));
        els.scanCanvas.width=w; els.scanCanvas.height=h;
        const ctx=els.scanCanvas.getContext("2d",{willReadFrequently:true});
        ctx.drawImage(els.scanVideo,0,0,w,h);
        const code=await decodeQrCanvas(els.scanCanvas,ctx);
        if(code?.data){
          const data=code.data; stopScanner();
          await applyCapturedValue(data,{origin:"Kamera",announce:true});
          toast("QR-Code erkannt"); return;
        }
      }catch(e){ if(els.scanStatus){ els.scanStatus.className="status warn"; els.scanStatus.textContent="Scanner: "+e.message; } }
    }
    scanRaf=requestAnimationFrame(scanLoop);
  }

  async function startScanner() {
    if(!navigator.mediaDevices?.getUserMedia){ els.scanImageInput.click(); status("Live-Kamera nicht verfügbar – bitte Foto/Bild wählen.","warn"); return; }
    const native=await getNativeQrDetector();
    if(!native && typeof window.jsQR!=="function"){ status("QR-Scanner ist noch nicht geladen. Für den ersten Start kurz online öffnen und Seite neu laden.","warn"); return; }
    stopScanner();
    els.scanModal.classList.remove("hidden");
    els.scanStatus.className="status info"; els.scanStatus.textContent="Kamera wird gestartet …";
    try{
      scanStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:960}}});
      els.scanVideo.srcObject=scanStream; await els.scanVideo.play();
      els.scanStatus.className="status ok"; els.scanStatus.textContent="Kamera aktiv – QR-Code in den Rahmen halten.";
      scanLastFrame=0; scanRaf=requestAnimationFrame(scanLoop);
    }catch(e){
      stopScanner();
      status("Kamera konnte nicht geöffnet werden: "+e.message+". Nutze Foto / Bild als Fallback.","warn");
      els.scanImageInput.click();
    }
  }

  async function scanImageFile(file) {
    if(!file) return;
    try{
      const native=await getNativeQrDetector();
      if(!native && typeof window.jsQR!=="function") throw new Error("QR-Scanner-Bibliothek ist noch nicht geladen. Für den ersten Start kurz online öffnen.");
      let image;
      if(window.createImageBitmap) image=await createImageBitmap(file);
      else image=await new Promise((resolve,reject)=>{ const img=new Image(); const u=URL.createObjectURL(file); img.onload=()=>{URL.revokeObjectURL(u);resolve(img)}; img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error("Bild konnte nicht gelesen werden."))}; img.src=u; });
      const max=1800, scale=Math.min(1,max/Math.max(image.width,image.height));
      const w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
      const c=document.createElement("canvas"); c.width=w;c.height=h; const ctx=c.getContext("2d",{willReadFrequently:true}); ctx.drawImage(image,0,0,w,h);
      if(typeof image.close==="function") image.close();
      const code=await decodeQrCanvas(c,ctx);
      if(!code?.data) throw new Error("Kein QR-Code im Bild gefunden.");
      await applyCapturedValue(code.data,{origin:"Bild",announce:true}); toast("QR-Code aus Bild erkannt");
    }catch(e){ status("QR aus Bild konnte nicht gelesen werden: "+e.message,"error"); }
  }

  async function pasteFromClipboard() {
    try{
      let text="";
      if(navigator.clipboard?.readText) text=await navigator.clipboard.readText();
      if(!text) text=prompt("Jira-/Assets-Link oder QuickChart-Link einfügen:","") || "";
      if(text) await applyCapturedValue(text,{origin:"Zwischenablage",announce:true});
    }catch(_){ const text=prompt("Zwischenablage konnte nicht gelesen werden. Link hier einfügen:","") || ""; if(text) await applyCapturedValue(text,{origin:"Eingabe",announce:true}); }
  }

  async function savePngSmart() {
    try{
      const blob=await canvasBlob();
      const file=new File([blob],`qr-label-${els.labelSize.value}.png`,{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({files:[file],title:"QR Label"});
        toast("PNG an Teilen-Menü übergeben"); return;
      }
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
      if(ios){
        const u=URL.createObjectURL(blob); const win=window.open(u,"_blank");
        if(win){ status("PNG wurde geöffnet. Über Teilen bzw. langes Drücken kannst du es in Dateien/Fotos sichern.","ok"); setTimeout(()=>URL.revokeObjectURL(u),60000); return; }
      }
      downloadBlob(blob,file.name); toast("PNG gespeichert");
    }catch(e){ if(e.name!=="AbortError") status("PNG konnte nicht gesichert werden: "+e.message,"error"); }
  }

  async function shareQrTarget() {
    const text=els.qrText.value.trim(); if(!text) return;
    try{
      if(navigator.share){ const data={title:els.caption.value.trim()||"QR Label",text}; if(/^https?:\/\//i.test(text)) data.url=text; await navigator.share(data); }
      else if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); toast("QR-Ziel kopiert"); }
    }catch(e){ if(e.name!=="AbortError") status("Teilen fehlgeschlagen: "+e.message,"warn"); }
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
      strong.textContent = `${item.printer || "NIIMBOT"} · ${(item.label_size || "50x30").replace("x","×")} · ${item.copies || 1}×`;
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
    void loadDesignerState(key).then(()=>render(true));
    const g=printerGeometry().size;
    if (!g.validated) status(`${g.w_mm}×${g.h_mm} mm ist für ${printerGeometry().name} abgeleitet. Bei Bedarf Vertikal-Offset nach Testdruck feinjustieren.`,"warn");
  }

  function applyItem(item) {
    els.qrText.value=item.qr_text || "";
    els.caption.value=item.caption || "";
    els.subcaption.value=item.subcaption || "";
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
      id:uuid(), name, qr_text:qr, caption:els.caption.value.trim(), subcaption:els.subcaption.value.trim(), ecc:els.ecc.value,
      density:Number(els.density.value), offset_y:Number(els.offsetY.value),
      label_size:els.labelSize.value, caption_scale:Number(els.captionScale.value)||0,
      created_at:t, updated_at:t
    };
    await provider.createItem(item); await refreshLists(); toast("Vorlage gespeichert");
  }

  async function canvasBlob() {
    await render(true);
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
      await render(true);
      const blob=pdfBlobFromCanvas();
      const name=`qr-label-${els.labelSize.value}.pdf`;
      const file=new File([blob],name,{type:"application/pdf"});
      if(navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({files:[file],title:`QR Label ${printerGeometry().size.w_mm}×${printerGeometry().size.h_mm} mm`});
      } else downloadBlob(blob,name);
      toast(`PDF ${printerGeometry().size.w_mm}×${printerGeometry().size.h_mm} mm bereit`);
    } catch(e) { if(e.name!=="AbortError") status("PDF konnte nicht erstellt werden: "+e.message,"error"); }
  }

  async function connectPrinter({allDevices=false,preferKnown=true,knownOnly=false,automatic=false}={}) {
    try {
      els.connectBtn.disabled=true; status("Bluetooth-Verbindung wird vorbereitet …","info");
      activePrinter=await B1Printer.connect({allDevices,preferKnown,knownOnly,onStage:(ev)=>{
        if(!ev || !ev.stage) return;
        if(ev.stage==="known-search") status("Bekannter NIIMBOT wird gesucht …","info");
        else if(ev.stage==="known-found") status(`Bekannter Drucker gefunden: ${ev.detail}. Verbindung wird wiederhergestellt …`,"info");
        else if(ev.stage==="known-selected") status(`Bekannter Drucker: ${ev.detail}. Verbinde direkt …`,"info");
        else if(ev.stage==="known-missing") status("Kein bereits freigegebener NIIMBOT gefunden.","warn");
        else if(ev.stage==="known-unavailable") status(ev.detail,"warn");
        else if(ev.stage==="known-failed") status(ev.detail,"warn");
        else if(ev.stage==="chooser") { beginBleChooserUi(); status(allDevices?"Alle Bluetooth-Geräte werden angezeigt …":"NIIMBOT-Geräteauswahl geöffnet …","info"); }
        else if(ev.stage==="selected") { endBleChooserUi(); status(`Gerät gewählt: ${ev.detail || "Bluetooth-Gerät"}. NIIMBOT-Kompatibilität wird geprüft …`,"info"); }
        else if(ev.stage==="identify") status(automatic?"Automatische NIIMBOT-Verbindung wird geprüft …":"NIIMBOT-Treiber wird vorbereitet …","info");
        else if(ev.stage==="identified") status("NIIMBOT erkannt – Verbindung wird abgeschlossen …","info");
      }});
      activePrinter=B1Printer.setSize(els.labelSize.value);
      setConnected(true, activePrinter.name.replace("NIIMBOT ","")+" verbunden");
      const remembered = B1Printer.preferredDevice?.();
      if (els.knownPrinterInfo) els.knownPrinterInfo.textContent = remembered ? `Bekannter Drucker: ${remembered.name || activePrinter.name}` : `Bekannter Drucker: ${activePrinter.name}`;
      updateGeometryUi({resetOffset:false});
      render(true);
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
      const derived = !activePrinter.size.validated ? ` ${activePrinter.size.w_mm}×${activePrinter.size.h_mm} ist eine abgeleitete Geometrie; Offset bei Bedarf feinjustieren.` : "";
      const extra = ios && activePrinter.id===4096 ? ` B1 + iOS (${bluetoothEnvironmentLabel()}) bleibt ein Hardware-Testpunkt.` : "";
      status(`${activePrinter.name} erkannt. Bereit zum Drucken.${derived}${extra}`, activePrinter.size.validated ? "ok" : "warn");
      if ((shortcutAutoprint || autoPrintPending) && els.qrText.value.trim()) {
        shortcutAutoprint = false;
        autoPrintPending = false;
        status("Drucker verbunden – automatischer Druck startet …","info");
        await printLabel();
      }
    } catch(e) {
      setConnected(false);
      status((automatic?"Automatische Verbindung nicht möglich: ":"Verbindung fehlgeschlagen: ")+e.message, automatic?"warn":"error");
    } finally {
      endBleChooserUi();
      els.connectBtn.disabled=false;
    }
  }

  function parseReturnTarget(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    try {
      const u = new URL(value, location.href);
      // HTTPS/HTTP Universal Links plus explicit app deep-link schemes are allowed.
      // Dangerous script/data/file schemes are always rejected.
      if (["javascript:","data:","file:","blob:"].includes(u.protocol)) return "";
      return u.href;
    } catch (_) {
      return "";
    }
  }

  async function returnToOriginAppAfterPrint() {
    if (!els.returnAfterPrint?.checked || !returnAfterPrintUrl) return false;
    const target = returnAfterPrintUrl;
    status("Druck abgeschlossen · Rückkehr zur Ursprungs-App wird versucht …","ok");
    await new Promise(r=>setTimeout(r,250));
    try {
      location.href = target;
      return true;
    } catch (_) {
      status("Druck abgeschlossen. Rückkehr konnte nicht gestartet werden.","warn");
      return false;
    }
  }

  async function printLabel() {
    const qr=els.qrText.value.trim();
    if(!qr || !connected) return;
    try {
      dirty=true; els.printBtn.disabled=true; els.connectBtn.disabled=true;
      status("Druckbild wird direkt aus dem Canvas vorbereitet …","info");
      // v12 prints the already rendered canvas directly through a Bluefy compatibility
      // bridge. The NIIMBOT driver's URL -> fetch -> Blob -> createImageBitmap path is
      // bypassed completely for this one print.
      await render(true);
      status("Canvas wird gepackt und übertragen …","info");
      await B1Printer.printCanvas(els.labelCanvas,{
        density:Number(els.density.value), copies:Number(els.copies.value), offsetY:Number(els.offsetY.value),
        onProgress:(s)=>status(typeof s==="string" ? s : "Druck läuft …","info")
      });
      const entry={
        id:uuid(), qr_text:qr, caption:els.caption.value.trim(), printer:activePrinter?.name || "NIIMBOT",
        label_size:els.labelSize.value, copies:Number(els.copies.value), density:Number(els.density.value), created_at:now()
      };
      try { await provider.addHistory(entry); await refreshLists(); } catch(_){}
      const disconnectAfter = !!els.disconnectAfterPrint?.checked;
      if (disconnectAfter) {
        status("Druckauftrag bestätigt. Bluetooth wird getrennt …","info");
        await new Promise(r=>setTimeout(r,800));
        try { await B1Printer.disconnect(); } catch (_) {}
        setConnected(false, "B1 verbinden");
        status("Druck abgeschlossen · Bluetooth getrennt. Der nächste Tab kann den bekannten Drucker direkt wieder verbinden.","ok");
        toast("Gedruckt · getrennt");
        await returnToOriginAppAfterPrint();
      } else {
        status("Druckauftrag vom Drucker bestätigt.","ok"); toast("Gedruckt");
        await returnToOriginAppAfterPrint();
      }
    } catch(e) {
      const msg = String(e && e.message || e || "Unbekannter Fehler");
      if (/load failed/i.test(msg)) {
        status("Druckfehler: Load failed trotz direktem Canvas-Pfad. Beim direkten Canvas-Pfad kommt das nicht vom Laden des Druckbilds; bitte Verbindung trennen, B1 neu einschalten und erneut verbinden. Fehlerdetails: "+msg,"error");
      } else {
        status("Druckfehler: "+msg+" – falls bereits Papier ausgegeben wurde, Druckbild prüfen.","error");
      }
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

  function truthyParam(value) {
    return ["1","true","yes","ja","on"].includes(String(value||"").toLowerCase());
  }

  function handoffPayloadFromParams(params) {
    const copy = new URLSearchParams(params);
    copy.delete("handoff");
    copy.delete("relay");
    return copy.toString();
  }

  function receiverStorageKey() { return HANDOFF_RECEIVER_PREFIX + handoffTabId; }
  function handoffInboxKey(tabId=handoffTabId) { return HANDOFF_INBOX_PREFIX + tabId; }

  function enqueueHandoffForTab(tabId, message) {
    if (!tabId || !message?.requestId) return false;
    try {
      const key=handoffInboxKey(tabId);
      let queue=[];
      try { const parsed=JSON.parse(localStorage.getItem(key)||"[]"); if(Array.isArray(parsed)) queue=parsed; } catch(_) {}
      queue=queue.filter(x=>x?.requestId && x.requestId!==message.requestId).slice(-19);
      queue.push({...message,targetTab:tabId,queuedAt:Date.now()});
      localStorage.setItem(key,JSON.stringify(queue));
      return true;
    } catch(_) { return false; }
  }

  let handoffInboxConsuming=false;
  async function consumeHandoffInbox() {
    if(handoffInboxConsuming) return;
    handoffInboxConsuming=true;
    try {
      const key=handoffInboxKey();
      let queue=[];
      try { const parsed=JSON.parse(localStorage.getItem(key)||"[]"); if(Array.isArray(parsed)) queue=parsed; } catch(_) {}
      if(!queue.length) return;
      const keep=[];
      for(const msg of queue){
        if(!msg?.requestId) continue;
        if(msg.targetTab && msg.targetTab!==handoffTabId){ keep.push(msg); continue; }
        try { await receiveHandoff(msg); } catch(_) { keep.push(msg); }
      }
      if(keep.length) localStorage.setItem(key,JSON.stringify(keep.slice(-20)));
      else localStorage.removeItem(key);
    } catch(_) {} finally { handoffInboxConsuming=false; }
  }

  let handoffConnectedSince = 0;
  function updateHandoffReceiverState() {
    // Keep a short, explicit lease for this exact browser document.  The BLE
    // connection itself lives in this document, therefore connected=true must
    // never be inferred from another tab or persisted across a reload.
    if (connected && !handoffConnectedSince) handoffConnectedSince = Date.now();
    if (!connected) handoffConnectedSince = 0;
    const state = {
      tabId: handoffTabId,
      connected: !!connected,
      connectedSince: handoffConnectedSince || 0,
      visible: document.visibilityState === "visible",
      focused: typeof document.hasFocus === "function" ? document.hasFocus() : false,
      ts: Date.now(),
      version: 24
    };
    try { localStorage.setItem(receiverStorageKey(), JSON.stringify(state)); } catch (_) {}
    if (connected) {
      try { localStorage.setItem(PRIMARY_PRINTER_TAB_KEY, JSON.stringify({tabId:handoffTabId,ts:Date.now(),version:24})); } catch (_) {}
    }
    try { handoffChannel?.postMessage({type:"receiver-state", ...state}); } catch (_) {}
  }

  function removeHandoffReceiverState() {
    try { localStorage.removeItem(receiverStorageKey()); } catch (_) {}
  }

  function sendHandoffAck(requestId, directSource=null) {
    const ack={type:"ack",requestId,receiverTab:handoffTabId,connected:!!connected,visible:document.visibilityState==="visible",focused:typeof document.hasFocus==="function"?document.hasFocus():false,ts:Date.now()};
    try { handoffChannel?.postMessage(ack); } catch(_) {}
    try { localStorage.setItem(HANDOFF_ACK_KEY, JSON.stringify(ack)); } catch(_) {}
    try { directSource?.postMessage({...ack,type:"NIIMBOT_HANDOFF_ACK"}, location.origin); } catch(_) {}
  }

  async function receiveHandoff(message, directSource=null) {
    if (!message || !["handoff","NIIMBOT_HANDOFF"].includes(message.type) || !message.requestId || message.sourceTab===handoffTabId) return;
    if (message.targetTab && message.targetTab!==handoffTabId) return;
    if (handledHandoffs.has(message.requestId)) { sendHandoffAck(message.requestId,directSource); return; }
    handledHandoffs.add(message.requestId);
    try {
      const params=new URLSearchParams(message.query||"");
      const changed=await applyShortcutParams({announce:true,paramsOverride:params});
      if (changed) {
        toast("Jira/QR-Link aus Bluefy übernommen");
        if (connected) status("Neues Label im bestehenden Drucker-Tab übernommen. B1 bleibt verbunden.","ok");
      }
      try { window.focus(); } catch(_) {}
    } finally {
      sendHandoffAck(message.requestId,directSource);
      updateHandoffReceiverState();
      if (handledHandoffs.size>50) handledHandoffs.delete(handledHandoffs.values().next().value);
    }
  }

  function receiveHandoffAck(message) {
    if (!message || !["ack","NIIMBOT_HANDOFF_ACK"].includes(message.type) || !message.requestId || message.receiverTab===handoffTabId) return;
    const resolve=pendingHandoffAcks.get(message.requestId);
    if (resolve) { pendingHandoffAcks.delete(message.requestId); resolve(message); }
  }

  function consumePendingHandoff() {
    try {
      const raw=localStorage.getItem(HANDOFF_STORAGE_KEY);
      if(!raw) return;
      const msg=JSON.parse(raw);
      if(!msg || !msg.requestId || !["handoff","NIIMBOT_HANDOFF"].includes(msg.type)) return;
      if(msg.sourceTab===handoffTabId) return;
      if(msg.targetTab && msg.targetTab!==handoffTabId) return;
      receiveHandoff(msg);
    } catch(_) {}
  }

  function setupHandoffReceiver() {
    // The normal print tab gets a stable browser-context name. A Bluefy helper
    // can use window.open('', 'niimbot-print') to find/focus it without reload.
    const relayParams=shortcutParams();
    const isRelay=truthyParam(relayParams.get("handoff") ?? relayParams.get("relay"));
    if (!isRelay) {
      try { window.name=`niimbot-tab-${handoffTabId}`; } catch(_) {}
      try { window.__NIIMBOT_HANDOFF_RECEIVER__=true; } catch(_) {}
      updateHandoffReceiverState();
    }
    if ("BroadcastChannel" in window) {
      try {
        handoffChannel=new BroadcastChannel(HANDOFF_CHANNEL_NAME);
        handoffChannel.addEventListener("message",e=>{
          const m=e.data;
          if(m?.type==="handoff") receiveHandoff(m);
          else if(m?.type==="ack") receiveHandoffAck(m);
        });
      } catch(_) { handoffChannel=null; }
    }
    addEventListener("storage",e=>{
      if(e.key===HANDOFF_STORAGE_KEY && e.newValue){ try{ receiveHandoff(JSON.parse(e.newValue)); }catch(_){} }
      if(e.key===handoffInboxKey() && e.newValue){ void consumeHandoffInbox(); }
      if(e.key===HANDOFF_ACK_KEY && e.newValue){ try{ receiveHandoffAck(JSON.parse(e.newValue)); }catch(_){} }
    });
    addEventListener("message",e=>{
      if(e.origin!==location.origin) return;
      const m=e.data;
      if(m?.type==="NIIMBOT_HANDOFF") receiveHandoff(m,e.source);
      else if(m?.type==="NIIMBOT_HANDOFF_ACK") receiveHandoffAck(m);
      else if(m?.type==="NIIMBOT_FOCUS_REQUEST") { try { window.focus(); } catch(_) {} }
    });
    addEventListener("visibilitychange",()=>{updateHandoffReceiverState(); if(document.visibilityState==="visible"){ consumePendingHandoff(); void consumeHandoffInbox(); }});
    addEventListener("pageshow",()=>{updateHandoffReceiverState(); consumePendingHandoff(); void consumeHandoffInbox();});
    addEventListener("focus",()=>{updateHandoffReceiverState(); consumePendingHandoff(); void consumeHandoffInbox();});
    addEventListener("blur",updateHandoffReceiverState);
    addEventListener("beforeunload",removeHandoffReceiverState);
    // Bluefy may keep several tabs alive. A short lease makes the currently
    // running/connected receiver distinguishable without a server endpoint.
    consumePendingHandoff();
    void consumeHandoffInbox();
    setInterval(()=>{updateHandoffReceiverState(); if(document.visibilityState==="visible"){ consumePendingHandoff(); void consumeHandoffInbox(); }},1500);
  }

  function bestReceiverFromStorage() {
    const now=Date.now(); let best=null;
    let primaryTabId="";
    try {
      const primary=JSON.parse(localStorage.getItem(PRIMARY_PRINTER_TAB_KEY)||"{}");
      if(primary.tabId && now-Number(primary.ts||0)<PRIMARY_LEASE_MS) primaryTabId=primary.tabId;
    } catch (_) {}
    try {
      const stale=[];
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i); if(!key?.startsWith(HANDOFF_RECEIVER_PREFIX)) continue;
        let item; try{item=JSON.parse(localStorage.getItem(key)||"{}");}catch(_){stale.push(key);continue;}
        const age=now-Number(item.ts||0);
        if(!item?.tabId || age>RECEIVER_LEASE_MS){ stale.push(key); continue; }
        if(item.tabId===handoffTabId) continue;
        // Priority is intentionally lexicographic: connected > visible/focused > age.
        // A recently connected background tab must beat a visible but unconnected helper.
        const score=(item.tabId===primaryTabId?100000000:0)+(item.connected?1000000:0)+(item.focused?10000:0)+(item.visible?5000:0)+Math.max(0,RECEIVER_LEASE_MS-age);
        if(!best||score>best.score) best={...item,ageMs:age,score};
      }
      for(const key of stale) try{localStorage.removeItem(key);}catch(_){}
    } catch(_) {}
    return best;
  }

  function tryDirectNamedHandoff(message) {
    try {
      const w=window.open("",PRINT_WINDOW_NAME);
      if(!w) return false;
      let marker=false; try{marker=w.__NIIMBOT_HANDOFF_RECEIVER__===true;}catch(_){}
      if(!marker){ try{w.close();}catch(_){} return false; }
      w.postMessage({...message,type:"NIIMBOT_HANDOFF"},location.origin);
      try{w.focus();}catch(_){}
      return true;
    } catch(_) { return false; }
  }

  function hasIncomingLabelShortcut(params=shortcutParams()) {
    return ["url","qr","quickchart","source","caption","text"].some(k=>params.has(k));
  }

  function connectedPrimaryReceiver() {
    const now=Date.now();
    try {
      const primary=JSON.parse(localStorage.getItem(PRIMARY_PRINTER_TAB_KEY)||"{}");
      if(!primary.tabId || primary.tabId===handoffTabId || now-Number(primary.ts||0)>PRIMARY_LEASE_MS) return null;
      const receiver=JSON.parse(localStorage.getItem(HANDOFF_RECEIVER_PREFIX+primary.tabId)||"{}");
      if(receiver.tabId===primary.tabId && receiver.connected) return {...receiver, persistentPrimary:true};
      // Safari may suspend background timers. The explicit primary lease was written
      // only by the tab that actually connected to the printer, so keep targeting it
      // even when its heartbeat is temporarily stale.
      return {tabId:primary.tabId, connected:true, persistentPrimary:true, ts:Number(primary.ts||0)};
    } catch(_) {}
    return null;
  }

  async function relayShortcutToExistingTabIfRequested() {
    const params=shortcutParams();
    const explicitRelay=truthyParam(params.get("handoff") ?? params.get("relay"));
    const primary=connectedPrimaryReceiver();
    const automaticSafariRelay=isIOSSafari() && hasIncomingLabelShortcut(params) && !!primary;
    if (!explicitRelay && !automaticSafariRelay) return false;
    const query=handoffPayloadFromParams(params);
    if (!query) return false;
    const requestId=uuid();
    const candidate=primary || bestReceiverFromStorage();
    const message={type:"handoff",requestId,sourceTab:handoffTabId,query,ts:Date.now(),targetTab:candidate?.tabId||""};
    const ackPromise=new Promise(resolve=>{
      pendingHandoffAcks.set(requestId,resolve);
      setTimeout(()=>{ if(pendingHandoffAcks.delete(requestId)) resolve(null); },2200);
    });
    tryDirectNamedHandoff(message);
    if(candidate?.tabId) enqueueHandoffForTab(candidate.tabId,message);
    try { handoffChannel?.postMessage(message); } catch(_) {}
    try { localStorage.setItem(HANDOFF_STORAGE_KEY,JSON.stringify(message)); } catch(_) {}
    if(candidate) setTimeout(()=>{
      if(!pendingHandoffAcks.has(requestId)) return;
      const broad={...message,targetTab:""};
      try { handoffChannel?.postMessage(broad); } catch(_) {}
      try { localStorage.setItem(HANDOFF_STORAGE_KEY,JSON.stringify(broad)); } catch(_) {}
    },700);
    const ack=await ackPromise;
    if (!ack) {
      // Safari can suspend the connected background tab. Keep the targeted payload
      // in localStorage; the primary tab consumes it on focus/pageshow. Do not apply
      // the Jira URL in this helper tab, otherwise the next handoff appears random.
      if (candidate?.tabId) {
        status("Übergabe für den verbundenen Drucktab vorgemerkt. Beim Wechsel zurück wird das Label automatisch übernommen.","info");
        document.title="Übergabe vorgemerkt · NIIMBOT QR Label";
        return true;
      }
      return false;
    }
    status(ack.connected?"An den verbundenen Drucktab übergeben. B1 bleibt verbunden.":"An den bereits offenen Drucktab übergeben.","ok");
    document.title="Übergeben · NIIMBOT QR Label";
    try { window.close(); } catch(_) {}
    return true;
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

  async function applyShortcutParams({announce=true,paramsOverride=null}={}) {
    shortcutNotice = "";
    const params = paramsOverride instanceof URLSearchParams ? paramsOverride : shortcutParams();
    if (![...params.keys()].length) return false;
    let changed = false;

    const source = params.get("quickchart") ?? params.get("source") ?? params.get("url");
    if (source !== null) {
      if (isQuickChartQrUrl(source)) changed = await importQuickChartFromValue(source,{announce:false}) || changed;
      else { els.sourceInput.value=source; els.qrText.value=source; await maybeApplyAssetCaption(source,{force:false}); changed=true; }
    } else {
      const qr = params.get("qr");
      const caption = params.get("text") ?? params.get("caption");
      if (qr !== null) {
        if (isQuickChartQrUrl(qr)) changed = await importQuickChartFromValue(qr,{announce:false}) || changed;
        else { els.qrText.value = qr; await maybeApplyAssetCaption(qr,{force:false}); changed = true; }
      }
      if (caption !== null && !isQuickChartQrUrl(qr || "")) { els.caption.value = caption; changed = true; }
    }

    if (params.has("subcaption")) {
      els.subcaption.value = String(params.get("subcaption") || "").slice(0,160);
      changed = true;
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

    const quietParam = params.get("quiet") ?? params.get("qrspace") ?? params.get("quietzone");
    if (quietParam !== null) {
      const q=Math.max(0,Math.min(8,Math.round(Number(quietParam)||0)));
      els.quietZone.value=String(q);
      updateQuietZoneUi();
      changed=true;
    }

    const returnRaw = params.get("return") ?? params.get("returnUrl") ?? "";
    if (returnRaw) {
      if (String(returnRaw).toLowerCase() === "shortcut") {
        const shortcutName = (params.get("shortcut") || els.returnShortcutName?.value || "").trim();
        if (shortcutName) returnAfterPrintUrl = "shortcuts://run-shortcut?name=" + encodeURIComponent(shortcutName);
        else shortcutNotice = "Return-Kurzbefehl gewählt, aber kein Kurzbefehlsname gesetzt.";
      } else {
        const parsedReturn = parseReturnTarget(returnRaw);
        if (parsedReturn) returnAfterPrintUrl = parsedReturn;
        else shortcutNotice = "Return-URL wurde aus Sicherheitsgründen verworfen.";
      }
    }

    const ap = String(params.get("autoprint")||"").toLowerCase();
    shortcutAutoprint = ["1","true","yes","ja"].includes(ap);
    // Explicit autoprint=1 always wins. Otherwise the persistent option only
    // applies to a real URL/shortcut payload, never to a restored old draft.
    if (shortcutAutoprint || (changed && els.autoPrintOnOpen?.checked)) autoPrintPending = true;

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
      if ((shortcutAutoprint || autoPrintPending) && connected) { shortcutAutoprint = false; autoPrintPending = false; await printLabel(); }
    }
    return changed;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
  }

  function isIOSSafari() {
    if (!isIOS()) return false;
    const ua = navigator.userAgent || "";
    return /Safari/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(ua);
  }

  function bluetoothEnvironmentLabel() {
    if (!isIOS()) return B1Printer.supported() ? "Natives Web Bluetooth" : "Kein Web Bluetooth";
    if (window.BLENative) return "Bluefy / native BLE-Bridge";
    if (beacioReady || window.beacioIOS || (isIOSSafari() && B1Printer.supported())) return "Safari + beacio";
    return isIOSSafari() ? "Safari · beacio noch nicht aktiv" : "iOS-Browser ohne BLE-Bridge";
  }

  function updateBleBridgeStatus() {
    if (!els.bleBridgeStatus) return;
    const supported=B1Printer.supported();
    const label=bluetoothEnvironmentLabel();
    els.bleBridgeStatus.className=`inline-status ${supported ? "ok" : "neutral"}`;
    els.bleBridgeStatus.innerHTML=`<span>${supported ? "✓" : "i"}</span><span>${label}${supported ? " · bereit für Geräteauswahl" : ""}</span>`;
  }

  function browserMessage() {
    const ios=isIOS();
    const supported=B1Printer.supported();
    updateBleBridgeStatus();
    if(supported) {
      if(ios && isIOSSafari() && !window.BLENative) status("Safari + beacio: Web Bluetooth ist aktiv. B1 einschalten und verbinden.","ok");
      else if(ios && window.BLENative) status("Bluefy: Web Bluetooth ist aktiv. B1 einschalten und verbinden.","ok");
      else status("Web Bluetooth verfügbar. B1 einschalten und verbinden.","ok");
    } else if(ios && isIOSSafari()) {
      status("Safari erkannt. Aktiviere die beacio-Erweiterung und erlaube sie dauerhaft für diese Website. Danach Bluetooth erneut prüfen bzw. die Seite neu öffnen.","warn");
    } else if(ios) {
      status("iPhone/iPad erkannt: bevorzugt Safari + beacio verwenden; Bluefy bleibt als Fallback möglich.","warn");
    } else {
      status("Web Bluetooth nicht verfügbar. Verwende Android/Desktop mit Chrome oder Edge.","warn");
    }
  }

  function installBeacioDetection() {
    const ready=()=>{ beacioReady=true; browserMessage(); };
    window.addEventListener("beacio:extension:ready", ready);
    window.addEventListener("beacio:ready", ready);
    // beacio injects navigator.bluetooth at document_start. With strict CSP the
    // bridge may arrive asynchronously, so re-check briefly without any CDN SDK.
    [150,500,1200,2200].forEach(ms=>setTimeout(browserMessage,ms));
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
    ["toast","statusBox","bleBridgeStatus","printerDot","connectBtn","connectAllBtn","connectLabel","printBtn","autoReconnectKnown","autoPrintOnOpen","disconnectAfterPrint","returnAfterPrint","returnShortcutName","knownPrinterInfo","sourceInput","qrText","caption","subcaption","labelSize","ecc","previewStage","previewViewport","labelCanvas","labelInfo","renderState","previewMm","pixelBadge",
     "density","densityOut","copies","offsetY","captionScale","captionScaleOut","quietZone","quietZoneOut","quietZoneInfo","quietZoneBlock","paramQuietZone","renderMode","renderModeInfo","invert","savePresetBtn","presetList","historyList","refreshItemsBtn","shareBtn","savePngBtn","savePdfBtn",
     "modeBadge","onlineBadge","settingsBtn","importStatus","showParamsBtn","scanQrBtn","scanImageBtn","pasteLinkBtn","scanImageInput","captureStatus","scanModal","scanVideo","scanCanvas","scanStatus","scanCloseBtn","scanCancelBtn","scanPhotoFallbackBtn","autoAssetCaption","jiraPrefix","paramsDetails","paramText","paramCaption","paramSubcaption","paramCaptionSize","paramSize","paramEcc","paramRenderMode","captionStatus","gridOverlay","safeOverlay","gridBtn","safeBtn","invertBtn","zoomOutBtn","zoomInBtn","zoomValue","designerEnabled","designerControls","designerEditBtn","designerLockBtn","designerRotateAllBtn","designerHitQr","designerHitCaption","designerHitSubcaption","designerX","designerXOut","designerY","designerYOut","designerScale","designerScaleOut","designerCenterBtn","designerResetElementBtn","designerResetAllBtn","designerInfo","designerSelection",
     "serverSettings","backendUrl","cfClientId","cfClientSecret","testServerBtn","saveServerBtn","clearServerBtn",
     "exportBtn","importFile","updateStatus","updateBtn","appVersion","onlineState"].forEach(id=>els[id]=$(id));
    setupHandoffReceiver();
    installBeacioDetection();
    await registerSW();
    if (await relayShortcutToExistingTabIfRequested()) return;
    els.appVersion.textContent="v"+APP_VERSION;
    els.qrText.value=await LocalStore.getSetting("draftQr","");
    els.sourceInput.value=await LocalStore.getSetting("draftSource",els.qrText.value);
    els.caption.value=await LocalStore.getSetting("draftCaption","");
    els.subcaption.value=await LocalStore.getSetting("draftSubcaption","");
    els.autoAssetCaption.checked=await LocalStore.getSetting("autoAssetCaption",true);
    els.jiraPrefix.value=sanitizePrefix(await LocalStore.getSetting("jiraPrefix","IAM"));
    if(els.autoAssetCaption.checked && new RegExp(`^${els.jiraPrefix.value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}-\\d+$`,"i").test(els.caption.value.trim())) { autoCaptionValue=els.caption.value.trim(); els.caption.dataset.auto="1"; }
    els.density.value=await LocalStore.getSetting("density",3); els.densityOut.value=els.density.value;
    els.copies.value=await LocalStore.getSetting("copies",1);
    els.captionScale.value=await LocalStore.getSetting("captionScale",0);
    els.quietZone.value=String(await LocalStore.getSetting("quietZone",4));
    els.renderMode.value=await LocalStore.getSetting("renderMode","local");
    if(els.renderMode.value==="auto"){ els.renderMode.value="local"; await LocalStore.setSetting("renderMode","local"); }
    const defaultSizeRevision=await LocalStore.getSetting("defaultLabelSizeRevision",0);
    let savedSize=await LocalStore.getSetting("labelSize","40x40");
    if (Number(defaultSizeRevision) < 5) {
      savedSize="40x40";
      await LocalStore.setSetting("labelSize",savedSize);
      await LocalStore.setSetting("defaultLabelSizeRevision",5);
      await LocalStore.setSetting("offsetY",B1Printer.LABEL_PRESETS["40x40"].sizes[4096].offset_y_px ?? 0);
    }
    setLabelSize(validLabelSizes.has(savedSize)?savedSize:"40x40",{persist:false,resetOffset:false});
    await loadDesignerState(els.labelSize.value);
    els.offsetY.value=await LocalStore.getSetting("offsetY",printerGeometry().size.offset_y_px ?? 0);
    updateCaptionScaleUi(); updateModeUi(); updateQuietZoneUi(); updateGeometryUi(); updateParamPanel(); setPreviewZoom(1);
    await loadProvider();
    els.autoReconnectKnown.checked = await LocalStore.getSetting("autoReconnectKnown", true);
    els.autoPrintOnOpen.checked = await LocalStore.getSetting("autoPrintOnOpen", false);
    els.disconnectAfterPrint.checked = await LocalStore.getSetting("disconnectAfterPrint", true);
    els.returnAfterPrint.checked = await LocalStore.getSetting("returnAfterPrint", false);
    els.returnShortcutName.value = await LocalStore.getSetting("returnShortcutName", "Zurück");
    const pref = B1Printer.preferredDevice?.();
    if (els.knownPrinterInfo) els.knownPrinterInfo.textContent = pref ? `Bekannter Drucker: ${pref.name || "NIIMBOT"}` : "Noch kein bekannter Drucker gespeichert";

    ["qrText","caption","subcaption","ecc","invert","captionScale","quietZone"].forEach(id=>els[id].addEventListener("input",()=>{ dirty=true; updateCaptionScaleUi(); updateQuietZoneUi(); render(); }));
    els.designerEnabled?.addEventListener("change",async()=>{
      designerState.enabled=els.designerEnabled.checked;
      if(designerState.enabled && els.renderMode.value!=="local"){
        els.renderMode.value="local";
        await LocalStore.setSetting("renderMode","local");
        updateModeUi();
        toast("Designer verwendet Offline-Rendering");
      }
      updateDesignerUi(); await saveDesignerState(); render(true);
    });
    document.querySelectorAll("[data-design-element]").forEach(btn=>btn.addEventListener("click",()=>{
      designerElement=btn.dataset.designElement || "qr";
      updateDesignerUi();
    }));
    const applyDesignerSliders=()=>{
      setDesignerPart({
        x:Number(els.designerX.value),
        y:Number(els.designerY.value),
        scale:Number(els.designerScale.value)
      },{persist:false});
    };
    [els.designerX,els.designerY,els.designerScale].forEach(control=>control?.addEventListener("input",applyDesignerSliders));
    [els.designerX,els.designerY,els.designerScale].forEach(control=>control?.addEventListener("change",()=>void saveDesignerState()));
    els.designerCenterBtn?.addEventListener("click",()=>setDesignerPart({x:50}));
    els.designerResetElementBtn?.addEventListener("click",()=>{
      designerState[designerElement]={...DESIGN_DEFAULTS[designerElement]};
      updateDesignerUi(); render(true); void saveDesignerState();
    });
    els.designerResetAllBtn?.addEventListener("click",()=>{
      const enabled=designerState.enabled;
      designerState=cloneDesignDefaults(); designerState.enabled=enabled;
      updateDesignerUi(); render(true); void saveDesignerState();
    });

    els.designerEditBtn?.addEventListener("click",()=>{ designerState.locked=false; updateDesignerUi(); void saveDesignerState(); });
    els.designerLockBtn?.addEventListener("click",()=>{ designerState.locked=true; updateDesignerUi(); void saveDesignerState(); });
    document.querySelectorAll("[data-design-rotation]").forEach(btn=>btn.addEventListener("click",()=>setDesignerPart({rotation:Number(btn.dataset.designRotation)||0})));
    els.designerRotateAllBtn?.addEventListener("click",()=>{
      for(const key of ["qr","caption","subcaption"]){ const d=designerState[key], x=d.x, y=d.y; d.x=100-y; d.y=x; d.rotation=((Number(d.rotation)||0)+90)%360; }
      updateDesignerUi(); render(true); void saveDesignerState();
    });
    const designerPointerPosition=(ev)=>{ const r=els.previewStage.getBoundingClientRect(); return {x:Math.max(0,Math.min(100,(ev.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(ev.clientY-r.top)/r.height*100))}; };
    document.querySelectorAll("[data-hit-element]").forEach(hit=>{
      hit.addEventListener("pointerdown",ev=>{
        if(!designerState.enabled || activeRenderMode()!=="local") return;
        designerElement=hit.dataset.hitElement||"qr"; updateDesignerUi();
        if(designerState.locked){ ev.preventDefault(); return; }
        const p=designerPointerPosition(ev), d=currentDesignPart();
        designerDrag={pointerId:ev.pointerId,offsetX:p.x-d.x,offsetY:p.y-d.y,hit};
        try{hit.setPointerCapture(ev.pointerId)}catch(_){}
        ev.preventDefault();
      });
      hit.addEventListener("pointermove",ev=>{ if(!designerDrag || designerDrag.pointerId!==ev.pointerId || designerDrag.hit!==hit || designerState.locked) return; const p=designerPointerPosition(ev); setDesignerPart({x:p.x-designerDrag.offsetX,y:p.y-designerDrag.offsetY},{persist:false}); ev.preventDefault(); });
      const finish=ev=>{ if(!designerDrag || designerDrag.pointerId!==ev.pointerId || designerDrag.hit!==hit) return; designerDrag=null; void saveDesignerState(); try{hit.releasePointerCapture(ev.pointerId)}catch(_){} };
      hit.addEventListener("pointerup",finish); hit.addEventListener("pointercancel",finish);
    });

    els.qrText.addEventListener("input",()=>{ LocalStore.setSetting("draftQr",els.qrText.value); setImportStatus(false); });
    els.subcaption.addEventListener("input",()=>LocalStore.setSetting("draftSubcaption",els.subcaption.value));
    const processSource = () => {
      LocalStore.setSetting("draftSource",els.sourceInput.value);
      clearTimeout(quickChartDetectTimer);
      quickChartDetectTimer=setTimeout(async()=>{
        const value=els.sourceInput.value.trim();
        if(!value) return;
        if(value) await applyCapturedValue(value,{origin:"Eingabe",announce:false});
      },90);
    };
    els.sourceInput.addEventListener("input",processSource);
    els.sourceInput.addEventListener("paste",()=>setTimeout(processSource,0));
    els.sourceInput.addEventListener("change",processSource);
    els.caption.addEventListener("input",()=>{ els.caption.dataset.auto="0"; autoCaptionValue=""; LocalStore.setSetting("draftCaption",els.caption.value); });
    els.autoAssetCaption.addEventListener("change",async()=>{ await LocalStore.setSetting("autoAssetCaption",els.autoAssetCaption.checked); if(els.autoAssetCaption.checked) await maybeApplyAssetCaption(els.qrText.value,{force:false}); render(true); });
    els.jiraPrefix.addEventListener("change",async()=>{ els.jiraPrefix.value=sanitizePrefix(els.jiraPrefix.value); await LocalStore.setSetting("jiraPrefix",els.jiraPrefix.value); if(els.caption.dataset.auto==="1") await maybeApplyAssetCaption(els.qrText.value,{force:true}); render(true); });
    els.captionScale.addEventListener("input",()=>{ updateCaptionScaleUi(); LocalStore.setSetting("captionScale",Number(els.captionScale.value)||0); });
    els.renderMode.addEventListener("change",()=>{ LocalStore.setSetting("renderMode",els.renderMode.value); updateModeUi(); dirty=true; render(true); });
    els.labelSize.addEventListener("change",()=>setLabelSize(els.labelSize.value,{persist:true,resetOffset:true}));
    document.querySelectorAll("[data-label-size]").forEach(btn=>btn.addEventListener("click",()=>{ els.labelSize.value=btn.dataset.labelSize; setLabelSize(els.labelSize.value,{persist:true,resetOffset:true}); }));
    document.querySelectorAll("[data-render-mode]").forEach(btn=>btn.addEventListener("click",()=>{ els.renderMode.value=btn.dataset.renderMode; LocalStore.setSetting("renderMode",els.renderMode.value); updateModeUi(); dirty=true; render(true); }));
    els.gridBtn.addEventListener("click",()=>{ const on=els.gridOverlay.classList.toggle("hidden"); els.gridBtn.classList.toggle("active",!on); });
    els.safeBtn.addEventListener("click",()=>{ const on=els.safeOverlay.classList.toggle("hidden"); els.safeBtn.classList.toggle("active",!on); });
    els.invertBtn.addEventListener("click",()=>{ els.invert.checked=!els.invert.checked; els.invertBtn.classList.toggle("active",els.invert.checked); render(true); });
    els.zoomOutBtn.addEventListener("click",()=>setPreviewZoom(previewZoom-.1));
    els.zoomInBtn.addEventListener("click",()=>setPreviewZoom(previewZoom+.1));
    els.showParamsBtn.addEventListener("click",()=>{ els.paramsDetails.open=true; els.paramsDetails.scrollIntoView({behavior:"smooth",block:"nearest"}); });
    els.settingsBtn.addEventListener("click",()=>document.getElementById("settingsSection")?.scrollIntoView({behavior:"smooth"}));
    els.density.addEventListener("input",()=>{ els.densityOut.value=els.density.value; LocalStore.setSetting("density",Number(els.density.value)); });
    els.copies.addEventListener("change",()=>LocalStore.setSetting("copies",Number(els.copies.value)));
    els.offsetY.addEventListener("change",()=>LocalStore.setSetting("offsetY",Number(els.offsetY.value)));
    els.scanQrBtn.addEventListener("click",startScanner);
    els.scanImageBtn.addEventListener("click",()=>els.scanImageInput.click());
    els.pasteLinkBtn.addEventListener("click",pasteFromClipboard);
    els.scanImageInput.addEventListener("change",()=>{ const f=els.scanImageInput.files?.[0]; if(f) scanImageFile(f).finally(()=>{els.scanImageInput.value="";}); });
    els.scanCloseBtn.addEventListener("click",stopScanner);
    els.scanCancelBtn.addEventListener("click",stopScanner);
    els.scanPhotoFallbackBtn.addEventListener("click",()=>{ stopScanner(); els.scanImageInput.click(); });
    els.scanModal.addEventListener("click",e=>{ if(e.target===els.scanModal) stopScanner(); });
    els.connectBtn.addEventListener("click",()=>connectPrinter({preferKnown:true}));
    els.connectAllBtn?.addEventListener("click",()=>connectPrinter({allDevices:true,preferKnown:false}));
    els.autoReconnectKnown?.addEventListener("change",()=>LocalStore.setSetting("autoReconnectKnown",els.autoReconnectKnown.checked));
    els.autoPrintOnOpen?.addEventListener("change",()=>LocalStore.setSetting("autoPrintOnOpen",els.autoPrintOnOpen.checked));
    els.disconnectAfterPrint?.addEventListener("change",()=>LocalStore.setSetting("disconnectAfterPrint",els.disconnectAfterPrint.checked));
    els.returnAfterPrint?.addEventListener("change",()=>LocalStore.setSetting("returnAfterPrint",els.returnAfterPrint.checked));
    els.returnShortcutName?.addEventListener("change",()=>LocalStore.setSetting("returnShortcutName",els.returnShortcutName.value.trim()));
    els.quietZone?.addEventListener("change",()=>LocalStore.setSetting("quietZone",quietZoneModules()));
    els.printBtn.addEventListener("click",printLabel);
    els.shareBtn.addEventListener("click",shareQrTarget);
    els.savePngBtn.addEventListener("click",savePngSmart);
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

    const online=()=>{ const on=navigator.onLine; els.onlineState.textContent=on?"online":"offline"; if(els.onlineBadge){ els.onlineBadge.textContent=on?"Online":"Offline"; els.onlineBadge.classList.toggle("offline",!on); } render(true); };
    addEventListener("online",online); addEventListener("offline",online); online();

    const shortcutApplied = await applyShortcutParams({announce:false});
    render(true); browserMessage();
    if (shortcutApplied) {
      if (shortcutNotice) status(shortcutNotice,"warn");
      else if (shortcutAutoprint) status("Kurzbefehl übernommen. Bekannter NIIMBOT wird wenn möglich automatisch verbunden.","ok");
      else status("Kurzbefehl übernommen. Vorschau ist druckbereit.","ok");
    }
    if (!connected && els.autoReconnectKnown?.checked && els.qrText.value.trim() && B1Printer.canReconnectKnown?.()) {
      await connectPrinter({preferKnown:true,knownOnly:true,automatic:true});
    }
    await refreshLists();
    addEventListener("hashchange",()=>applyShortcutParams({announce:true}));
    addEventListener("pagehide",stopScanner);
    setTimeout(()=>{ dirty=false; },200);
  }
  addEventListener("DOMContentLoaded", init);
})();
