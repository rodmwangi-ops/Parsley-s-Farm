// ============================================================
// PARSLEY'S FARM — IndexedDB Local Database
// Offline-first: all data read/written here, synced to Sheets
// ============================================================

const DB = (() => {
  const DB_NAME = 'ParsleysFarm';
  const DB_VERSION = 2;
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

      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  // --- Generic CRUD ---

  function put(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  function get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function remove(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  function clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  function putMany(storeName, records) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      records.forEach(r => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // --- Sync Queue ---
  // Every local change gets queued for sync to Google Sheets

  function queueSync(action, storeName, record) {
    return put('syncQueue', {
      action,        // 'put' or 'delete'
      store: storeName,
      recordId: record.id || record.key,
      data: record,
      timestamp: Date.now(),
      status: 'pending'
    });
  }

  function getSyncQueue() {
    return getAll('syncQueue');
  }

  function clearSyncQueue() {
    return clear('syncQueue');
  }

  function removeSyncItem(queueId) {
    return remove('syncQueue', queueId);
  }

  // --- Meta ---

  function setMeta(key, value) {
    return put('meta', { key, value, updatedAt: Date.now() });
  }

  async function getMeta(key) {
    const result = await get('meta', key);
    return result ? result.value : null;
  }

  // --- High-level data operations (with sync queue) ---

  async function saveBed(bed) {
    await put('beds', bed);
    await queueSync('put', 'beds', bed);
  }

  async function saveSale(sale) {
    await put('sales', sale);
    await queueSync('put', 'sales', sale);
  }

  async function deleteSale(id) {
    await remove('sales', id);
    await queueSync('delete', 'sales', { id });
  }

  async function saveHarvest(harvest) {
    await put('harvests', harvest);
    await queueSync('put', 'harvests', harvest);
  }

  async function saveExpense(expense) {
    await put('expenses', expense);
    await queueSync('put', 'expenses', expense);
  }

  async function deleteExpense(id) {
    await remove('expenses', id);
    await queueSync('delete', 'expenses', { id });
  }

  async function saveActivity(activity) {
    await put('activities', activity);
    await queueSync('put', 'activities', activity);
  }

  async function deleteActivity(id) {
    await remove('activities', id);
    await queueSync('delete', 'activities', { id });
  }

  async function saveCreditPayment(payment) {
    await put('creditPayments', payment);
    await queueSync('put', 'creditPayments', payment);
  }

  async function saveCrop(cropKey, cropData) {
    const record = { id: cropKey, ...cropData };
    await put('crops', record);
    await queueSync('put', 'crops', record);
  }

  // --- Bulk load (from Sheets on initial sync) ---

  async function bulkLoad(storeName, records) {
    await clear(storeName);
    if (records.length) await putMany(storeName, records);
  }

  // --- Migration from old storage ---

  async function migrateFromWindowStorage() {
    try {
      // Check if old data exists in window.storage (artifact storage)
      const old = await window.storage.get('rod-farm-v2');
      if (!old || !old.value) return false;

      const data = JSON.parse(old.value);
      console.log('Migrating from old storage...');

      // Migrate beds
      if (data.beds) {
        for (const [id, bedData] of Object.entries(data.beds)) {
          await put('beds', { id, ...bedData });
        }
      }

      // Migrate sales
      if (data.sales) await putMany('sales', data.sales);

      // Migrate credit payments
      if (data.creditPayments) await putMany('creditPayments', data.creditPayments);

      // Migrate expenses
      if (data.expenses) await putMany('expenses', data.expenses);

      // Migrate activities
      if (data.activities) await putMany('activities', data.activities);

      // Migrate harvests
      if (data.harvests) await putMany('harvests', data.harvests);

      // Migrate custom crops
      if (data.crops) {
        for (const [key, cropData] of Object.entries(data.crops)) {
          await put('crops', { id: key, ...cropData });
        }
      }

      await setMeta('migrated', true);
      console.log('Migration complete');
      return true;
    } catch (e) {
      console.log('No old data to migrate or migration failed:', e);
      return false;
    }
  }

  return {
    open, put, get, getAll, remove, clear, putMany,
    queueSync, getSyncQueue, clearSyncQueue, removeSyncItem,
    setMeta, getMeta,
    saveBed, saveSale, deleteSale, saveHarvest,
    saveExpense, deleteExpense, saveActivity, deleteActivity,
    saveCreditPayment, saveCrop, bulkLoad,
    migrateFromWindowStorage
  };
})();
