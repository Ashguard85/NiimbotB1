(() => {
  "use strict";

  const MODELS = {
    4096: {
      name: "NIIMBOT B1",
      id: 4096, dpi: 203,
      model: { id:4096, name_prefixes:["B1"], task:"b1", density:3, label_type:1, speed:1, dpi:203 },
      size: { id:"T50x30_b1", w_px:384, h_px:240, offset_y_px:4, w_mm:50, h_mm:30 }
    },
    4097: {
      name: "NIIMBOT B1 Pro",
      id: 4097, dpi: 300,
      model: { id:4097, name_prefixes:["B1"], task:"v4", density:3, label_type:1, speed:1, dpi:300 },
      size: { id:"T50x30", w_px:584, h_px:354, offset_y_px:0, w_mm:50, h_mm:30 }
    }
  };
  const chooserModel = { id:4096, name_prefixes:["B1"], task:"b1", density:3, label_type:1, speed:1, dpi:203 };
  let active = MODELS[4096];

  function supported() {
    return !!(window.Niimbot && typeof Niimbot.isSupported === "function" && Niimbot.isSupported());
  }

  async function connect() {
    if (!window.Niimbot) throw new Error("NIIMBOT-Treiber wurde nicht geladen.");
    if (!supported()) throw new Error("Dieser Browser stellt kein Web Bluetooth bereit.");
    const info = await Niimbot.identify(chooserModel);
    const id = Number((Niimbot.printer && Niimbot.printer.modelId) || (info && info.modelId));
    if (!MODELS[id]) {
      throw new Error(`Verbundenes Modell ${id || "unbekannt"} wird von dieser v3 nicht unterstützt. Erwartet: B1 oder B1 Pro.`);
    }
    active = MODELS[id];
    // Safe default for B1 and CoreBluetooth/iOS.
    if (active.id === 4096 && "PACE_MS" in Niimbot) Niimbot.PACE_MS = Math.max(10, Number(Niimbot.PACE_MS || 10));
    return active;
  }

  async function print(dataUrl, opts={}) {
    if (!window.Niimbot) throw new Error("NIIMBOT-Treiber wurde nicht geladen.");
    const density = Math.min(5, Math.max(1, Number(opts.density || 3)));
    const copies = Math.min(20, Math.max(1, Number(opts.copies || 1)));
    const offsetY = Number.isFinite(Number(opts.offsetY)) ? Number(opts.offsetY) : active.size.offset_y_px || 0;
    return Niimbot.printImage(dataUrl, {
      model: active.model,
      size: active.size,
      density,
      copies,
      offsetY,
      onProgress: opts.onProgress
    });
  }

  function current(){ return active; }
  window.B1Printer = { supported, connect, print, current, MODELS };
})();
