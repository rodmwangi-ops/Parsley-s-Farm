// ============================================================
// PARSLEY'S FARM — Sync (Firestore Edition)
// Firestore handles sync automatically via offline persistence.
// This module provides the same API surface so index.html works
// unchanged, but the heavy lifting is gone.
// ============================================================

const Sync = (() => {
  let statusCallback = null;

  function init(cb) {
    statusCallback = cb;
  }

  function _status(state, msg) {
    if (statusCallback) statusCallback(state, msg);
  }

  // No-op: Firestore syncs automatically
  function startAutoSync() {
    _status('ok', 'Connected');
  }

  function stopAutoSync() {
    _status('offline', 'Offline');
  }

  // No-op: no sheet to initialize
  async function initializeSheet() {
    return;
  }

  // Push is automatic with Firestore — this just confirms status
  async function pushChanges() {
    _status('ok', 'Synced ✓');
  }

  // Pull is automatic with Firestore — this reloads from Firestore cache
  async function pullAll() {
    // Firestore's local cache is always up to date
    // Returning resolved promise so callers work
    return;
  }

  // Full sync = just update status
  async function fullSync() {
    _status('syncing', 'Syncing...');
    // Small delay to let Firestore's internal sync settle
    await new Promise(r => setTimeout(r, 500));
    _status('ok', 'Synced ✓');
  }

  // Status constants (kept for backward compat)
  const STATUS = {
    IDLE: 'idle',
    SYNCING: 'syncing',
    OK: 'ok',
    ERROR: 'error',
    OFFLINE: 'offline'
  };

  return { init, startAutoSync, stopAutoSync, pushChanges, pullAll, fullSync, initializeSheet, STATUS };
})();
