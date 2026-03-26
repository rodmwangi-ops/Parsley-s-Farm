// ============================================================
// PARSLEY'S FARM — Sync (Supabase Cloud)
// Pushes local IndexedDB changes to Supabase, pulls cloud
// changes back. Offline changes queue until connectivity.
// ============================================================

const Sync = (() => {
  let statusCallback = null;
  let autoSyncTimer = null;
  let _pullTimer = null;
  let _onPullComplete = null;
  let _syncLock = Promise.resolve();

  function withSyncLock(task) {
    const run = _syncLock.then(() => task(), () => task());
    _syncLock = run.catch(() => {});
    return run;
  }

  function init(cb, onPull) {
    statusCallback = cb;
    _onPullComplete = onPull || null;
  }

  function _status(state, msg) {
    if (statusCallback) statusCallback(state, msg);
  }

  // --- Table name mapping ---
  function tableName(storeName) {
    return CONFIG.TABLES[storeName] || storeName;
  }

  // --- Strip fields that shouldn't be stored inside JSONB `data` column ---
  // Prevents nested data.data.data... accumulation on repeated sync cycles
  function cleanForSupabase(record) {
    if (!record || typeof record !== 'object') return record;
    const clean = { ...record };
    // These are Supabase column-level fields, not JSONB payload
    delete clean.updated_at;
    return clean;
  }

  function isMissingRpcError(error) {
    const msg = (error?.message || '').toLowerCase();
    return error?.code === '42883' || msg.includes('function') && msg.includes('does not exist');
  }

  function isMissingColumnError(error) {
    const msg = (error?.message || '').toLowerCase();
    return error?.code === '42703' || msg.includes('column') && msg.includes('does not exist');
  }

  async function legacyPushTable(client, table, items) {
    const processed = [];
    const errors = [];

    for (const item of items) {
      try {
        if (item.action === 'delete') {
          const { error } = await client.from(table).delete().eq('id', item.recordId);
          if (error) throw error;
          processed.push(item.queueId);
          continue;
        }

        const payload = cleanForSupabase(item.data || {});
        const incomingUpdatedAt = payload.updatedAt || item.timestamp || 0;

        // Stale-write guard in legacy mode (no RPC/function path available):
        // only upsert if local update is newer than current cloud row.
        const { data: existing, error: existingErr } = await client
          .from(table)
          .select('updated_at')
          .eq('id', item.recordId)
          .maybeSingle();

        if (existingErr && existingErr.code !== 'PGRST116') throw existingErr;

        const cloudUpdatedAt = existing?.updated_at || 0;
        if (cloudUpdatedAt > incomingUpdatedAt) {
          processed.push(item.queueId);
          continue; // skip stale local write
        }

        const { error } = await client
          .from(table)
          .upsert({
            id: item.recordId,
            data: payload,
            updated_at: incomingUpdatedAt
          }, { onConflict: 'id' });
        if (error) throw error;
        processed.push(item.queueId);
      } catch (err) {
        console.error(`Legacy push failed for ${item.store}/${item.recordId}:`, err);
        errors.push({ item, err });
      }
    }

    return { processed, errors };
  }

  // --- Deduplicate sync queue: keep only latest action per store+recordId ---
  function dedupeQueue(queue) {
    const latest = new Map();
    for (const item of queue) {
      const key = item.store + '::' + item.recordId;
      const existing = latest.get(key);
      if (!existing || item.timestamp > existing.timestamp) {
        latest.set(key, item);
      }
    }
    return { deduped: [...latest.values()], allIds: queue.map(q => q.queueId) };
  }

  // --- Push local changes to Supabase ---
  async function _pushChanges() {
    const client = Auth.getClient();
    if (!client || !Auth.isSignedIn() || !navigator.onLine) return;

    const queue = await DB.getSyncQueue();
    if (!queue.length) { _status('ok', 'Synced ✓'); return; }

    _status('syncing', 'Pushing...');

    // Deduplicate: if bed A1-1-1 was queued 5 times, only push the latest
    const { deduped, allIds } = dedupeQueue(queue);
    console.log(`Sync: ${queue.length} queued → ${deduped.length} after dedup`);

    const errors = [];
    const processed = [];

    // Group by table for batch upserts
    const byTable = {};
    for (const item of deduped) {
      const table = tableName(item.store);
      if (!byTable[table]) byTable[table] = [];
      byTable[table].push(item);
    }

    // Batch safe-write per table (single RPC call per table)
    for (const [table, items] of Object.entries(byTable)) {
      try {
        const rows = items.map(item => {
          const payload = cleanForSupabase(item.data || {});
          const updatedAt = payload.updatedAt || item.timestamp;
          return {
            id: item.recordId,
            data: payload,
            updated_at: updatedAt,
            deleted_at: payload.deletedAt || null,
            updated_by: payload.updatedBy || null,
            device_id: payload.deviceId || null
          };
        });
        const { error } = await client.rpc('apply_sync_batch', {
          p_table: table,
          p_rows: rows
        });
        if (error) {
          if (isMissingRpcError(error)) {
            const legacy = await legacyPushTable(client, table, items);
            processed.push(...legacy.processed);
            errors.push(...legacy.errors);
            continue;
          }
          throw error;
        }
        items.forEach(item => processed.push(item.queueId));
      } catch (err) {
        console.error(`Sync batch push failed for ${table}:`, err);
        // Fallback: try items individually
        for (const item of items) {
          try {
            const payload = cleanForSupabase(item.data || {});
            const { error } = await client.rpc('apply_sync_batch', {
              p_table: table,
              p_rows: [{
                id: item.recordId,
                data: payload,
                updated_at: payload.updatedAt || item.timestamp,
                deleted_at: payload.deletedAt || null,
                updated_by: payload.updatedBy || null,
                device_id: payload.deviceId || null
              }]
            });
            if (error) {
              if (isMissingRpcError(error)) {
                const legacy = await legacyPushTable(client, table, [item]);
                processed.push(...legacy.processed);
                errors.push(...legacy.errors);
                continue;
              }
              throw error;
            }
            processed.push(item.queueId);
          } catch (err2) {
            console.error(`Sync push failed for ${item.store}/${item.recordId}:`, err2);
            errors.push({ item, err: err2 });
          }
        }
      }
    }

    // Clear ALL original queue items (deduped ones were the winners)
    // This prevents stale duplicate entries from accumulating
    for (const qid of allIds) {
      await DB.removeSyncItem(qid);
    }
    // Re-queue any that failed
    for (const { item } of errors) {
      await DB.queueSync(item.action, item.store, item.data);
    }

    if (errors.length) {
      console.warn(`Sync: ${processed.length} pushed, ${errors.length} failed (re-queued)`);
      _status('error', `${errors.length} failed`);
    } else {
      _status('ok', 'Synced ✓');
    }
  }

  async function pushChanges() {
    return withSyncLock(() => _pushChanges());
  }

  // --- Pull cloud data into local ---
  async function _pullAll() {
    const client = Auth.getClient();
    if (!client || !Auth.isSignedIn() || !navigator.onLine) return;

    _status('syncing', 'Pulling...');

    const stores = Object.keys(CONFIG.TABLES);
    for (const storeName of stores) {
      const table = tableName(storeName);
      try {
        let { data, error } = await client
          .from(table)
          .select('id, data, updated_at, deleted_at, updated_by, device_id');

        if (error && isMissingColumnError(error)) {
          // Legacy schema fallback (before deleted_at/updated_by/device_id SQL migration)
          const legacyRes = await client
            .from(table)
            .select('id, data, updated_at');
          data = legacyRes.data;
          error = legacyRes.error;
        }

        if (error) {
          console.error(`Pull ${table} failed:`, error);
          continue;
        }

        if (data && data.length) {
          // Convert Supabase rows to local records
          const records = data.map(row => ({
            ...row.data,
            id: row.id,
            updatedAt: row.updated_at || row.data?.updatedAt,
            deletedAt: row.deleted_at || row.data?.deletedAt || null,
            updatedBy: row.updated_by || row.data?.updatedBy || null,
            deviceId: row.device_id || row.data?.deviceId || null
          }));
          await DB.mergeLoad(storeName, records);
        }
      } catch (err) {
        console.error(`Pull ${table} exception:`, err);
      }
    }

    _status('ok', 'Synced ✓');
    if (_onPullComplete) _onPullComplete();
  }

  async function pullAll() {
    return withSyncLock(() => _pullAll());
  }

  // --- Full sync: push first, then pull ---
  async function fullSync() {
    return withSyncLock(async () => {
      if (!Auth.isSignedIn() || !navigator.onLine) {
        _status('offline', 'Offline');
        return;
      }
      _status('syncing', 'Syncing...');
      try {
        await _pushChanges();
        await _pullAll();
        _status('ok', 'Synced ✓');
      } catch (err) {
        console.error('Full sync failed:', err);
        _status('error', 'Sync failed');
      }
    });
  }

  // --- Auto sync on interval ---
  function startAutoSync() {
    stopAutoSync();
    // Push every 60 seconds when online
    autoSyncTimer = setInterval(() => {
      if (navigator.onLine && Auth.isSignedIn()) {
        pushChanges().catch(e => console.warn('Auto push failed:', e));
      }
    }, 60000);
    // Pull every 3 minutes to pick up other users' changes
    _pullTimer = setInterval(() => {
      if (navigator.onLine && Auth.isSignedIn()) {
        pullAll().catch(e => console.warn('Auto pull failed:', e));
      }
    }, 180000);
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
    if (_pullTimer) {
      clearInterval(_pullTimer);
      _pullTimer = null;
    }
  }

  // No-op kept for backward compat
  async function initializeSheet() { return; }

  const STATUS = {
    IDLE: 'idle', SYNCING: 'syncing', OK: 'ok', ERROR: 'error', OFFLINE: 'offline'
  };

  return { init, startAutoSync, stopAutoSync, pushChanges, pullAll, fullSync, initializeSheet, STATUS };
})();
