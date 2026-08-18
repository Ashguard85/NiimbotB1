(() => {
  "use strict";

  const LABEL_PRESETS = {
    "50x30": {
      key: "50x30", label: "50 × 30 mm", validated: true,
      sizes: {
        4096: { id:"T50x30_b1", w_px:384, h_px:240, offset_y_px:4, w_mm:50, h_mm:30, validated:true },
        4097: { id:"T50x30", w_px:584, h_px:354, offset_y_px:0, w_mm:50, h_mm:30, validated:true }
      }
    },
    "40x40": {
      key: "40x40", label: "40 × 40 mm", validated: false,
      sizes: {
        // Derived from nominal 203 dpi / 300 dpi geometry. Fine-tune offset on real stock.
        4096: { id:"C40x40_b1", w_px:320, h_px:320, offset_y_px:0, w_mm:40, h_mm:40, validated:false },
        4097: { id:"C40x40_b1pro", w_px:472, h_px:472, offset_y_px:0, w_mm:40, h_mm:40, validated:false }
      }
    }
  };

  const MODELS = {
    4096: {
      name: "NIIMBOT B1", id:4096, dpi:203,
      model: { id:4096, name_prefixes:["B1"], task:"b1", density:3, label_type:1, speed:1, dpi:203 }
    },
    4097: {
      name: "NIIMBOT B1 Pro", id:4097, dpi:300,
      model: { id:4097, name_prefixes:["B1"], task:"v4", density:3, label_type:1, speed:1, dpi:300 }
    }
  };

  const NIIMBOT_NAME_PREFIXES = ["B1","B2","B21","M2","D11","D110","N1","NIIMBOT"];
  const chooserModel = { id:4096, name_prefixes:["B1"], task:"b1", density:3, label_type:1, speed:1, dpi:203 };
  let activeModel = MODELS[4096];
  let activeSizeKey = "40x40";

  function supported() {
    return !!(window.Niimbot && typeof Niimbot.isSupported === "function" && Niimbot.isSupported());
  }

  function geometry(modelId=activeModel.id, key=activeSizeKey) {
    const preset = LABEL_PRESETS[key] || LABEL_PRESETS["40x40"];
    const size = preset.sizes[modelId] || preset.sizes[4096];
    return {...size};
  }

  function current() {
    return {...activeModel, sizeKey:activeSizeKey, size:geometry(activeModel.id, activeSizeKey)};
  }

  function setSize(key) {
    if (!LABEL_PRESETS[key]) throw new Error(`Unbekanntes Labelformat: ${key}`);
    activeSizeKey = key;
    return current();
  }

  function isIOS() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
  }

  function isBluefy() {
    return !!window.BLENative;
  }

  function shouldUseNeutralChooser() {
    // Safari + beacio exposes navigator.bluetooth but not Bluefy's BLENative bridge.
    // In this environment a restrictive NIIMBOT name/service filter may cause the
    // chooser to stall even though beacio itself can see the printer.
    return isIOS() && !isBluefy() && !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  function installRequestDeviceOverride(onStage, {allDevices=false}={}) {
    if (!shouldUseNeutralChooser()) return () => {};
    const bt = navigator.bluetooth;
    const original = bt.requestDevice;
    if (typeof original !== "function") return () => {};

    const neutral = async function(options = {}) {
      const optionalServices = Array.isArray(options.optionalServices) ? options.optionalServices : [];
      onStage?.({ stage:"chooser", detail:"Neutraler beacio-Gerätewähler geöffnet" });
      const chooserOptions = allDevices
        ? { acceptAllDevices:true }
        : { filters: NIIMBOT_NAME_PREFIXES.map(namePrefix => ({namePrefix})) };
      const device = await original.call(bt, {
        ...chooserOptions,
        ...(optionalServices.length ? { optionalServices } : {})
      });
      onStage?.({ stage:"selected", detail: device?.name || "Bluetooth-Gerät gewählt", device });
      return device;
    };

    let restored = false;
    try { bt.requestDevice = neutral; } catch (_) {}
    if (bt.requestDevice !== neutral) {
      try { Object.defineProperty(bt, "requestDevice", { configurable:true, writable:true, value:neutral }); } catch (_) {}
    }
    if (bt.requestDevice !== neutral) throw new Error("beacio-Gerätewähler konnte nicht aktiviert werden.");

    return () => {
      if (restored) return; restored = true;
      try { bt.requestDevice = original; } catch (_) {}
      if (bt.requestDevice !== original) {
        try { Object.defineProperty(bt, "requestDevice", { configurable:true, writable:true, value:original }); } catch (_) {}
      }
    };
  }

  async function connect(opts={}) {
    if (!window.Niimbot) throw new Error("NIIMBOT-Treiber wurde nicht geladen.");
    if (!supported()) throw new Error("Dieser Browser stellt kein Web Bluetooth bereit.");
    const onStage = typeof opts.onStage === "function" ? opts.onStage : null;
    let restoreChooser = () => {};
    try {
      restoreChooser = installRequestDeviceOverride(onStage, {allDevices:!!opts.allDevices});
      onStage?.({ stage:"identify", detail:"NIIMBOT-Erkennung wird gestartet" });
      const info = await Niimbot.identify(chooserModel);
      onStage?.({ stage:"identified", detail:"NIIMBOT-Gerät erkannt", info });
      const id = Number((Niimbot.printer && Niimbot.printer.modelId) || (info && info.modelId));
    if (!MODELS[id]) {
      throw new Error(`Verbundenes Modell ${id || "unbekannt"} wird von dieser Version nicht unterstützt. Erwartet: B1 oder B1 Pro.`);
    }
    activeModel = MODELS[id];

    // B1 + iOS/CoreBluetooth: use the driver's conservative transport settings.
    // The upstream driver documents that CoreBluetooth may cap unacknowledged
    // writes around 182 bytes; B1 frame bundling defaults to 240 bytes.
    const ios = isIOS();
    if (activeModel.id === 4096) {
      if ("PACE_MS" in Niimbot) Niimbot.PACE_MS = Math.max(10, Number(Niimbot.PACE_MS || 10));
      if (ios) {
        if ("WRITE_MODE" in Niimbot) Niimbot.WRITE_MODE = "paced";
        if ("BUNDLE_MAX" in Niimbot) Niimbot.BUNDLE_MAX = 180;
      }
    }
      onStage?.({ stage:"connected", detail:`${activeModel.name} verbunden`, printer:current() });
      return current();
    } finally {
      restoreChooser();
    }
  }

  function installGlobalOverride(name, value) {
    const hadOwn = Object.prototype.hasOwnProperty.call(window, name);
    const descriptor = Object.getOwnPropertyDescriptor(window, name);
    const previous = window[name];
    let installed = false;
    try {
      window[name] = value;
      installed = window[name] === value;
    } catch (_) {}
    if (!installed) {
      try {
        Object.defineProperty(window, name, { configurable: true, writable: true, value });
        installed = window[name] === value;
      } catch (_) {}
    }
    if (!installed) throw new Error(`iOS-Kompatibilitätsadapter konnte window.${name} nicht temporär ersetzen.`);
    return () => {
      try {
        if (hadOwn && descriptor) Object.defineProperty(window, name, descriptor);
        else if (hadOwn) window[name] = previous;
        else delete window[name];
      } catch (_) {
        try { window[name] = previous; } catch (_) {}
      }
    };
  }

  async function printCanvas(canvas, opts={}) {
    if (!window.Niimbot) throw new Error("NIIMBOT-Treiber wurde nicht geladen.");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Druckbild ist kein Canvas.");

    const density = Math.min(5, Math.max(1, Number(opts.density || 3)));
    const copies = Math.min(20, Math.max(1, Number(opts.copies || 1)));
    const cur = current();
    const offsetY = Number.isFinite(Number(opts.offsetY)) ? Number(opts.offsetY) : cur.size.offset_y_px || 0;

    // niimbot-web-bluetooth 2.4.0 expects an image URL and internally executes:
    // fetch(url) -> response.blob() -> createImageBitmap(blob) -> drawImage(...).
    // iOS/WebKit can fail in that load/decode path with the generic "Load failed".
    // For printing we already HAVE the fully rendered canvas, so v11 bridges exactly
    // that one driver request back to this canvas. No URL is loaded, no Blob is decoded.
    const sentinelUrl = `https://niimbot-canvas.invalid/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sentinel = Object.freeze({ __niimbotCanvasBridge: true, canvas });
    const nativeFetch = window.fetch;
    const nativeCreateImageBitmap = window.createImageBitmap;

    if (typeof nativeFetch !== "function") throw new Error("Browser-Fetch fehlt; NIIMBOT-Treiber kann nicht gestartet werden.");

    const bridgeFetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input && input.url) || String(input || "");
      if (url === sentinelUrl) {
        return {
          ok: true,
          status: 200,
          blob: async () => sentinel
        };
      }
      return nativeFetch.call(window, input, init);
    };

    const bridgeCreateImageBitmap = async (source, ...args) => {
      if (source === sentinel) return canvas;
      if (typeof nativeCreateImageBitmap === "function") return nativeCreateImageBitmap.call(window, source, ...args);
      throw new Error("createImageBitmap ist in diesem Browser nicht verfügbar.");
    };

    const restoreFetch = installGlobalOverride("fetch", bridgeFetch);
    let restoreBitmap;
    try {
      restoreBitmap = installGlobalOverride("createImageBitmap", bridgeCreateImageBitmap);
      return await Niimbot.printImage(sentinelUrl, {
        model: cur.model,
        size: cur.size,
        density,
        copies,
        offsetY,
        onProgress: opts.onProgress
      });
    } finally {
      if (restoreBitmap) restoreBitmap();
      restoreFetch();
    }
  }

  window.B1Printer = { supported, connect, printCanvas, current, setSize, MODELS, LABEL_PRESETS };
})();
