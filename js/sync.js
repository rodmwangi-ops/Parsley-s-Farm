// ============================================================
// PARSLEY'S FARM — Sync (Supabase Cloud)
// Pushes local IndexedDB changes to Supabase, pulls cloud
// changes back. Offline changes queue until connectivity.
// ============================================================

const Sync = (() => {
  let statusCallback = null;
  let autoSyncTimer = null;

  function init(cb) {
    statusCallback = cb;
  }

  function _status(state, msg) {
    if (statusCallback) statusCallback(state, msg);
  }

  // --- Table name mapping ---
  function tableName(storeName) {
    return CONFIG.TABLES[storeName] || storeName;
  }

  // --- Push local changes to Supabase ---
  async function pushChanges() {
    const client = Auth.getClient();
    if (!client || !Auth.isSignedIn() || !navigator.onLine) return;

    const queue = await DB.getSyncQueue();
    if (!queue.length) { _status('ok', 'Synced ✓'); return; }

    _status('syncing', 'Pushing...');
    const errors = [];
    const processed = [];

    for (const item of queue) {
      const table = tableName(item.store);
      try {
        if (item.action === 'put') {
          const { error } = await client
            .from(table)
            .upsert({
              id: item.recordId,
              data: item.data,
              updated_at: item.data.updatedAt || item.timestamp
            }, { onConflict: 'id' });
          if (error) throw error;
        } else if (item.action === 'delete') {
          const { error } = await client
            .from(table)
            .delete()
            .eq('id', item.recordId);
          if (error) throw error;
        }
        processed.push(item.queueId);
      } catch (err) {
        console.error(`Sync push failed for ${item.store}/${item.recordId}:`, err);
        errors.push({ item, err });
      }
    }

    // Remove successfully synced items from queue
    for (const qid of processed) {
      await DB.removeSyncItem(qid);
    }

    if (errors.length) {
      console.warn(`Sync: ${processed.length} pushed, ${errors.length} failed`);
      _status('error', `${errors.length} failed`);
    } else {
      _status('ok', 'Synced ✓');
    }
  }

  // --- Pull cloud data into local ---
  async function pullAll() {
    const client = Auth.getClient();
    if (!client || !Auth.isSignedIn() || !navigator.onLine) return;

    _status('syncing', 'Pulling...');

    const stores = Object.keys(CONFIG.TABLES);
    for (const storeName of stores) {
      const table = tableName(storeName);
      try {
        const { data, error } = await client
          .from(table)
          .select('id, data, updated_at');

        if (error) {
          console.error(`Pull ${table} failed:`, error);
          continue;
        }

        if (data && data.length) {
          // Convert Supabase rows to local records
          const records = data.map(row => ({
            ...row.data,
            id: row.id,
            updatedAt: row.updated_at || row.data.updatedAt
          }));
          await DB.mergeLoad(storeName, records);
        }
      } catch (err) {
        console.error(`Pull ${table} exception:`, err);
      }
    }

    _status('ok', 'Synced ✓');
  }

  // --- Full sync: push first, then pull ---
  async function fullSync() {
    if (!Auth.isSignedIn() || !navigator.onLine) {
      _status('offline', 'Offline');
      return;
    }
    _status('syncing', 'Syncing...');
    try {
      await pushChanges();
      await pullAll();
      _status('ok', 'Synced ✓');
    } catch (err) {
      console.error('Full sync failed:', err);
      _status('error', 'Sync failed');
    }
  }

  // --- Auto sync on interval ---
  function startAutoSync() {
    stopAutoSync();
    // Sync every 60 seconds when online
    autoSyncTimer = setInterval(() => {
      if (navigator.onLine && Auth.isSignedIn()) {
        pushChanges().catch(e => console.warn('Auto push failed:', e));
      }
    }, 60000);
    // Also do an immediate sync
    if (navigator.onLine && Auth.isSignedIn()) {
      fullSync().catch(e => console.warn('Initial sync failed:', e));
    }
  }

  function stopAutoSync() {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }
  }

  // No-op kept for backward compat
  async function initializeSheet() { return; }

  const STATUS = {
    IDLE: 'idle', SYNCING: 'syncing', OK: 'ok', ERROR: 'error', OFFLINE: 'offline'
  };

  return { init, startAutoSync, stopAutoSync, pushChanges, pullAll, fullSync, initializeSheet, STATUS };
})();
