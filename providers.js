(() => {
  "use strict";

  class LocalProvider {
    getItems(){ return LocalStore.getItems(); }
    getItem(id){ return LocalStore.getItem(id); }
    createItem(item){ return LocalStore.createItem(item); }
    updateItem(item){ return LocalStore.updateItem(item); }
    deleteItem(id){ return LocalStore.deleteItem(id); }
    addHistory(entry){ return LocalStore.addHistory(entry); }
    getHistory(){ return LocalStore.getHistory(); }
    exportData(){ return LocalStore.exportData(); }
    importData(payload,mode){ return LocalStore.importData(payload,mode); }
    async health(){ return {status:"ok", provider:"local"}; }
  }

  class ServerProvider {
    constructor(config){ this.config = config || {}; }
    headers(json=true){
      const h = {};
      if (json) h["Content-Type"] = "application/json";
      if (this.config.cfClientId) h["CF-Access-Client-Id"] = this.config.cfClientId;
      if (this.config.cfClientSecret) h["CF-Access-Client-Secret"] = this.config.cfClientSecret;
      return h;
    }
    url(path){
      const b = String(this.config.backendUrl || "").replace(/\/+$/,"");
      if (!/^https:\/\//i.test(b) && !/^http:\/\/localhost(?::\d+)?$/i.test(b)) throw new Error("Backend-URL muss HTTPS verwenden.");
      return b + path;
    }
    async req(path, options={}){
      const r = await fetch(this.url(path), {
        ...options,
        headers: {...this.headers(options.body !== undefined), ...(options.headers||{})}
      });
      if (!r.ok) {
        let msg = `Serverfehler ${r.status}`;
        try { const j = await r.json(); if (j.error) msg = j.error; } catch(_){}
        throw new Error(msg);
      }
      if (r.status === 204) return null;
      return r.json();
    }
    async getItems(){ const j=await this.req("/api/items"); return j.items; }
    async getItem(id){ return this.req("/api/items/"+encodeURIComponent(id)); }
    async createItem(item){ return this.req("/api/items",{method:"POST",body:JSON.stringify(item)}); }
    async updateItem(item){ return this.req("/api/items/"+encodeURIComponent(item.id),{method:"PUT",body:JSON.stringify(item)}); }
    async deleteItem(id){ await this.req("/api/items/"+encodeURIComponent(id),{method:"DELETE"}); return true; }
    async addHistory(entry){ return this.req("/api/history",{method:"POST",body:JSON.stringify(entry)}); }
    async getHistory(){ const j=await this.req("/api/history"); return j.history; }
    async exportData(){ return this.req("/api/export"); }
    async importData(payload,mode){ return this.req("/api/import",{method:"POST",body:JSON.stringify({payload,mode})}); }
    async health(){
      const r=await fetch(this.url("/health"),{headers:this.headers(false)});
      if(!r.ok) throw new Error(`Healthcheck ${r.status}`);
      return r.json();
    }
  }

  window.DataProviders = { LocalProvider, ServerProvider };
})();
