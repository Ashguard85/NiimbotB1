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

  async function connect() {
    if (!window.Niimbot) throw new Error("NIIMBOT-Treiber wurde nicht geladen.");
    if (!supported()) throw new Error("Dieser Browser stellt kein Web Bluetooth bereit.");
    const info = await Niimbot.identify(chooserModel);
    const id = Number((Niimbot.printer && Niimbot.printer.modelId) || (info && info.modelId));
    if (!MODELS[id]) {
      throw new Error(`Verbundenes Modell ${id || "unbekannt"} wird von dieser v10 nicht unterstützt. Erwartet: B1 oder B1 Pro.`);
    }
    activeModel = MODELS[id];

    // B1 + iOS/Bluefy: use the driver's conservative transport settings.
    // The upstream driver documents that CoreBluetooth may cap unacknowledged
    // writes around 182 bytes; B1 frame bundling defaults to 240 bytes.
    const ua = navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
    if (activeModel.id === 4096) {
      if ("PACE_MS" in Niimbot) Niimbot.PACE_MS = Math.max(10, Number(Niimbot.PACE_MS || 10));
      if (ios) {
        if ("WRITE_MODE" in Niimbot) Niimbot.WRITE_MODE = "paced";
        if ("BUNDLE_MAX" in Niimbot) Niimbot.BUNDLE_MAX = 180;
      }
    }
    return current();
  }

  async function print(dataUrl, opts={}) {
    if (!window.Niimbot) throw new Error("NIIMBOT-Treiber wurde nicht geladen.");
    const density = Math.min(5, Math.max(1, Number(opts.density || 3)));
    const copies = Math.min(20, Math.max(1, Number(opts.copies || 1)));
    const cur = current();
    const offsetY = Number.isFinite(Number(opts.offsetY)) ? Number(opts.offsetY) : cur.size.offset_y_px || 0;
    return Niimbot.printImage(dataUrl, {
      model: cur.model,
      size: cur.size,
      density,
      copies,
      offsetY,
      onProgress: opts.onProgress
    });
  }

  window.B1Printer = { supported, connect, print, current, setSize, MODELS, LABEL_PRESETS };
})();
