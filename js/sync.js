// ============================================================
// PARSLEY'S FARM — Sync Engine (IndexedDB ↔ Google Sheets)
// ============================================================

const Sync = (() => {
  let syncTimer = null;
  let isSyncing = false;
  let onStatusChange = null; // callback(status, message)

  const STATUS = { IDLE: 'idle', SYNCING: 'syncing', ERROR: 'error', OFFLINE: 'offline', OK: 'ok' };

  function init(statusCallback) {
    onStatusChange = statusCallback;
    updateStatus(navigator.onLine ? STATUS.IDLE : STATUS.OFFLINE);

    window.addEventListener('online', () => {
      updateStatus(STATUS.IDLE);
      pushChanges(); // Push queued changes when back online
    });
    window.addEventListener('offline', () => updateStatus(STATUS.OFFLINE));
  }

  function startAutoSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => {
      if (navigator.onLine && Auth.isSignedIn()) pushChanges();
    }, CONFIG.SYNC_INTERVAL);
  }

  function stopAutoSync() {
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  }

  function updateStatus(status, msg) {
    if (onStatusChange) onStatusChange(status, msg);
  }

  // ============================================================
  // PUSH: Local changes → Google Sheets
  // ============================================================

  async function pushChanges() {
    if (isSyncing || !navigator.onLine || !Auth.isSignedIn()) return;
    isSyncing = true;
    updateStatus(STATUS.SYNCING, 'Syncing...');

    try {
      const queue = await DB.getSyncQueue();
      if (!queue.length) {
        updateStatus(STATUS.OK, 'Up to date');
        isSyncing = false;
        return;
      }

      // Group by store for batch operations
      const byStore = {};
      queue.forEach(item => {
        if (!byStore[item.store]) byStore[item.store] = [];
        byStore[item.store].push(item);
      });

      for (const [storeName, items] of Object.entries(byStore)) {
        const tabName = CONFIG.TABS[storeName.toUpperCase()] || storeName;
        await syncStoreToSheet(tabName, storeName, items);
      }

      await DB.clearSyncQueue();
      await DB.setMeta('lastSync', Date.now());
      updateStatus(STATUS.OK, 'Synced ✓');

    } catch (e) {
      console.error('Sync push failed:', e);
      if (e.message === 'TOKEN_EXPIRED') {
        Auth.silentRefresh();
        updateStatus(STATUS.ERROR, 'Re-authenticating...');
      } else {
        updateStatus(STATUS.ERROR, 'Sync failed');
      }
    }
    isSyncing = false;
  }

  async function syncStoreToSheet(tabName, storeName, queueItems) {
    // Get all current data from IndexedDB for this store
    const allRecords = await DB.getAll(storeName);

    // Convert records to rows
    const headers = getHeaders(storeName);
    const rows = allRecords.map(r => headers.map(h => {
      const val = r[h];
      if (val === null || val === undefined) return '';
      if (Array.isArray(val)) return JSON.stringify(val);
      return String(val);
    }));

    // Write entire sheet tab (clear + write — simple, reliable)
    const range = `${tabName}!A1`;
    const data = [headers, ...rows];

    try {
      // Clear existing data
      await Auth.sheetsAPI(`/values/${tabName}`, {
        method: 'GET'
      }).catch(() => null); // Tab might not exist yet

      // Write all data
      await Auth.sheetsAPI(`/values/${range}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({
          range: range,
          majorDimension: 'ROWS',
          values: data
        })
      });
    } catch (e) {
      // If tab doesn't exist, create it via batchUpdate
      if (e.message && e.message.includes('Unable to parse range')) {
        await createTab(tabName);
        // Retry write
        await Auth.sheetsAPI(`/values/${range}?valueInputOption=RAW`, {
          method: 'PUT',
          body: JSON.stringify({
            range: range,
            majorDimension: 'ROWS',
            values: data
          })
        });
      } else {
        throw e;
      }
    }
  }

  async function createTab(tabName) {
    await Auth.sheetsAPI(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: { title: tabName }
          }
        }]
      })
    });
  }

  // ============================================================
  // PULL: Google Sheets → Local IndexedDB
  // ============================================================

  async function pullAll() {
    if (!navigator.onLine || !Auth.isSignedIn()) return;
    isSyncing = true;
    updateStatus(STATUS.SYNCING, 'Pulling data...');

    try {
      const stores = ['beds', 'sales', 'harvests', 'expenses', 'activities', 'creditPayments', 'crops'];

      for (const storeName of stores) {
        const tabName = CONFIG.TABS[storeName.toUpperCase()] || storeName;
        try {
          const data = await pullSheet(tabName, storeName);
          if (data.length) await DB.bulkLoad(storeName, data);
        } catch (e) {
          // Tab might not exist yet — that's OK
          if (e.message && e.message.includes('Unable to parse range')) {
            console.log(`Tab ${tabName} doesn't exist yet, skipping`);
          } else {
            console.error(`Failed to pull ${tabName}:`, e);
          }
        }
      }

      await DB.setMeta('lastSync', Date.now());
      updateStatus(STATUS.OK, 'Data loaded ✓');

    } catch (e) {
      console.error('Pull failed:', e);
      updateStatus(STATUS.ERROR, 'Pull failed');
    }
    isSyncing = false;
  }

  async function pullSheet(tabName, storeName) {
    const result = await Auth.sheetsAPI(`/values/${tabName}`);
    if (!result.values || result.values.length < 2) return [];

    const headers = result.values[0];
    const records = [];

    for (let i = 1; i < result.values.length; i++) {
      const row = result.values[i];
      const record = {};
      headers.forEach((h, j) => {
        let val = row[j] || '';
        // Parse JSON arrays
        if (val.startsWith('[')) {
          try { val = JSON.parse(val); } catch (e) { }
        }
        // Parse numbers
        if (['qty', 'pricePerUnit', 'total', 'amount', 'num', 'sub', 'dripLines', 'createdAt'].includes(h)) {
          const n = Number(val);
          if (!isNaN(n) && val !== '') val = n;
        }
        // Parse nulls
        if (val === 'null' || val === '') val = h === 'notes' ? '' : null;
        record[h] = val;
      });
      // Ensure id field exists
      if (record.id) records.push(record);
    }

    return records;
  }

  // ============================================================
  // FULL SYNC: Pull then push
  // ============================================================

  async function fullSync() {
    await pullAll();
    await pushChanges();
  }

  // ============================================================
  // INITIAL SETUP: Create all tabs in the Google Sheet
  // ============================================================

  async function initializeSheet() {
    if (!Auth.isSignedIn()) return;
    updateStatus(STATUS.SYNCING, 'Setting up Google Sheet...');

    const tabNames = Object.values(CONFIG.TABS);

    // Get existing tabs
    try {
      const meta = await Auth.sheetsAPI('', { method: 'GET' });
      const existing = meta.sheets.map(s => s.properties.title);

      const toCreate = tabNames.filter(t => !existing.includes(t));

      if (toCreate.length) {
        await Auth.sheetsAPI(':batchUpdate', {
          method: 'POST',
          body: JSON.stringify({
            requests: toCreate.map(title => ({
              addSheet: { properties: { title } }
            }))
          })
        });
      }

      // Write headers to each tab
      for (const [storeKey, tabName] of Object.entries(CONFIG.TABS)) {
        const storeName = storeKey.toLowerCase();
        // Convert CREDIT_PAYMENTS → creditPayments
        const jsName = storeKey.toLowerCase().replace(/_([a-z])/g, (m, c) => c.toUpperCase());
        const headers = getHeaders(jsName);
        if (headers.length) {
          try {
            const existing = await Auth.sheetsAPI(`/values/${tabName}!A1:1`).catch(() => null);
            if (!existing || !existing.values || !existing.values[0] || !existing.values[0].length) {
              await Auth.sheetsAPI(`/values/${tabName}!A1?valueInputOption=RAW`, {
                method: 'PUT',
                body: JSON.stringify({
                  range: `${tabName}!A1`,
                  majorDimension: 'ROWS',
                  values: [headers]
                })
              });
            }
          } catch (e) {
            console.log(`Header write for ${tabName} skipped:`, e.message);
          }
        }
      }

      updateStatus(STATUS.OK, 'Sheet ready ✓');
    } catch (e) {
      console.error('Sheet init failed:', e);
      updateStatus(STATUS.ERROR, 'Sheet setup failed');
    }
  }

  // ============================================================
  // HEADERS per store — defines column order in Google Sheets
  // ============================================================

  function getHeaders(storeName) {
    const map = {
      beds: ['id', 'block', 'sub', 'num', 'farm', 'crop', 'plantingDate', 'dripLines', 'notes'],
      sales: ['id', 'date', 'crop', 'qty', 'unit', 'pricePerUnit', 'total', 'buyer', 'payment', 'farm', 'recordedBy', 'harvestId', 'fromHarvest', 'createdAt'],
      harvests: ['id', 'date', 'crop', 'qty', 'unit', 'beds', 'recordedBy', 'destination', 'notes', 'createdAt'],
      expenses: ['id', 'date', 'category', 'amount', 'note', 'createdAt'],
      activities: ['id', 'date', 'type', 'beds', 'recordedBy', 'product', 'rate', 'details', 'createdAt'],
      creditpayments: ['id', 'buyer', 'amount', 'method', 'date', 'createdAt'],
      crops: ['id', 'c', 'n', 'sw', 'p']
    };
    return map[storeName.toLowerCase()] || [];
  }

  return {
    init, startAutoSync, stopAutoSync,
    pushChanges, pullAll, fullSync, initializeSheet,
    STATUS
  };
})();
