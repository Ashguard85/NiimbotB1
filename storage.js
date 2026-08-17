(() => {
  "use strict";
  const DB_NAME = "qr-label-v1";
  const DB_VERSION = 2;
  const SECRET_KEYS = new Set(["cfClientSecret", "cfClientId", "backendUrl"]);

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("items")) {
          const s = db.createObjectStore("items", { keyPath: "id" });
          s.createIndex("updated_at", "updated_at");
        }
        if (!db.objectStoreNames.contains("history")) {
          const s = db.createObjectStore("history", { keyPath: "id" });
          s.createIndex("created_at", "created_at");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(store, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      try { result = fn(s); } catch (e) { db.close(); reject(e); return; }
      t.oncomplete = () => { db.close(); resolve(result); };
      t.onerror = () => { const e=t.error; db.close(); reject(e); };
      t.onabort = () => { const e=t.error; db.close(); reject(e); };
    });
  }

  function reqp(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const api = {
    async getItems() {
      const db = await openDb();
      const out = await reqp(db.transaction("items").objectStore("items").getAll());
      db.close();
      return out.sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    },
    async getItem(id) {
      const db = await openDb();
      const out = await reqp(db.transaction("items").objectStore("items").get(id));
      db.close();
      return out || null;
    },
    async createItem(item) {
      await tx("items","readwrite",s=>s.put(item)); return item;
    },
    async updateItem(item) {
      await tx("items","readwrite",s=>s.put(item)); return item;
    },
    async deleteItem(id) {
      await tx("items","readwrite",s=>s.delete(id)); return true;
    },
    async addHistory(entry) {
      await tx("history","readwrite",s=>s.put(entry));
      const all = await api.getHistory();
      for (const old of all.slice(50)) await tx("history","readwrite",s=>s.delete(old.id));
      return entry;
    },
    async getHistory() {
      const db = await openDb();
      const out = await reqp(db.transaction("history").objectStore("history").getAll());
      db.close();
      return out.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    },
    async getSetting(key, fallback=null) {
      const db = await openDb();
      const out = await reqp(db.transaction("settings").objectStore("settings").get(key));
      db.close();
      return out ? out.value : fallback;
    },
    async setSetting(key, value) {
      await tx("settings","readwrite",s=>s.put({key,value})); return value;
    },
    async deleteSetting(key) {
      await tx("settings","readwrite",s=>s.delete(key));
    },
    async exportData() {
      const items = await api.getItems();
      const history = await api.getHistory();
      const db = await openDb();
      const settings = await reqp(db.transaction("settings").objectStore("settings").getAll());
      db.close();
      const safeSettings = {};
      for (const row of settings) if (!SECRET_KEYS.has(row.key)) safeSettings[row.key] = row.value;
      return {
        format: "qr-label-backup",
        version: 2,
        exported_at: new Date().toISOString(),
        data: { items, history, settings: safeSettings }
      };
    },
    async importData(payload, mode="merge") {
      if (!payload || payload.format !== "qr-label-backup" || ![1,2].includes(Number(payload.version)) || !payload.data) {
        throw new Error("Ungültiges Backup-Format.");
      }
      const items = Array.isArray(payload.data.items) ? payload.data.items : [];
      const history = Array.isArray(payload.data.history) ? payload.data.history : [];
      if (mode === "replace") {
        await tx("items","readwrite",s=>s.clear());
        await tx("history","readwrite",s=>s.clear());
      }
      for (const item of items) await tx("items","readwrite",s=>s.put(item));
      for (const row of history) await tx("history","readwrite",s=>s.put(row));
      const settings = payload.data.settings || {};
      for (const [key,value] of Object.entries(settings)) {
        if (!SECRET_KEYS.has(key)) await api.setSetting(key,value);
      }
      return { items: items.length, history: history.length };
    }
  };

  window.LocalStore = api;
})();
