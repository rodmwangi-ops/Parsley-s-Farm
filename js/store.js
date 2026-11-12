// ============================================================
// PARSLEY'S FARM v6 — Saving and syncing
// Every change is applied on the phone first, then placed in an "outbox".
// The outbox is sent to Supabase in order whenever there is signal.
// Nothing is removed from the outbox until Supabase confirms it.
// ============================================================
const Store = (() => {
  const TABLES = ['people', 'crops', 'blocks', 'beds', 'records', 'products', 'sales', 'store_items', 'bills', 'expenses'];
  const SERVER_FIELDS = ['updated_at', 'created_at', 'created_by', 'updated_by'];
  const demo = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
  let supa = null, outbox = [], failed = [], lastPull = {}, flushing = false, timer = null;
  const listeners = { status: [], row: [] };

  // ---------- small IndexedDB key-value store ----------
  const idb = (() => {
    let dbp = null;
    function db() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        try {
          const r = indexedDB.open('pf6', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        } catch (e) { rej(e); }
      });
      return dbp;
    }
    const tx = async (mode, fn) => {
      try {
        const d = await db();
        return await new Promise((res, rej) => { const t = d.transaction('kv', mode); const r = fn(t.objectStore('kv')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
      } catch (e) { console.warn('Local storage unavailable', e); return undefined; }
    };
    return {
      get: k => tx('readonly', s => s.get(k)),
      set: (k, v) => tx('readwrite', s => s.put(v, k)),
      clear: () => tx('readwrite', s => s.clear())
    };
  })();

  function emit(type, ...a) { listeners[type].forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }
  function on(type, f) { listeners[type].push(f); }
  const persist = () => Promise.all([idb.set('outbox', outbox), idb.set('failed', failed)]);
  const status = () => ({ demo, online: navigator.onLine, pending: outbox.length, failed: failed.length, flushing, failedItems: failed });

  async function init() {
    // Remove the old app's local data so stale records can never be re-sent.
    try { indexedDB.deleteDatabase('ParsleysFarm'); localStorage.removeItem('pf_user'); } catch (e) { }
    if (!demo) {
      supa = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    outbox = (await idb.get('outbox')) || [];
    failed = (await idb.get('failed')) || [];
    lastPull = (await idb.get('lastPull')) || {};
    window.addEventListener('online', () => { emit('status', status()); flush(); });
    window.addEventListener('offline', () => emit('status', status()));
    timer = setInterval(() => { if (outbox.length) flush(); }, 30000);
  }

  // ---------- auth ----------
  async function session() {
    if (demo) return null;
    const { data } = await supa.auth.getSession();
    return data.session;
  }
  const redirectUrl = () => location.href.split('#')[0].split('?')[0];
  const sendCode = email => supa.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } });
  const verifyCode = (email, token) => supa.auth.verifyOtp({ email, token, type: 'email' });
  const signInPassword = (email, password) => supa.auth.signInWithPassword({ email, password });
  const setPassword = password => supa.auth.updateUser({ password });
  const onAuth = cb => { if (!demo) supa.auth.onAuthStateChange((ev, s) => cb(ev, s)); };
  async function signOut() {
    if (!demo) await supa.auth.signOut();
    await idb.clear(); outbox = []; failed = []; lastPull = {};
    try { sessionStorage.clear(); } catch (e) { }
  }

  // ---------- local cache ----------
  async function loadCache() {
    const out = {};
    for (const t of TABLES) out[t] = (await idb.get('t:' + t)) || null;
    return out;
  }
  const saveCache = (t, rowsById) => idb.set('t:' + t, rowsById);

  // ---------- pull from Supabase ----------
  async function fetchAll(t, since) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      let q = supa.from(t).select('*').order('updated_at', { ascending: true }).range(from, from + 999);
      if (since) q = q.gt('updated_at', since);
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  }
  // Returns {table: [changed rows]} or null when offline / demo.
  async function pull(full) {
    if (demo || !navigator.onLine) return null;
    const out = {};
    for (const t of TABLES) {
      const since = full ? null : lastPull[t];
      // Ask for a little overlap so a row saved during the last pull isn't missed.
      const sinceAdj = since ? new Date(new Date(since).getTime() - 120000).toISOString() : null;
      out[t] = await fetchAll(t, sinceAdj);
      const max = out[t].reduce((m, r) => (r.updated_at > m ? r.updated_at : m), since || '');
      if (max) lastPull[t] = max;
    }
    await idb.set('lastPull', lastPull);
    return out;
  }
  const pendingIds = t => new Set(outbox.filter(o => o.t === t).map(o => o.row.id));

  // ---------- push to Supabase ----------
  function clean(t, row) {
    const r = {};
    Object.keys(row).forEach(k => { if (!k.startsWith('_') && !SERVER_FIELDS.includes(k) && row[k] !== undefined) r[k] = row[k]; });
    if (t === 'sales' && !r.receipt_no) delete r.receipt_no;
    return r;
  }
  function put(t, row) {
    if (demo) return;
    const item = { t, row: clean(t, row), at: Date.now() };
    // If this row is already waiting (and not being sent right now), replace it.
    const start = flushing ? 1 : 0;
    const i = outbox.findIndex((o, idx) => idx >= start && o.t === t && o.row.id === item.row.id);
    if (i >= 0) outbox[i] = item; else outbox.push(item);
    persist(); emit('status', status());
    clearTimeout(put._d); put._d = setTimeout(flush, 300);
  }
  const isNetworkError = e => !e || /fetch|network|timeout|offline|load failed/i.test(String(e.message || e));
  async function flush() {
    if (demo) { outbox = []; emit('status', status()); return; }
    if (flushing || !navigator.onLine || !outbox.length) return;
    flushing = true; emit('status', status());
    try {
      while (outbox.length && navigator.onLine) {
        const it = outbox[0];
        let res;
        try { res = await supa.from(it.t).upsert(it.row).select().single(); }
        catch (e) { res = { error: e }; }
        if (res.error) {
          if (isNetworkError(res.error)) break;
          it.tries = (it.tries || 0) + 1; it.err = res.error.message || String(res.error);
          if (it.tries >= 3) { failed.push(outbox.shift()); await persist(); continue; }
          await persist(); break;
        }
        outbox.shift();
        await persist();
        emit('row', it.t, res.data);
      }
    } finally {
      flushing = false; emit('status', status());
    }
  }
  function retryFailed() { outbox.push(...failed.map(f => ({ ...f, tries: 0 }))); failed = []; persist(); flush(); }
  function discardFailed() { failed = []; persist(); emit('status', status()); }

  // ---------- PIN and photos ----------
  async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  async function checkPin(pin, email) {
    if (demo) return pin === '1234';
    if (navigator.onLine) {
      const { data, error } = await supa.rpc('check_pin', { p_pin: pin });
      if (!error) {
        if (data) { try { localStorage.setItem('pf6_pin', await sha(email + '|' + pin)); } catch (e) { } }
        return !!data;
      }
    }
    // Offline: accept the PIN last confirmed on this phone.
    try { return localStorage.getItem('pf6_pin') === await sha(email + '|' + pin); } catch (e) { return false; }
  }
  async function setPin(pin) {
    if (demo) return { ok: true };
    const { error } = await supa.rpc('set_pin', { p_pin: pin });
    return error ? { ok: false, msg: error.message } : { ok: true };
  }
  async function uploadPhoto(blob) {
    if (demo) return URL.createObjectURL(blob);
    if (!navigator.onLine) throw new Error('Photos need signal to upload.');
    const path = `${new Date().toISOString().slice(0, 10)}/${uid()}.jpg`;
    const { error } = await supa.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return supa.storage.from('photos').getPublicUrl(path).data.publicUrl;
  }

  function uid() {
    if (crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) { } }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }

  return { demo, init, session, sendCode, verifyCode, signInPassword, setPassword, onAuth, signOut, loadCache, saveCache, pull, pendingIds, put, flush, status, on,
    retryFailed, discardFailed, checkPin, setPin, uploadPhoto, uid, TABLES };
})();
