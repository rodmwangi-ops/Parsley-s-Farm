// ============================================================
// PARSLEY'S FARM — Database (Cloud Firestore)
// Offline-first: Firestore handles local cache + cloud sync
// ============================================================

const DB = (() => {
  let db = null;
  let _persistenceOk = false;

  // Initialize Firestore with offline persistence
  async function open() {
    firebase.initializeApp(CONFIG.FIREBASE);
    db = firebase.firestore();

    // Enable offline persistence (data available without internet)
    try {
      await db.enablePersistence({ synchronizeTabs: true });
      _persistenceOk = true;
      console.log('Firestore offline persistence enabled');
    } catch (err) {
      _persistenceOk = false;
      if (err.code === 'failed-precondition') {
        console.warn('Persistence: multiple tabs, only one gets offline cache');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistence: not supported in this browser');
      } else {
        console.warn('Persistence failed:', err);
      }
    }

    return db;
  }

  // --- Generic helpers ---

  function collection(name) {
    return db.collection(name);
  }

  // Read all docs — tries default, falls back to cache if offline/error
  async function getAll(collectionName) {
    try {
      const snapshot = await collection(collectionName).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn(`getAll(${collectionName}) server failed, trying cache:`, err.message);
      try {
        const snapshot = await collection(collectionName).get({ source: 'cache' });
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (cacheErr) {
        console.warn(`getAll(${collectionName}) cache empty:`, cacheErr.message);
        return [];
      }
    }
  }

  async function getDoc(collectionName, id) {
    try {
      const doc = await collection(collectionName).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (err) {
      try {
        const doc = await collection(collectionName).doc(id).get({ source: 'cache' });
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
      } catch (e) { return null; }
    }
  }

  // Write a doc — works offline when persistence is enabled (queues locally)
  async function putDoc(collectionName, record) {
    if (!record || !record.id) throw new Error('Record must have an id');
    const id = record.id;
    const data = { ...record };
    await collection(collectionName).doc(id).set(data, { merge: true });
    return record;
  }

  async function removeDoc(collectionName, id) {
    await collection(collectionName).doc(id).delete();
  }

  // --- Timestamp helper ---

  function stamp(record) {
    if (!record || typeof record !== 'object') return record;
    const now = Date.now();
    if (!record.createdAt) record.createdAt = now;
    record.updatedAt = now;
    return record;
  }

  // --- Meta ---

  async function setMeta(key, value) {
    try {
      await collection('meta').doc(key).set({ key, value, updatedAt: Date.now() });
    } catch (e) { console.error('setMeta failed:', e); }
  }

  async function getMeta(key) {
    const result = await getDoc('meta', key);
    return result ? result.value : null;
  }

  // --- High-level save operations ---
  // Each catches errors internally — never throws, logs to console

  async function saveBed(bed) {
    try { stamp(bed); await putDoc('beds', bed); return bed; }
    catch (e) { console.error('saveBed failed:', e); return null; }
  }

  async function saveSale(sale) {
    try { stamp(sale); await putDoc('sales', sale); return sale; }
    catch (e) { console.error('saveSale failed:', e); return null; }
  }

  async function deleteSale(id) {
    try { await removeDoc('sales', id); }
    catch (e) { console.error('deleteSale failed:', e); }
  }

  async function saveHarvest(harvest) {
    try { stamp(harvest); await putDoc('harvests', harvest); return harvest; }
    catch (e) { console.error('saveHarvest failed:', e); return null; }
  }

  async function deleteHarvest(id) {
    try { await removeDoc('harvests', id); }
    catch (e) { console.error('deleteHarvest failed:', e); }
  }

  async function saveExpense(expense) {
    try { stamp(expense); await putDoc('expenses', expense); return expense; }
    catch (e) { console.error('saveExpense failed:', e); return null; }
  }

  async function deleteExpense(id) {
    try { await removeDoc('expenses', id); }
    catch (e) { console.error('deleteExpense failed:', e); }
  }

  async function saveActivity(activity) {
    try { stamp(activity); await putDoc('activities', activity); return activity; }
    catch (e) { console.error('saveActivity failed:', e); return null; }
  }

  async function deleteActivity(id) {
    try { await removeDoc('activities', id); }
    catch (e) { console.error('deleteActivity failed:', e); }
  }

  async function saveCreditPayment(payment) {
    try { stamp(payment); await putDoc('creditPayments', payment); return payment; }
    catch (e) { console.error('saveCreditPayment failed:', e); return null; }
  }

  async function saveCrop(cropKey, cropData) {
    try {
      const record = stamp({ id: cropKey, ...cropData });
      await putDoc('crops', record);
      return record;
    } catch (e) { console.error('saveCrop failed:', e); return null; }
  }

  function hasPersistence() { return _persistenceOk; }

  // --- Migration from old storage (backward compat) ---

  async function migrateFromWindowStorage() {
    try {
      if (!window.storage || typeof window.storage.get !== 'function') return false;
      const old = await window.storage.get('rod-farm-v2');
      if (!old || !old.value) return false;

      const data = JSON.parse(old.value);
      console.log('Migrating from old storage to Firestore...');

      if (data.beds) {
        for (const [id, bedData] of Object.entries(data.beds)) {
          await putDoc('beds', stamp({ id, ...bedData }));
        }
      }
      if (data.sales) { for (const s of data.sales) { await putDoc('sales', stamp({...s})); } }
      if (data.creditPayments) { for (const p of data.creditPayments) { await putDoc('creditPayments', stamp({...p})); } }
      if (data.expenses) { for (const e of data.expenses) { await putDoc('expenses', stamp({...e})); } }
      if (data.activities) { for (const a of data.activities) { await putDoc('activities', stamp({...a})); } }
      if (data.harvests) { for (const h of data.harvests) { await putDoc('harvests', stamp({...h})); } }
      if (data.crops) {
        for (const [key, cropData] of Object.entries(data.crops)) {
          await putDoc('crops', stamp({ id: key, ...cropData }));
        }
      }

      await setMeta('migrated', true);
      return true;
    } catch (e) {
      console.log('Migration failed:', e);
      return false;
    }
  }

  return {
    open, getAll, getDoc, hasPersistence,
    setMeta, getMeta,
    saveBed, saveSale, deleteSale,
    saveHarvest, deleteHarvest,
    saveExpense, deleteExpense,
    saveActivity, deleteActivity,
    saveCreditPayment, saveCrop,
    migrateFromWindowStorage
  };
})();
