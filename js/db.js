// ============================================================
// PARSLEY'S FARM — Local Database (IndexedDB)
// Offline-first: all data lives here, synced to Supabase cloud
// ============================================================

const DB = (() => {
  const DB_NAME = 'ParsleysFarm';
  const DB_VERSION = 3; // Bumped for Supabase migration
  let db = null;

  const STORES = ['beds', 'sales', 'harvests', 'expenses', 'activities', 'creditPayments', 'crops', 'syncQueue', 'meta'];

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            if (name === 'syncQueue') {
              db.createObjectStore(name, { keyPath: 'queueId', autoIncrement: true });
            } else if (name === 'meta') {
              db.createObjectStore(name, { keyPath: 'key' });
            } else {
              db.createObjectStore(name, { keyPath: 'id' });
            }
          }
        });
      };

      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // --- Generic IndexedDB operations ---

  function _put(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  function _get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function _remove(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  function _clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  function _putMany(storeName, records) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      records.forEach(r => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // --- Timestamp helper ---
  function stamp(record) {
    if (!record || typeof record !== 'object') return record;
    const now = Date.now();
    if (!record.createdAt) record.createdAt = now;
    record.updatedAt = now;
    return record;
  }

  // --- Sync Queue ---
  function queueSync(action, storeName, record) {
    return _put('syncQueue', {
      action,           // 'put' or 'delete'
      store: storeName, // e.g. 'sales'
      recordId: record.id || record.key,
      data: record,
      timestamp: Date.now()
    });
  }

  function getSyncQueue() { return getAll('syncQueue'); }
  function clearSyncQueue() { return _clear('syncQueue'); }
  function removeSyncItem(queueId) { return _remove('syncQueue', queueId); }

  // --- Meta ---
  async function setMeta(key, value) {
    await _put('meta', { key, value, updatedAt: Date.now() });
  }

  async function getMeta(key) {
    const result = await _get('meta', key);
    return result ? result.value : null;
  }

  // --- High-level save operations (write local + queue for cloud sync) ---

  async function saveBed(bed) {
    try { stamp(bed); await _put('beds', bed); await queueSync('put', 'beds', bed); return bed; }
    catch (e) { console.error('saveBed failed:', e); return null; }
  }

  async function saveSale(sale) {
    try { stamp(sale); await _put('sales', sale); await queueSync('put', 'sales', sale); return sale; }
    catch (e) { console.error('saveSale failed:', e); return null; }
  }

  async function deleteSale(id) {
    try { await _remove('sales', id); await queueSync('delete', 'sales', { id }); }
    catch (e) { console.error('deleteSale failed:', e); }
  }

  async function saveHarvest(harvest) {
    try { stamp(harvest); await _put('harvests', harvest); await queueSync('put', 'harvests', harvest); return harvest; }
    catch (e) { console.error('saveHarvest failed:', e); return null; }
  }

  async function deleteHarvest(id) {
    try { await _remove('harvests', id); await queueSync('delete', 'harvests', { id }); }
    catch (e) { console.error('deleteHarvest failed:', e); }
  }

  async function saveExpense(expense) {
    try { stamp(expense); await _put('expenses', expense); await queueSync('put', 'expenses', expense); return expense; }
    catch (e) { console.error('saveExpense failed:', e); return null; }
  }

  async function deleteExpense(id) {
    try { await _remove('expenses', id); await queueSync('delete', 'expenses', { id }); }
    catch (e) { console.error('deleteExpense failed:', e); }
  }

  async function saveActivity(activity) {
    try { stamp(activity); await _put('activities', activity); await queueSync('put', 'activities', activity); return activity; }
    catch (e) { console.error('saveActivity failed:', e); return null; }
  }

  async function deleteActivity(id) {
    try { await _remove('activities', id); await queueSync('delete', 'activities', { id }); }
    catch (e) { console.error('deleteActivity failed:', e); }
  }

  async function saveCreditPayment(payment) {
    try { stamp(payment); await _put('creditPayments', payment); await queueSync('put', 'creditPayments', payment); return payment; }
    catch (e) { console.error('saveCreditPayment failed:', e); return null; }
  }

  async function saveCrop(cropKey, cropData) {
    try {
      const record = stamp({ id: cropKey, ...cropData });
      await _put('crops', record);
      await queueSync('put', 'crops', record);
      return record;
    } catch (e) { console.error('saveCrop failed:', e); return null; }
  }

  // --- Merge load: upsert cloud data into local without destroying unsynced work ---
  async function mergeLoad(storeName, records) {
    // Get IDs that have pending sync (don't overwrite those)
    const queue = await getSyncQueue();
    const pendingIds = new Set(
      queue.filter(q => q.store === storeName).map(q => q.recordId)
    );

    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const r of (records || [])) {
      if (!r || !r.id) continue;
      if (pendingIds.has(r.id)) continue; // Don't overwrite local pending changes
      store.put(r);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  return {
    open, getAll, getMeta, setMeta,
    saveBed, saveSale, deleteSale,
    saveHarvest, deleteHarvest,
    saveExpense, deleteExpense,
    saveActivity, deleteActivity,
    saveCreditPayment, saveCrop,
    getSyncQueue, clearSyncQueue, removeSyncItem,
    mergeLoad
  };
})();
