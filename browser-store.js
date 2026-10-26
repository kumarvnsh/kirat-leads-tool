/* Browser-local persistence. The interface keeps UI edits independent of storage. */
(function (root) {
  'use strict';
  root.createKiratStore = function (onState) {
    const s = { mode: 'connecting', pending: new Map(), failed: new Map(), running: false, error: '' };
    let db; const waiters = [];
    function settled() { if (!s.running && !s.pending.size) waiters.splice(0).forEach(w => s.failed.size ? w.reject(new Error(s.error)) : w.resolve()); }
    const emit = () => onState({ mode: s.mode, error: s.error,
      status: s.mode === 'connecting' ? 'loading' : s.mode === 'load_error' ? 'error' :
        s.mode === 'memory' || s.failed.size ? 'unsaved' : s.pending.size || s.running ? 'saving' : 'saved' });
    function transact(mode, action) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('leads', mode);
        const request = action(tx.objectStore('leads'));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Storage transaction failed'));
      });
    }
    async function run() {
      if (s.running || s.mode !== 'personal') return;
      s.running = true; emit();
      while (s.pending.size) {
        const [id, value] = s.pending.entries().next().value;
        s.pending.delete(id);
        try {
          await transact('readwrite', store => value ? store.put(root.KiratCore.pickLead(value)) : store.delete(id));
          s.failed.delete(id);
        } catch (e) {
          if (!s.pending.has(id)) s.failed.set(id, value);
          s.error = 'Could not save in this browser: ' + e.message;
        }
        emit();
      }
      s.running = false; emit(); settled();
    }
    return {
      async connect() {
        s.mode = 'connecting'; emit();
        try {
          if (db) db.close();
          db = await new Promise((resolve, reject) => {
            const req = root.indexedDB.open('kirat-lead-desk', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('leads', { keyPath: 'id' });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error('Close other Lead Desk tabs and retry.'));
          });
          db.onversionchange = () => db.close();
          const records = await transact('readonly', store => store.getAll());
          s.mode = 'personal'; s.error = ''; emit();
          return records.map(root.KiratCore.pickLead);
        } catch (e) {
          s.mode = 'load_error'; s.error = 'Saved leads could not load. Nothing was overwritten. ' + e.message;
          emit(); return null;
        }
      },
      flush() { if (s.mode !== 'personal') return Promise.reject(new Error('Native register is not ready')); if (!s.running && !s.pending.size) return s.failed.size ? Promise.reject(new Error(s.error)) : Promise.resolve(); return new Promise((resolve,reject)=>waiters.push({resolve,reject})); },
      save(value) { if (s.mode !== 'personal') return emit(); s.pending.set(value.id, value); s.failed.delete(value.id); run(); },
      remove(id) { if (s.mode !== 'personal') return emit(); s.pending.set(id, null); s.failed.delete(id); run(); },
      retry() { s.failed.forEach((v, k) => s.pending.set(k, v)); s.failed.clear(); s.error = ''; run(); },
      useMemory() { s.mode = 'memory'; s.error = 'Working without saving.'; emit(); },
      get mode() { return s.mode; }
    };
  };
})(window);
