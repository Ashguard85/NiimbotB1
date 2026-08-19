(() => {
  "use strict";

  const LABEL_PRESETS = {
    "50x30": {
      key: "50x30", label: "50 × 30 mm", validated: true,
      sizes: {
        4096: { id:"T50x30_b1", w_px:384, h_px:240, offset_y_px:4, w_mm:50, h_mm:30, validated:true },
        4097: { id:"T50x30", w_px:584, h_px:354, offset_y_px:0, w_mm:50, h_mm:30, validated:true },
        4608: { id:"T50x30_m2h", w_px:567, h_px:354, offset_y_px:0, w_mm:50, h_mm:30, validated:true }
      }
    },
    "40x40": {
      key: "40x40", label: "40 × 40 mm", validated: false,
      sizes: {
        // Derived from nominal 203 dpi / 300 dpi geometry. Fine-tune offset on real stock.
        4096: { id:"C40x40_b1", w_px:320, h_px:320, offset_y_px:0, w_mm:40, h_mm:40, validated:false },
        4097: { id:"C40x40_b1pro", w_px:472, h_px:472, offset_y_px:0, w_mm:40, h_mm:40, validated:false },
        4608: { id:"C40x40_m2h", w_px:472, h_px:472, offset_y_px:0, w_mm:40, h_mm:40, validated:false }
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
    },
    4608: {
      name: "NIIMBOT M2-H", id:4608, dpi:300,
      model: { id:4608, name_prefixes:["M2","M2-H"], task:"b1", density:3, label_type:1, speed:1, dpi:300 }
    }
  };

  const NIIMBOT_NAME_PREFIXES = ["B1","B2","B21","M2","D11","D110","N1","NIIMBOT"];
  const chooserModel = { id:4096, name_prefixes:["B1","M2","M2-H"], task:"b1", density:3, label_type:1, speed:1, dpi:203 };
  let activeModel = MODELS[4096];
  let activeSizeKey = "40x40";
  let activeDevice = null;
  const PREFERRED_DEVICE_KEY = "niimbotPreferredDeviceV1";

  function supported() {
    return !!(window.Niimbot && typeof Niimbot.isSupported === "function" && Niimbot.isSupported());
  }

  function geometry(modelId=activeModel.id, key=activeSizeKey) {
    const preset = LABEL_PRESETS[key] || LABEL_PRESETS["40x40"];
    const size = preset.sizes[modelId];
    if (!size) throw new Error(`Für ${MODELS[modelId]?.name || "Modell "+modelId} ist ${key} noch nicht hinterlegt.`);
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

  function readPreferredDevice() {
    try { return JSON.parse(localStorage.getItem(PREFERRED_DEVICE_KEY) || "null"); } catch (_) { return null; }
  }

  function rememberDevice(device) {
    if (!device) return;
    activeDevice = device;
    try {
      localStorage.setItem(PREFERRED_DEVICE_KEY, JSON.stringify({
        id: device.id || "",
        name: device.name || "",
        ts: Date.now()
      }));
    } catch (_) {}
  }

  function forgetPreferredDevice() {
    try { localStorage.removeItem(PREFERRED_DEVICE_KEY); } catch (_) {}
  }

  async function findRememberedDevice(onStage) {
    const bt = navigator.bluetooth;
    if (!bt || typeof bt.getDevices !== "function") return null;
    const pref = readPreferredDevice();
    if (!pref) return null;
    onStage?.({ stage:"known-search", detail:"Bekannter NIIMBOT wird gesucht" });
    let devices = [];
    try { devices = await bt.getDevices(); }
    catch (e) {
      onStage?.({ stage:"known-unavailable", detail:`Bekannte Geräte konnten nicht gelesen werden: ${e.message || e}` });
      return null;
    }
    const byId = pref.id ? devices.find(d => d && d.id === pref.id) : null;
    const byName = !byId && pref.name ? devices.find(d => d && d.name === pref.name) : null;
    const device = byId || byName || null;
    if (device) onStage?.({ stage:"known-found", detail:device.name || "Bekannter NIIMBOT gefunden", device });
    else onStage?.({ stage:"known-missing", detail:"Bekannter NIIMBOT ist in getDevices() nicht vorhanden" });
    return device;
  }

  function installRequestDeviceOverride(onStage, {allDevices=false, forcedDevice=null}={}) {
    const bt = navigator.bluetooth;
    if (!bt || typeof bt.requestDevice !== "function") return () => {};
    const original = bt.requestDevice;
    const useNeutral = shouldUseNeutralChooser();

    const wrapped = async function(options = {}) {
      if (forcedDevice) {
        onStage?.({ stage:"known-selected", detail:forcedDevice.name || "Bekannter NIIMBOT", device:forcedDevice });
        rememberDevice(forcedDevice);
        return forcedDevice;
      }

      let requestOptions = options;
      if (useNeutral) {
        const optionalServices = Array.isArray(options.optionalServices) ? options.optionalServices : [];
        onStage?.({ stage:"chooser", detail:"beacio-Gerätewähler geöffnet" });
        const chooserOptions = allDevices
          ? { acceptAllDevices:true }
          : { filters: NIIMBOT_NAME_PREFIXES.map(namePrefix => ({namePrefix})) };
        requestOptions = {
          ...chooserOptions,
          ...(optionalServices.length ? { optionalServices } : {})
        };
      }
      const device = await original.call(bt, requestOptions);
      rememberDevice(device);
      onStage?.({ stage:"selected", detail: device?.name || "Bluetooth-Gerät gewählt", device });
      return device;
    };

    let restored = false;
    try { bt.requestDevice = wrapped; } catch (_) {}
    if (bt.requestDevice !== wrapped) {
      try { Object.defineProperty(bt, "requestDevice", { configurable:true, writable:true, value:wrapped }); } catch (_) {}
    }
    if (bt.requestDevice !== wrapped) throw new Error("Bluetooth-Gerätewähler konnte nicht vorbereitet werden.");

    return () => {
      if (restored) return; restored = true;
      try { bt.requestDevice = original; } catch (_) {}
      if (bt.requestDevice !== original) {
        try { Object.defineProperty(bt, "requestDevice", { configurable:true, writable:true, value:original }); } catch (_) {}
      }
    };
  }

  async function connectOnce(opts={}, forcedDevice=null) {
    const onStage = typeof opts.onStage === "function" ? opts.onStage : null;
    let restoreChooser = () => {};
    try {
      restoreChooser = installRequestDeviceOverride(onStage, {allDevices:!!opts.allDevices, forcedDevice});
      onStage?.({ stage:"identify", detail:"NIIMBOT-Erkennung wird gestartet" });
      const info = await Niimbot.identify(chooserModel);
      onStage?.({ stage:"identified", detail:"NIIMBOT-Gerät erkannt", info });
      const id = Number((Niimbot.printer && Niimbot.printer.modelId) || (info && info.modelId));
      if (!MODELS[id]) {
        throw new Error(`Verbundenes Modell ${id || "unbekannt"} wird von dieser Version nicht unterstützt. Unterstützt: B1, B1 Pro und M2-H.`);
      }
      activeModel = MODELS[id];
      if (activeDevice) {
        try {
          const pref = readPreferredDevice() || {};
          localStorage.setItem(PREFERRED_DEVICE_KEY, JSON.stringify({
            id: activeDevice.id || pref.id || "",
            name: activeDevice.name || pref.name || activeModel.name,
            modelId: activeModel.id,
            modelName: activeModel.name,
            dpi: activeModel.dpi,
            ts: Date.now()
          }));
        } catch (_) {}
      }

      const ios = isIOS();
      if (activeModel.model.task === "b1") {
        if ("PACE_MS" in Niimbot) Niimbot.PACE_MS = Math.max(10, Number(Niimbot.PACE_MS || 10));
        if (ios) {
          if ("WRITE_MODE" in Niimbot) Niimbot.WRITE_MODE = "paced";
          if ("BUNDLE_MAX" in Niimbot) Niimbot.BUNDLE_MAX = 180;
        }
      }
      if (forcedDevice) rememberDevice(forcedDevice);
      onStage?.({ stage:"connected", detail:`${activeModel.name} verbunden`, printer:current(), device:activeDevice });
      return current();
    } finally {
      restoreChooser();
    }
  }

  async function connect(opts={}) {
    if (!window.Niimbot) throw new Error("NIIMBOT-Treiber wurde nicht geladen.");
    if (!supported()) throw new Error("Dieser Browser stellt kein Web Bluetooth bereit.");
    const onStage = typeof opts.onStage === "function" ? opts.onStage : null;

    if (opts.preferKnown && !opts.allDevices) {
      const known = await findRememberedDevice(onStage);
      if (known) {
        try {
          return await connectOnce(opts, known);
        } catch (e) {
          onStage?.({ stage:"known-failed", detail:`Automatische Verbindung fehlgeschlagen: ${e.message || e}` });
          activeDevice = null;
          if (opts.knownOnly) throw e;
          forgetPreferredDevice();
        }
      } else if (opts.knownOnly) {
        throw new Error("Kein bereits freigegebener NIIMBOT über navigator.bluetooth.getDevices() gefunden.");
      }
    }
    return connectOnce(opts, null);
  }

  async function connectKnown(opts={}) {
    return connect({...opts, preferKnown:true, knownOnly:true});
  }

  async function disconnect() {
    const device = activeDevice;
    try {
      if (device?.gatt?.connected) device.gatt.disconnect();
    } catch (_) {}
    activeDevice = null;
    return true;
  }

  function preferredDevice() {
    return readPreferredDevice();
  }

  function canReconnectKnown() {
    return !!(navigator.bluetooth && typeof navigator.bluetooth.getDevices === "function" && readPreferredDevice());
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

  window.B1Printer = { supported, connect, connectKnown, disconnect, preferredDevice, canReconnectKnown, printCanvas, current, setSize, MODELS, LABEL_PRESETS };
})();
