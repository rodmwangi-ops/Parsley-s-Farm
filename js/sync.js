// ============================================================
// PARSLEY'S FARM — Sync Engine (IndexedDB ↔ Google Sheets)
// Incremental upsert + safe merge pull + conflict detection
// ============================================================

const Sync = (() => {
  let syncTimer = null;
  let isSyncing = false;
  let onStatusChange = null;

  const STATUS = { IDLE: 'idle', SYNCING: 'syncing', ERROR: 'error', OFFLINE: 'offline', OK: 'ok' };

  function init(statusCallback) {
    onStatusChange = statusCallback;
    updateStatus(navigator.onLine ? STATUS.IDLE : STATUS.OFFLINE);

    window.addEventListener('online', () => {
      updateStatus(STATUS.IDLE);
      pushChanges();
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
  // Utilities
  // ============================================================

  function serializeCell(val) {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return JSON.stringify(val);
    return String(val);
  }

  function colLetter(n) {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function parseRowFromRange(rng) {
    const m = (rng || '').match(/![A-Z]+(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  function toNum(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  // Beds/crops are editable over time; everything else is additive
  function isEditableStore(name) {
    return name === 'beds' || name === 'crops';
  }

  // Queue compaction: for beds/crops, keep only latest action per ID
  function compactQueue(queue) {
    const additive = [];
    const latestByKey = new Map();

    queue.forEach(item => {
      if (!isEditableStore(item.store)) {
        additive.push(item);
        return;
      }
      const key = item.store + '::' + String(item.recordId || '');
      const prev = latestByKey.get(key);
      if (!prev || (item.timestamp || 0) >= (prev.timestamp || 0)) {
        latestByKey.set(key, item);
      }
    });

    const compacted = Array.from(latestByKey.values())
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return additive.concat(compacted);
  }

  // ============================================================
  // Sheet helpers
  // ============================================================

  async function createTab(tabName) {
    await Auth.sheetsAPI(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: tabName } } }]
      })
    });
  }

  async function ensureTab(tabName) {
    try {
      await Auth.sheetsAPI(`/values/${tabName}!A1:1`, { method: 'GET' });
    } catch (e) {
      if (e.message && e.message.includes('Unable to parse range')) {
        await createTab(tabName);
      } else {
        throw e;
      }
    }
  }

  async function ensureHeaders(tabName, storeName) {
    const expected = getHeaders(storeName);
    if (!expected.length) return expected;

    const res = await Auth.sheetsAPI(`/values/${tabName}!A1:1`).catch(() => null);
    const existing = (res && res.values && res.values[0]) ? res.values[0] : [];

    // If headers match, done
    if (existing.length === expected.length && existing.every((h, i) => h === expected[i])) {
      return expected;
    }

    // Write correct headers
    await Auth.sheetsAPI(`/values/${tabName}!A1?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({
        range: `${tabName}!A1`,
        majorDimension: 'ROWS',
        values: [expected]
      })
    });

    return expected;
  }

  // ============================================================
  // PUSH: Incremental upsert (update existing rows, append new)
  // ============================================================

  async function pushChanges() {
    if (isSyncing || !navigator.onLine || !Auth.isSignedIn()) return;
    isSyncing = true;
    updateStatus(STATUS.SYNCING, 'Syncing...');

    try {
      let queue = await DB.getSyncQueue();
      if (!queue.length) {
        updateStatus(STATUS.OK, 'Up to date');
        isSyncing = false;
        return;
      }

      queue = compactQueue(queue);

      // Group by store
      const byStore = {};
      queue.forEach(item => {
        if (!byStore[item.store]) byStore[item.store] = [];
        byStore[item.store].push(item);
      });

      let conflictCount = 0;

      for (const [storeName, items] of Object.entries(byStore)) {
        const tabName = CONFIG.TABS[storeName.toUpperCase()] || storeName;
        const result = await syncStoreToSheet(tabName, storeName, items);
        conflictCount += result.conflicts.length;

        // Remove applied queue items
        for (const qid of result.appliedQueueIds) {
          await DB.removeSyncItem(qid);
        }
      }

      await DB.setMeta('lastSync', Date.now());

      if (conflictCount) {
        updateStatus(STATUS.ERROR, conflictCount + ' conflict(s) — cloud has newer data');
      } else {
        updateStatus(STATUS.OK, 'Synced ✓');
      }

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
    await ensureTab(tabName);
    const headers = await ensureHeaders(tabName, storeName);

    // Read entire tab to build id → row mapping
    const sheet = await Auth.sheetsAPI(`/values/${tabName}`);
    const values = sheet.values || [];

    const idCol = headers.indexOf('id');
    if (idCol === -1) throw new Error('No id column for ' + storeName);
    const updatedAtCol = headers.indexOf('updatedAt');

    // Map existing IDs to sheet row numbers (1-based)
    const idToRow = new Map();
    const idToRowVals = new Map();
    for (let r = 1; r < values.length; r++) {
      const row = values[r] || [];
      const id = row[idCol];
      if (id) {
        idToRow.set(String(id), r + 1);
        idToRowVals.set(String(id), row);
      }
    }

    // Process oldest first
    const items = [...queueItems].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const appliedQueueIds = [];
    const conflicts = [];
    const doConflictCheck = isEditableStore(storeName) && updatedAtCol !== -1;

    for (const item of items) {
      const id = String(item.recordId || (item.data && item.data.id) || '');
      if (!id) continue;

      if (item.action === 'put') {
        const data = item.data || {};

        // Conflict check for beds/crops: don't overwrite newer sheet data
        if (doConflictCheck && idToRow.has(id)) {
          const sheetRow = idToRowVals.get(id) || [];
          const sheetUpdatedAt = toNum(sheetRow[updatedAtCol]);
          const localUpdatedAt = toNum(data.updatedAt);
          if (sheetUpdatedAt && localUpdatedAt && sheetUpdatedAt > localUpdatedAt) {
            conflicts.push({ id, reason: 'sheet_newer' });
            continue; // leave in queue
          }
        }

        // Build row values using header order
        const rowValues = headers.map(h => serializeCell(data[h]));

        if (idToRow.has(id)) {
          // UPDATE existing row
          const rowNum = idToRow.get(id);
          const range = `${tabName}!A${rowNum}:${colLetter(headers.length)}${rowNum}`;
          await Auth.sheetsAPI(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
            method: 'PUT',
            body: JSON.stringify({ range, majorDimension: 'ROWS', values: [rowValues] })
          });
          idToRowVals.set(id, rowValues);
        } else {
          // APPEND new row
          const res = await Auth.sheetsAPI(
            `/values/${encodeURIComponent(tabName + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
            {
              method: 'POST',
              body: JSON.stringify({ range: tabName + '!A1', majorDimension: 'ROWS', values: [rowValues] })
            }
          );
          const rowNum = parseRowFromRange((res && res.updates && res.updates.updatedRange) || '');
          if (rowNum) {
            idToRow.set(id, rowNum);
            idToRowVals.set(id, rowValues);
          }
        }

        appliedQueueIds.push(item.queueId);
      }

      if (item.action === 'delete') {
        if (!idToRow.has(id)) {
          // Already gone on sheet
          appliedQueueIds.push(item.queueId);
          continue;
        }

        // Clear the row (don't delete it — row deletion shifts numbers)
        const rowNum = idToRow.get(id);
        const blanks = headers.map(() => '');
        const range = `${tabName}!A${rowNum}:${colLetter(headers.length)}${rowNum}`;
        await Auth.sheetsAPI(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
          method: 'PUT',
          body: JSON.stringify({ range, majorDimension: 'ROWS', values: [blanks] })
        });

        idToRow.delete(id);
        idToRowVals.delete(id);
        appliedQueueIds.push(item.queueId);
      }
    }

    return { appliedQueueIds, conflicts };
  }

  // ============================================================
  // PULL: Safe merge (never wipes unsynced local data)
  // ============================================================

  async function buildProtectedIds() {
    const queue = await DB.getSyncQueue();
    const map = {};
    (queue || []).forEach(item => {
      const store = item.store;
      const id = String(item.recordId || (item.data && item.data.id) || '');
      if (!store || !id) return;
      if (!map[store]) map[store] = new Set();
      map[store].add(id);
    });
    return map;
  }

  async function pullAll() {
    if (!navigator.onLine || !Auth.isSignedIn()) return;
    isSyncing = true;
    updateStatus(STATUS.SYNCING, 'Pulling data...');

    try {
      const stores = ['beds', 'sales', 'harvests', 'expenses', 'activities', 'creditPayments', 'crops'];
      const protectedByStore = await buildProtectedIds();

      for (const storeName of stores) {
        const tabName = CONFIG.TABS[storeName.toUpperCase()] || storeName;
        try {
          await ensureTab(tabName);
          const data = await pullSheet(tabName, storeName);
          if (!data.length) continue;

          const protectIds = protectedByStore[storeName] || new Set();
          await DB.mergeLoad(storeName, data, { protectIds });
        } catch (e) {
          if (e.message && e.message.includes('Unable to parse range')) {
            console.log('Tab ' + tabName + ' does not exist yet, skipping');
          } else {
            console.error('Failed to pull ' + tabName + ':', e);
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
        if (typeof val === 'string' && val.startsWith('[')) {
          try { val = JSON.parse(val); } catch (e) { }
        }
        // Parse numbers
        if (['qty', 'pricePerUnit', 'total', 'amount', 'num', 'sub', 'dripLines', 'createdAt', 'updatedAt'].includes(h)) {
          const n = Number(val);
          if (!isNaN(n) && val !== '') val = n;
        }
        // Parse nulls
        if (val === 'null' || val === '') val = (h === 'notes' || h === 'details') ? '' : null;
        record[h] = val;
      });

      // Skip empty rows (cleared deletes)
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
  // INITIAL SETUP: Create all tabs + headers
  // ============================================================

  async function initializeSheet() {
    if (!Auth.isSignedIn()) return;
    updateStatus(STATUS.SYNCING, 'Setting up Google Sheet...');

    const tabNames = Object.values(CONFIG.TABS);

    try {
      const meta = await Auth.sheetsAPI('', { method: 'GET' });
      const existing = meta.sheets.map(s => s.properties.title);
      const toCreate = tabNames.filter(t => !existing.includes(t));

      if (toCreate.length) {
        await Auth.sheetsAPI(':batchUpdate', {
          method: 'POST',
          body: JSON.stringify({
            requests: toCreate.map(title => ({ addSheet: { properties: { title } } }))
          })
        });
      }

      // Ensure correct headers on every tab
      for (const [storeKey, tabName] of Object.entries(CONFIG.TABS)) {
        const jsName = storeKey.toLowerCase().replace(/_([a-z])/g, (m, c) => c.toUpperCase());
        await ensureTab(tabName);
        await ensureHeaders(tabName, jsName);
      }

      updateStatus(STATUS.OK, 'Sheet ready ✓');
    } catch (e) {
      console.error('Sheet init failed:', e);
      updateStatus(STATUS.ERROR, 'Sheet setup failed');
    }
  }

  // ============================================================
  // HEADERS — YOUR actual data model (with updatedAt added)
  // ============================================================

  function getHeaders(storeName) {
    const map = {
      beds: ['id', 'block', 'sub', 'num', 'farm', 'crop', 'plantingDate', 'dripLines', 'notes', 'createdAt', 'updatedAt'],
      sales: ['id', 'date', 'crop', 'qty', 'unit', 'pricePerUnit', 'total', 'buyer', 'payment', 'farm', 'recordedBy', 'harvestId', 'fromHarvest', 'createdAt', 'updatedAt'],
      harvests: ['id', 'date', 'crop', 'qty', 'unit', 'beds', 'recordedBy', 'destination', 'notes', 'createdAt', 'updatedAt'],
      expenses: ['id', 'date', 'category', 'amount', 'note', 'createdAt', 'updatedAt'],
      activities: ['id', 'date', 'type', 'beds', 'recordedBy', 'product', 'rate', 'details', 'createdAt', 'updatedAt'],
      creditpayments: ['id', 'buyer', 'amount', 'method', 'date', 'createdAt', 'updatedAt'],
      crops: ['id', 'c', 'n', 'sw', 'p', 'createdAt', 'updatedAt']
    };
    return map[storeName.toLowerCase()] || [];
  }

  return {
    init, startAutoSync, stopAutoSync,
    pushChanges, pullAll, fullSync, initializeSheet,
    STATUS
  };
})();
