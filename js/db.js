// ============================================================
// PARSLEY'S FARM — Database (Cloud Firestore)
// Offline-first: Firestore handles local cache + cloud sync
// ============================================================

const DB = (() => {
  let db = null;

  // Initialize Firestore with offline persistence
  async function open() {
    firebase.initializeApp(CONFIG.FIREBASE);

    db = firebase.firestore();

    // Enable offline persistence (data available without internet)
    try {
      await db.enablePersistence({ synchronizeTabs: true });
      console.log('Firestore offline persistence enabled');
    } catch (err) {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open — persistence can only be enabled in one tab at a time
        console.warn('Firestore persistence: multiple tabs open, only one can use offline cache');
      } else if (err.code === 'unimplemented') {
        // Browser doesn't support persistence
        console.warn('Firestore persistence not supported in this browser');
      }
    }

    return db;
  }

  // --- Generic helpers ---

  function collection(name) {
    return db.collection(name);
  }

  async function getAll(collectionName) {
    const snapshot = await collection(collectionName).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function getDoc(collectionName, id) {
    const doc = await collection(collectionName).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async function putDoc(collectionName, record) {
    if (!record || !record.id) throw new Error('Record must have an id');
    const id = record.id;
    const data = { ...record };
    // Firestore uses the doc ID, not a field — but we keep id in the data too for compatibility
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
    await collection('meta').doc(key).set({ key, value, updatedAt: Date.now() });
  }

  async function getMeta(key) {
    const doc = await collection('meta').doc(key).get();
    return doc.exists ? doc.data().value : null;
  }

  // --- High-level save operations ---

  async function saveBed(bed) {
    stamp(bed);
    await putDoc('beds', bed);
  }

  async function saveSale(sale) {
    stamp(sale);
    await putDoc('sales', sale);
  }

  async function deleteSale(id) {
    await removeDoc('sales', id);
  }

  async function saveHarvest(harvest) {
    stamp(harvest);
    await putDoc('harvests', harvest);
  }

  async function deleteHarvest(id) {
    await removeDoc('harvests', id);
  }

  async function saveExpense(expense) {
    stamp(expense);
    await putDoc('expenses', expense);
  }

  async function deleteExpense(id) {
    await removeDoc('expenses', id);
  }

  async function saveActivity(activity) {
    stamp(activity);
    await putDoc('activities', activity);
  }

  async function deleteActivity(id) {
    await removeDoc('activities', id);
  }

  async function saveCreditPayment(payment) {
    stamp(payment);
    await putDoc('creditPayments', payment);
  }

  // Same signature as before: saveCrop(cropKey, cropData)
  async function saveCrop(cropKey, cropData) {
    const record = stamp({ id: cropKey, ...cropData });
    await putDoc('crops', record);
  }

  // --- Migration from old storage (backward compat — returns false on GitHub Pages) ---

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
      if (data.sales) {
        for (const s of data.sales) { await putDoc('sales', stamp({ ...s })); }
      }
      if (data.creditPayments) {
        for (const p of data.creditPayments) { await putDoc('creditPayments', stamp({ ...p })); }
      }
      if (data.expenses) {
        for (const e of data.expenses) { await putDoc('expenses', stamp({ ...e })); }
      }
      if (data.activities) {
        for (const a of data.activities) { await putDoc('activities', stamp({ ...a })); }
      }
      if (data.harvests) {
        for (const h of data.harvests) { await putDoc('harvests', stamp({ ...h })); }
      }
      if (data.crops) {
        for (const [key, cropData] of Object.entries(data.crops)) {
          await putDoc('crops', stamp({ id: key, ...cropData }));
        }
      }

      await setMeta('migrated', true);
      console.log('Migration to Firestore complete');
      return true;
    } catch (e) {
      console.log('No old data to migrate or migration failed:', e);
      return false;
    }
  }

  return {
    open, getAll, getDoc,
    setMeta, getMeta,
    saveBed, saveSale, deleteSale,
    saveHarvest, deleteHarvest,
    saveExpense, deleteExpense,
    saveActivity, deleteActivity,
    saveCreditPayment, saveCrop,
    migrateFromWindowStorage
  };
})();
