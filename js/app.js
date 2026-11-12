// ============================================================
// PARSLEY'S FARM v6 — The app
// ============================================================
'use strict';

// ---------- dates and formatting ----------
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => isoOf(new Date());
const thisMonth = () => today().slice(0, 7);
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return d; };
const fmt = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtS = s => fmt(pd(s));
const fmtLong = s => pd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const monthName = m => pd(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const shiftMonth = (m, k) => { const d = pd(m + '-01'); d.setMonth(d.getMonth() + k); return isoOf(d).slice(0, 7); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ksh = n => 'KSh ' + Math.round(+n || 0).toLocaleString('en-KE');
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const PALETTE = ['#1E7A34', '#F2C12E', '#C2185B', '#0D8A8A', '#E8731A', '#7A4E2A', '#5B3FA8', '#2E86DE', '#8BC34A', '#D84315', '#455A64', '#AD1457', '#00897B', '#9E9D24'];
function inkFor(h) { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1A1A1A' : '#FFFFFF'; }

// ---------- data ----------
const D = { people: {}, crops: {}, blocks: {}, beds: {}, records: {}, products: {}, sales: {}, store_items: {}, bills: {}, expenses: {} };
let ME = null, EMAIL = '', started = false;
const st = { view: 'map', farm: 'joshua', block: null, mapMode: 'map', lb: 'all', lc: 'all', logFilter: 'all', lang: 'en', month: thisMonth(), smonth: thisMonth(), pinOK: false };
try { st.lang = localStorage.getItem('pf6_lang') || 'en'; st.pinOK = sessionStorage.getItem('pf6_pinok') === '1'; } catch (e) { }
const sel = new Set();
const PERM_LABEL = { field: 'Field records', edit_beds: 'Edit beds', sales: 'Sales', expenses: 'Add expenses', money: 'See money', people: 'Manage people' };
const ROLES = SEED.ROLES;
const EXP_CATS = ['Seeds and seedlings', 'Chemicals', 'Fertiliser', 'Salaries', 'Casual labour', 'Rent', 'Fuel and transport', 'Repairs and drip', 'Water', 'Packaging', 'Other'];
const can = p => !!(ME && ME.perms && ME.perms.includes(p));
const canField = () => can('field') || can('edit_beds');

const dirty = new Set(); let cacheTimer = null;
function markDirty(t) { dirty.add(t); clearTimeout(cacheTimer); cacheTimer = setTimeout(() => { dirty.forEach(x => Store.saveCache(x, D[x])); dirty.clear(); }, 800); }
function save(t, row) { D[t][row.id] = row; Store.put(t, row); markDirty(t); }
function mergeRows(t, rows) { const pend = Store.pendingIds(t); rows.forEach(r => { if (!pend.has(r.id)) D[t][r.id] = r; }); markDirty(t); }
const live = t => Object.values(D[t]).filter(r => !r.deleted);

// crops
const SPECIAL = { empty: { name: 'Empty', kind: 'none', cls: 's-empty', stages: [], feeds: [] }, unploughed: { name: 'Unploughed', kind: 'none', cls: 's-unpl', stages: [], feeds: [] } };
const C = id => D.crops[id] || SPECIAL[id] || { name: id, color: '#999999', kind: 'other', stages: [], feeds: [] };
const cropList = () => Object.values(D.crops).filter(c => !c.archived).sort((a, b) => a.sort - b.sort);
const swHtml = id => { const c = C(id); return c.cls ? `<span class="sw ${c.cls}"></span>` : `<span class="sw" style="background:${c.color}"></span>`; };
const stripAttr = (id, extra) => { const c = C(id); return c.cls ? `class="strip ${c.cls}${extra}"` : `class="strip${extra}" style="background:${c.color};color:${inkFor(c.color)}"`; };
const KIND = { main: 'Main crop', other: "Other veg (workers' beds)", fixed: 'Long-term (cassava, sweet potato)' };

// blocks and beds
const K = (f, c, n) => `${f}|${c}|${n}`;
const blockOf = (f, c) => D.blocks[`${f}-${c}`];
const blocksOf = f => Object.values(D.blocks).filter(b => b.farm === f).sort((a, b) => a.sort - b.sort);
const activeBlocks = f => blocksOf(f).filter(b => b.kind !== 'defunct');
const bedAt = k => D.beds[k];
const bedOf = (blk, n) => { const b = D.beds[K(blk.farm, blk.code, n)]; return b && b.active ? b : null; };
const bedsIn = blk => Object.values(D.beds).filter(b => b.farm === blk.farm && b.block === blk.code && b.active).sort((a, b) => a.num - b.num);
const inGH = (blk, n) => blk.gh_range && n >= blk.gh_range[0] && n <= blk.gh_range[1];
const bname = blk => blk.kind === 'greenhouse' ? 'Greenhouse' : blk.label;
const bedLabel = (code, n) => code === 'GH' ? `GH-${n}` : `${code}-${n}`;
const curBlk = () => blockOf(st.farm, st.block);
const subBeds = (blk, a, z) => { const r = []; for (let i = a; i <= z; i++) if (!inGH(blk, i) && bedOf(blk, i)) r.push(i); return r; };

// stages
const dayOf = b => b.plant_date ? Math.round((pd(today()) - pd(b.plant_date)) / 864e5) : null;
function stageOf(b) { const c = D.crops[b.crop]; if (!c || !c.stages.length || !b.plant_date) return null; const d = dayOf(b); let s = c.stages[0][0]; c.stages.forEach(([n, t]) => { if (d >= t) s = n; }); return s; }
function nextFeed(b) { const c = D.crops[b.crop]; if (!c || !b.plant_date) return null; const d = dayOf(b); for (const [p, day] of [...c.feeds].sort((x, y) => x[1] - y[1])) { if ((b.feeds_done || []).includes(norm(p))) continue; return { p, day, inDays: day - d }; } return null; }
function feedText(m) { if (m.inDays < 0) return `${m.p} overdue ${-m.inDays} day${m.inDays === -1 ? '' : 's'}`; if (m.inDays === 0) return `${m.p} due today`; return `${m.p} in ${m.inDays} day${m.inDays === 1 ? '' : 's'}`; }
const dayText = b => { const d = dayOf(b); if (d === null) return ''; return `Day ${b.approx ? 'about ' : ''}${d}${stageOf(b) ? ' · ' + stageOf(b) : ''}`; };
function rangeText(ns) { const a = [...ns].map(Number).sort((x, y) => x - y); if (!a.length) return ''; const out = []; let s = a[0], p = a[0]; for (let i = 1; i <= a.length; i++) { const n = a[i]; if (n === p + 1) { p = n; continue; } out.push(s === p ? `${s}` : `${s}–${p}`); s = p = n; } return out.join(', '); }
function subInfo(blk, [a, z]) {
  const cs = new Set(); let empty = 0;
  for (let i = a; i <= z; i++) { const b = bedOf(blk, i); if (!b || inGH(blk, i)) continue; const c = C(b.crop); if (c.kind === 'none') { empty++; continue; } if (c.kind === 'fixed') continue; cs.add(c.name); }
  if (!cs.size) return { kind: 'empty', label: 'Empty' };
  if (cs.size === 1) return { kind: 'pure', label: [...cs][0] + ' only' + (empty ? ` · ${empty} empty` : '') };
  return { kind: 'mixed', label: 'Mixed: ' + [...cs].join(', ') };
}

// language
const DICT = { map: ['Map', 'Ramani'], log: ['Log', 'Shughuli'], sales: ['Sales', 'Mauzo'], expenses: ['Expenses', 'Matumizi'], more: ['More', 'Zaidi'],
  plant: ['Plant', 'Panda'], spray: ['Spray / feed', 'Nyunyiza'], harvest: ['Harvest', 'Vuna'], work: ['Other work', 'Kazi'], edit: ['Edit', 'Hariri'], details: ['Bed details', 'Maelezo'] };
const T = k => DICT[k][st.lang === 'en' ? 0 : 1];

// ============================================================
// MAP
// ============================================================
function overviewSVG(fid) {
  const L = FARMS[fid].map; let g = '';
  L.items.forEach(([code, x, y, w, h]) => { const blk = blockOf(fid, code); if (blk) g += drawBlock(fid, blk, x, y, w, h); });
  return `<svg viewBox="0 0 360 ${L.h}" role="img" aria-label="Map of ${esc(FARMS[fid].name)}"><defs>
    <pattern id="p-unpl" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#D2B98C"/><rect width="3" height="6" fill="#B08F58"/></pattern>
    <pattern id="p-dead" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#E6E9E4"/><rect width="2.5" height="7" fill="#C3C9C2"/></pattern>
    <pattern id="p-gh" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#F0FAF8"/><rect width="3" height="8" fill="#CDEBE6"/></pattern>
  </defs>${L.deco}${g}</svg>`;
}
function drawBlock(fid, blk, x, y, w, h) {
  if (blk.kind === 'defunct') return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="deadr"/><text transform="rotate(-90 ${x + w / 2} ${y + h / 2})" x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" class="deadt">${esc(blk.label)} · defunct</text></g>`;
  const groups = blk.subs.map(s => [s[0], s[1], 'hb']); if (blk.extras.length) groups.push([blk.extras[0], blk.extras[blk.extras.length - 1], 'xb']);
  const rows = groups.reduce((a, g) => a + g[1] - g[0] + 1, 0) || 1, G = 9, u = (h - groups.length * G) / rows;
  let yy = y, out = '', gt = null, gb = null;
  groups.forEach(g => {
    out += `<rect x="${x - 3}" y="${(yy + 1).toFixed(1)}" width="${w + 6}" height="4.5" rx="2" class="${g[2]}"/>`; yy += G;
    for (let n = g[0]; n <= g[1]; n++) {
      if (inGH(blk, n)) { if (gt === null) gt = yy; gb = yy + u; yy += u; continue; }
      const b = bedOf(blk, n); if (!b) { yy += u; continue; }
      const c = C(b.crop), bw = blk.short_beds.includes(n) ? w * .66 : w, ht = Math.max(u * .72, 2).toFixed(1);
      out += c.cls ? `<rect x="${x}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${ht}" rx="1.5" class="${c.cls === 's-empty' ? 'f-empty' : 'f-unpl'}${b.poor ? ' poorS' : ''}"/>`
        : `<rect x="${x}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${ht}" rx="1.5" fill="${c.color}"${b.poor ? ' class="poorS"' : ''}/>`;
      yy += u;
    }
  });
  let gh = '';
  if (gt !== null) {
    const ghb = blockOf(fid, 'GH'); const n = ghb ? bedsIn(ghb).length : 0;
    gh = `<g class="blk" data-open="GH" tabindex="0" role="button" aria-label="Open greenhouse"><rect x="${x - 4}" y="${gt - 3}" width="${w + 8}" height="${gb - gt + 2}" rx="6" class="ghz"/><text x="${x + w / 2}" y="${(gt + gb) / 2 - 2}" text-anchor="middle" class="ght">Greenhouse</text><text x="${x + w / 2}" y="${(gt + gb) / 2 + 12}" text-anchor="middle" class="ghs">${n ? n + ' beds · tap to open' : 'Tap to set up beds'}</text></g>`;
  }
  return `<g class="blk" data-open="${blk.code}" tabindex="0" role="button" aria-label="Open ${esc(blk.label)}"><rect class="hit" x="${x - 6}" y="${y - 4}" width="${w + 12}" height="${h + 40}" rx="6"/>${out}<text x="${x + w / 2}" y="${y + h + 17}" text-anchor="middle" class="bl">${esc(blk.label)}</text><text x="${x + w / 2}" y="${y + h + 31}" text-anchor="middle">${bedsIn(blk).length} beds</text></g>${gh}`;
}
function reminders() {
  const out = [];
  ['joshua', 'joel'].forEach(fid => activeBlocks(fid).forEach(blk => {
    const gs = {};
    bedsIn(blk).forEach(b => { const m = nextFeed(b); if (!m || m.inDays > 7) return; const k = b.crop + '|' + b.plant_date + '|' + m.p; (gs[k] = gs[k] || { b, m, ns: [] }).ns.push(b.num); });
    Object.values(gs).forEach(g => out.push(Object.assign({ fid, blk }, g)));
  }));
  return out;
}
function farmCounts(fid) { const c = {}; activeBlocks(fid).forEach(blk => bedsIn(blk).forEach(b => { const cr = C(b.crop); const k = cr.kind === 'main' || cr.kind === 'none' ? b.crop : cr.kind; c[k] = (c[k] || 0) + 1; })); return c; }
function countChips(cnt) {
  const order = [...cropList().filter(c => c.kind === 'main').map(c => c.id), 'other', 'fixed', 'empty', 'unploughed'];
  return order.filter(k => cnt[k]).map(k => { const label = k === 'other' ? 'Other veg' : k === 'fixed' ? 'Cassava, sweet potato' : C(k).name; const s = k === 'other' ? swHtml('veg') : k === 'fixed' ? swHtml('cassava') : swHtml(k); return `<span class="cnt">${s}${esc(label)} <b>${cnt[k]}</b></span>`; }).join('');
}
function pureCount(fid) { let p = 0, t = 0; activeBlocks(fid).forEach(blk => blk.subs.forEach(s => { if (!subBeds(blk, s[0], s[1]).length) return; t++; if (subInfo(blk, s).kind === 'pure') p++; })); return [p, t]; }

function renderMap() {
  const F = FARMS[st.farm]; const rem = reminders(); const [p, t] = pureCount(st.farm);
  const chk = activeBlocks(st.farm).map(blk => ({ blk, ns: bedsIn(blk).filter(b => b.needs_check).map(b => b.num) })).filter(x => x.ns.length);
  let h = `<div class="seg" role="tablist" aria-label="Choose farm">${['joshua', 'joel'].map(f => `<button role="tab" aria-selected="${st.farm === f}" class="${st.farm === f ? 'on' : ''}" data-farm="${f}">${FARMS[f].name}</button>`).join('')}</div>`;
  if (rem.length) h += `<section class="card"><div class="card-h"><h2>Feeding due</h2><span class="muted">Next 7 days</span></div>${rem.map(r => `<div class="rem"><div class="rem-k">${esc(r.m.p)}</div><div class="rem-t"><b>${FARMS[r.fid].short} · ${esc(bname(r.blk))} · beds ${rangeText(r.ns)}</b><span>${esc(C(r.b.crop).name)} day ${dayOf(r.b)} · ${esc(feedText(r.m))} (${fmt(addDays(r.b.plant_date, r.m.day))})</span></div><button class="mini" data-goto="${r.fid}|${r.blk.code}">Open</button></div>`).join('')}</section>`;
  if (chk.length) h += `<section class="card"><div class="card-h"><h2>To check</h2><span class="muted">${chk.length} block${chk.length > 1 ? 's' : ''}</span></div>${chk.map(c => `<div class="rem info"><div class="rem-t"><b>${esc(bname(c.blk))}</b><span>Beds ${rangeText(c.ns)}: confirm what is planted</span></div><button class="mini" data-goto="${st.farm}|${c.blk.code}">Open</button></div>`).join('')}</section>`;
  const blocks = activeBlocks(st.farm);
  h += `<section class="card"><div class="card-h"><h2>${F.name}</h2><span class="muted">${p} of ${t} hydrant sections are one crop</span></div>
    <div class="counts">${countChips(farmCounts(st.farm))}</div>
    <div class="seg small" role="tablist" aria-label="Map or list"><button class="${st.mapMode === 'map' ? 'on' : ''}" data-mode="map">Map</button><button class="${st.mapMode === 'list' ? 'on' : ''}" data-mode="list">Bed list</button></div>
    ${st.mapMode === 'map' ? `<div class="ov">${overviewSVG(st.farm)}</div><p class="muted">Tap a block${blockOf(st.farm, 'GH') ? ' or the greenhouse' : ''} to see every bed.</p>
    <div class="rowbtns">${blocks.map(b => `<button class="bb${b.kind === 'greenhouse' ? ' gh' : ''}" data-open="${b.code}">${esc(bname(b))}<small>${bedsIn(b).length ? bedsIn(b).length + ' beds' : 'not set up'}</small></button>`).join('')}</div>` : renderList()}
    ${canField() ? `<div class="two"><button class="btn sm" data-act="spray">${T('spray')} for a block or farm</button><button class="btn sm" data-act="work">${T('work')}</button></div>` : ''}
  </section>
  <section class="card"><h3>Key</h3><div class="counts">
    ${cropList().filter(c => c.kind === 'main').map(c => `<span class="cnt">${swHtml(c.id)}${esc(c.name)}</span>`).join('')}
    <span class="cnt">${swHtml('veg')}Other veg</span><span class="cnt">${swHtml('cassava')}Cassava, sweet potato</span><span class="cnt">${swHtml('empty')}Empty</span><span class="cnt">${swHtml('unploughed')}Unploughed</span>
    <span class="cnt"><span class="sw s-water"></span>Hydrant line</span><span class="cnt"><span class="sw s-gh"></span>Greenhouse</span>
    <span class="cnt"><span class="sw s-dead"></span>Defunct</span><span class="cnt"><span class="sw s-poor"></span>Poor growth</span></div></section>`;
  return h;
}
function renderList() {
  const blocks = activeBlocks(st.farm); const rows = [];
  blocks.forEach(blk => { if (st.lb !== 'all' && st.lb !== blk.code) return; bedsIn(blk).forEach(b => { if (inGH(blk, b.num)) return; const cr = C(b.crop); const g = cr.kind === 'main' || cr.kind === 'none' ? b.crop : cr.kind; if (st.lc !== 'all' && st.lc !== g) return; rows.push([blk, b]); }); });
  const cropF = [['all', 'All crops'], ...cropList().filter(c => c.kind === 'main').map(c => [c.id, c.name]), ['other', 'Other veg'], ['fixed', 'Long-term'], ['empty', 'Empty'], ['unploughed', 'Unploughed']];
  return `<div class="chips">${[['all', 'All blocks'], ...blocks.map(b => [b.code, bname(b)])].map(([v, l]) => `<button class="chip sm${st.lb === v ? ' on' : ''}" data-lb="${v}">${esc(l)}</button>`).join('')}</div>
  <div class="chips">${cropF.map(([v, l]) => `<button class="chip sm${st.lc === v ? ' on' : ''}" data-lc="${v}">${esc(l)}</button>`).join('')}</div>
  <p class="muted">${rows.length} beds. Tap one to see and edit its details.</p>
  <div>${rows.map(([blk, b]) => `<button class="lrow" data-bedkey="${b.id}"><span class="lbn">${bedLabel(blk.code, b.num)}</span>${swHtml(b.crop)}<span class="tx"><b>${esc(C(b.crop).name)}${b.seedbed ? ' seedbed' : ''}</b><span>${b.plant_date ? `${dayText(b)} · planted ${fmtS(b.plant_date)}` : esc(b.note || 'No planting date')}</span></span>${b.needs_check ? '<span class="tag info">Check</span>' : ''}${b.poor ? '<span class="tag bad">Poor</span>' : ''}</button>`).join('') || '<div class="empty-state">No beds match.</div>'}</div>`;
}

// ============================================================
// BLOCK
// ============================================================
function bedRow(blk, b) {
  const c = C(b.crop), m = nextFeed(b); const tags = [];
  if (m && m.inDays <= 7) tags.push(`<span class="tag warn">${esc(feedText(m))}</span>`);
  if (b.poor) tags.push('<span class="tag bad">Poor</span>');
  if (c.to_remove) tags.push('<span class="tag bad">To remove</span>');
  if (c.stages && c.stages.length && !b.plant_date) tags.push('<span class="tag mut">No date</span>');
  if (b.needs_check) tags.push('<span class="tag info">Check</span>');
  if (b.drip !== null && b.drip !== undefined) tags.push(`<span class="tag mut">${b.drip === 0 ? 'No drip line' : b.drip + ' drip line' + (b.drip === 1 ? '' : 's')}</span>`);
  const sub = b.plant_date ? dayText(b) : esc(b.note || '');
  return `<button class="bed${sel.has(b.num) ? ' on' : ''}${b.poor ? ' poor' : ''}" data-bed="${b.num}" aria-pressed="${sel.has(b.num)}"><span class="bn">${b.num}</span><span ${stripAttr(b.crop, blk.short_beds.includes(b.num) ? ' short' : '')}><span class="sl"><b>${esc(c.name)}${b.seedbed ? ' seedbed' : ''}</b>${sub ? `<span>${sub}</span>` : ''}</span>${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}</span></button>`;
}
function hydrant(blk, i, a, z, label, sub, cls) {
  const ids = subBeds(blk, a, z); const on = ids.length && ids.every(x => sel.has(x)); const info = subInfo(blk, [a, z]);
  return `<button class="hyd${cls || ''}${on ? ' on' : ''}" data-sub="${i}" aria-pressed="${!!on}"><span class="hyd-l"><span class="hyd-n">${label}</span><span class="hyd-r">${sub} · tap to select all</span></span>${cls === ' x' ? '' : `<span class="pill ${info.kind}">${esc(info.label)}</span>`}<span class="tick" aria-hidden="true">${on ? '✓' : ''}</span></button>`;
}
function renderBlock() {
  const F = FARMS[st.farm], blk = curBlk(); if (!blk) { st.view = 'map'; return renderMap(); }
  const n = bedsIn(blk).length;
  let h = `<div class="bv-head"><button class="back" data-act="back">‹ ${T('map')}</button><div><h1>${esc(bname(blk))}</h1><p class="muted">${F.name} · ${n} beds${blk.kind === 'greenhouse' ? '' : ` · ${blk.subs.length} hydrants${blk.was ? ' · was ' + esc(blk.was) + ' in the old app' : ''}`}</p></div></div>`;
  if (blk.kind === 'greenhouse') {
    if (!n) h += can('edit_beds') ? `<section class="card"><h2>Set up greenhouse beds</h2><p>Enter the number of beds once the greenhouse is finished. You can change it later.</p><div class="field"><label for="f-ghn">Number of beds</label><input type="number" id="f-ghn" min="1" max="60" step="1" value="22"></div><div class="err" id="gherr"></div><button class="btn primary" data-act="ghsetup">Create beds</button></section>`
      : `<section class="card"><p>The greenhouse beds haven't been set up yet.</p></section>`;
    else {
      h += `<div class="endhint"><span class="arr">Bed 1 ↓</span>${esc(blk.top_note || '')}</div><section class="sub">${hydrant(blk, 0, 1, n, 'Greenhouse', `Beds 1–${n}`, ' ghb')}<div class="beds">${bedsIn(blk).map(b => bedRow(blk, b)).join('')}</div></section>`;
      if (can('edit_beds')) h += `<button class="btn sm addl" data-act="ghresize">Change number of beds</button>`;
    }
    h += `<section class="card"><h2>Whole greenhouse</h2>${canField() ? `<div class="two"><button class="btn sm" data-act="spray">${T('spray')}</button><button class="btn sm" data-act="work">${T('work')}</button></div>` : ''}<h3>History</h3>${historyHtml(l => l.targets.some(k => k.startsWith(st.farm + '|GH|')))}</section>`;
    return h;
  }
  h += `<div class="endhint"><span class="arr">Bed 1 ↓</span>${esc(blk.top_note || 'Top of the map')}</div>`;
  blk.subs.forEach((s, i) => {
    if (!subBeds(blk, s[0], s[1]).length) return;
    const ghPart = blk.gh_range && s[0] <= blk.gh_range[1] && s[1] >= blk.gh_range[0];
    h += `<section class="sub">${hydrant(blk, i, s[0], s[1], `Hydrant ${i + 1}`, `Beds ${s[0]}–${s[1]}${ghPart ? ' · ' + Math.max(s[0], blk.gh_range[0]) + '–' + blk.gh_range[1] + ' now greenhouse' : ''}`)}
      ${blk.sub_notes && blk.sub_notes[i] ? `<p class="subnote">${esc(blk.sub_notes[i])}</p>` : ''}<div class="beds">`;
    for (let x = s[0]; x <= s[1]; x++) {
      if (inGH(blk, x)) { if (x === blk.gh_range[0]) h += `<div class="ghcard"><h3>Greenhouse</h3><p>Old beds ${blk.gh_range[0]}–${blk.gh_range[1]} are under the greenhouse, which has its own beds.</p><button class="btn sm" data-open="GH">Open greenhouse</button></div>`; continue; }
      const b = bedOf(blk, x); if (b) h += bedRow(blk, b);
    }
    h += '</div></section>';
  });
  if (blk.extras.length) h += `<section class="sub">${hydrant(blk, 'x', blk.extras[0], blk.extras[blk.extras.length - 1], 'Extra beds', `Beds ${rangeText(blk.extras)} · piping fitted, not on a hydrant yet`, ' x')}<div class="beds">${blk.extras.map(x => bedOf(blk, x)).filter(Boolean).map(b => bedRow(blk, b)).join('')}</div></section>`;
  h += `<div class="endhint"><span class="arr">↑</span>${esc(blk.bottom_note || 'Bottom of the map')}</div>`;
  return h;
}
function renderSel() {
  const bar = document.getElementById('selbar');
  if (st.view !== 'block' || !sel.size) { bar.hidden = true; return; }
  const blk = curBlk(), ns = [...sel].sort((a, b) => a - b); let what, small;
  if (ns.length === 1) { const b = bedOf(blk, ns[0]); what = `Bed ${bedLabel(blk.code, ns[0])} · ${esc(C(b.crop).name)}`; small = b.plant_date ? `Planted ${fmtS(b.plant_date)} · ${dayText(b)}` : esc(b.note || 'No planting date yet'); }
  else { const i = blk.subs.findIndex(s => { const ids = subBeds(blk, s[0], s[1]); return ids.length === ns.length && ids.every(n => sel.has(n)); }); what = i >= 0 ? `${blk.kind === 'greenhouse' ? 'Greenhouse' : 'Hydrant ' + (i + 1)} · ${ns.length} beds` : `${ns.length} beds selected`; small = `${esc(bname(blk))} · beds ${rangeText(ns)}`; }
  const f = canField();
  bar.innerHTML = `<div class="row"><div class="what">${what}<small>${small}</small></div><button class="xbtn" data-act="clearsel">Clear</button></div>
  <div class="acts" style="grid-template-columns:repeat(${f ? 5 : 1},1fr)"><button class="p" data-act="edit">${ns.length === 1 || !f ? T('details') : T('edit')}</button>${f ? `<button data-act="plant">${T('plant')}</button><button data-act="spray">${T('spray')}</button><button data-act="harvest">${T('harvest')}</button><button data-act="work">${T('work')}</button>` : ''}</div>`;
  bar.hidden = false;
}

// ============================================================
// LOG
// ============================================================
const TYPES = { plant: ['Planting', 'P', '#1E7A34'], spray: ['Spray / feed', 'S', '#1157A8'], harvest: ['Harvest', 'H', '#F2C12E'], work: ['Other work', 'W', '#7A4E2A'], edit: ['Edit', 'E', '#4A564E'] };
const sortRecs = L => L.sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at || '9').localeCompare(String(a.created_at || '9')));
function logRow(l) { const t = TYPES[l.type] || TYPES.edit; return `<button class="li" data-rec="${l.id}"><span class="ico" style="background:${t[2]};color:${inkFor(t[2])}">${t[1]}</span><span class="tx"><b>${esc(l.title)}</b><span>${esc(l.where_text)}${l.done_by ? ' · by ' + esc(l.done_by) : ''}</span>${l.details ? `<span class="muted">${esc(l.details)}</span>` : ''}<span class="muted">${fmtS(l.date)}</span></span>${l.photo_url ? `<img class="thumb" src="${esc(l.photo_url)}" alt="Photo attached to this record">` : ''}</button>`; }
function historyHtml(match) { const L = sortRecs(live('records').filter(match)); return L.length ? `<div class="list">${L.map(logRow).join('')}</div>` : '<p class="muted">Nothing recorded yet.</p>'; }
function renderLog() {
  const f = st.logFilter; const L = sortRecs(live('records').filter(l => f === 'all' || l.type === f));
  return `<h1>${T('log')}</h1><div class="chips">${[['all', 'All'], ['plant', 'Planting'], ['spray', 'Spray / feed'], ['harvest', 'Harvest'], ['work', 'Other work'], ['edit', 'Edits']].map(([k, v]) => `<button class="chip sm${f === k ? ' on' : ''}" data-filter="${k}">${v}</button>`).join('')}</div>
  <section class="card">${L.length ? `<div class="list">${L.slice(0, 300).map(logRow).join('')}</div>${L.length > 300 ? '<p class="muted">Showing the latest 300. Use Reports for the full record.</p>' : ''}` : '<div class="empty-state"><b>Nothing here yet</b><span>Select beds on the map, then record what was done.</span></div>'}</section>`;
}

// ============================================================
// MONEY
// ============================================================
const salePaid = s => (s.payments || []).reduce((a, p) => a + (+p.amt || 0), 0);
const saleBal = s => (+s.total || 0) - salePaid(s);
const inMonth = (d, m) => d && d.startsWith(m);
const moneyIn = m => live('sales').reduce((a, s) => a + (s.payments || []).filter(p => inMonth(p.date, m)).reduce((x, p) => x + (+p.amt || 0), 0), 0);
const moneyOut = m => live('expenses').filter(e => inMonth(e.date, m)).reduce((a, e) => a + (+e.total || 0), 0);
const billPayment = (bill, m) => live('expenses').find(e => e.bill_id === bill.id && e.bill_month === m);
const monthBar = key => `<div class="monthbar"><button data-month="${key}|-1" aria-label="Previous month">‹</button><b>${monthName(st[key])}</b><button data-month="${key}|1" aria-label="Next month">›</button></div>`;

function renderSales() {
  const m = st.smonth; const S = live('sales');
  const ms = S.filter(s => inMonth(s.date, m)).sort((a, b) => b.date.localeCompare(a.date));
  const owed = S.reduce((a, s) => a + Math.max(0, saleBal(s)), 0);
  const buyers = {}; S.forEach(s => { const b = saleBal(s); if (b > 0) buyers[s.buyer || 'No name'] = (buyers[s.buyer || 'No name'] || 0) + b; });
  const store = live('store_items').filter(x => +x.qty > 0);
  return `<h1>${T('sales')}</h1>${monthBar('smonth')}
  <div class="tiles"><div class="tile"><div class="k">Sales this month</div><div class="v">${ksh(ms.reduce((a, s) => a + (+s.total || 0), 0))}</div></div><div class="tile pos"><div class="k">Received this month</div><div class="v">${ksh(moneyIn(m))}</div></div><div class="tile"><div class="k">Owed to the farm</div><div class="v">${ksh(owed)}</div></div><div class="tile"><div class="k">Number of sales</div><div class="v">${ms.length}</div></div></div>
  ${can('sales') ? '<button class="btn primary wide" data-act="sale">New sale</button>' : ''}
  ${store.length ? `<section class="card"><h2>In store</h2><div class="list">${store.map(x => `<div class="li"><span class="ico" style="background:${C(x.crop).color || '#ccc'};color:${inkFor(C(x.crop).color || '#cccccc')}">${esc(C(x.crop).name[0])}</span><span class="tx"><b>${esc(C(x.crop).name)}</b><span>${+x.qty} ${esc(x.unit)} · lot ${esc(x.lot)}</span></span>${can('sales') ? `<button class="mini" data-sell="${esc(x.id)}">Sell</button>` : ''}</div>`).join('')}</div></section>` : ''}
  ${Object.keys(buyers).length ? `<section class="card"><h2>Owed to the farm</h2><div class="list">${Object.entries(buyers).sort((a, b) => b[1] - a[1]).map(([b, v]) => `<div class="li"><span class="tx"><b>${esc(b)}</b></span><span class="amt">${ksh(v)}</span></div>`).join('')}</div></section>` : ''}
  <section class="card"><h2>Sales in ${monthName(m)}</h2>${ms.length ? `<div class="list">${ms.map(saleRow).join('')}</div>` : '<div class="empty-state"><b>No sales this month</b><span>Sales and harvests marked Sold now show up here.</span></div>'}</section>`;
}
function saleRow(s) { const c = C(s.crop); return `<button class="li" data-receipt="${s.id}"><span class="ico" style="background:${c.color || '#ccc'};color:${inkFor(c.color || '#cccccc')}">${esc(c.name[0])}</span><span class="tx"><b>${esc(s.receipt_no || 'Number pending')} · ${esc(s.buyer || 'No buyer named')}</b><span>${+s.qty} ${esc(s.unit)} ${esc(c.name)} · ${esc(s.pay_method)} · ${fmtS(s.date)}${saleBal(s) > 0 ? ' · ' + ksh(saleBal(s)) + ' unpaid' : ''}</span></span><span class="amt pos">${ksh(s.total)}</span></button>`; }

function renderExpenses() {
  if (!st.pinOK) return `<h1>${T('expenses')}</h1><div class="pinbox"><p>Enter the Expenses PIN</p><input type="password" inputmode="numeric" autocomplete="off" id="f-pin" maxlength="8" aria-label="PIN"><div class="err" id="pinerr"></div><button class="btn primary" data-act="unlock">Unlock</button>${Store.demo ? '<p class="muted">Demo PIN: 1234</p>' : ''}</div>`;
  const m = st.month; const E = live('expenses');
  const me = E.filter(e => inMonth(e.date, m)).sort((a, b) => b.date.localeCompare(a.date));
  if (!can('money')) return `<h1>${T('expenses')}</h1>${monthBar('month')}<button class="btn primary wide" data-act="expense">New expense</button><section class="card"><h2>Your expenses</h2>${me.length ? `<div class="list">${me.map(expRow).join('')}</div>` : '<p class="muted">Nothing recorded this month.</p>'}</section>`;
  const inM = moneyIn(m), outM = moneyOut(m);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(m, -i));
  const bills = live('bills').sort((a, b) => a.sort - b.sort);
  const due = bills.filter(b => b.active && !billPayment(b, m)).reduce((a, b) => a + (+b.amount || 0), 0);
  const byCat = {}; me.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + (+e.total || 0)); const maxC = Math.max(1, ...Object.values(byCat));
  return `<h1>${T('expenses')}</h1>${monthBar('month')}
  <div class="tiles"><div class="tile pos"><div class="k">Money in</div><div class="v">${ksh(inM)}</div></div><div class="tile neg"><div class="k">Money out</div><div class="v">${ksh(outM)}</div></div><div class="tile"><div class="k">Balance</div><div class="v">${ksh(inM - outM)}</div></div><div class="tile"><div class="k">Bills still to pay</div><div class="v">${ksh(due)}</div></div></div>
  <div class="two"><button class="btn primary" data-act="expense">New expense</button><button class="btn" data-act="reports">Reports</button></div>
  <section class="card"><h2>Month by month</h2><table class="mm"><thead><tr><th>Month</th><th>In</th><th>Out</th><th>Balance</th></tr></thead><tbody>${months.map(x => { const i = moneyIn(x), o = moneyOut(x); return `<tr><td>${pd(x + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</td><td class="pos">${Math.round(i).toLocaleString('en-KE')}</td><td class="neg">${Math.round(o).toLocaleString('en-KE')}</td><td>${Math.round(i - o).toLocaleString('en-KE')}</td></tr>`; }).join('')}</tbody></table><p class="muted">Money in counts payments received. Money out counts expenses and paid bills. Amounts in KSh.</p></section>
  <section class="card"><div class="card-h"><h2>Regular bills</h2><span class="muted">${monthName(m)}</span></div><div class="list">${bills.map(b => { const p = billPayment(b, m); return `<div class="li"><span class="tx"><b>${esc(b.name)}</b><span>${!b.active ? esc(b.note || 'Paused') : p ? 'Paid ' + fmtS(p.date) : 'Not paid yet'}</span></span><span class="amt">${ksh(b.amount)}</span>${b.active ? (p ? `<button class="mini" data-unbill="${b.id}">Undo</button>` : `<button class="mini" data-bill="${b.id}">Mark paid</button>`) : ''}</div>`; }).join('')}</div><button class="btn sm addl" data-more="bills">Edit regular bills</button></section>
  <section class="card"><h2>Spending by category</h2>${Object.keys(byCat).length ? Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="barrow"><span>${esc(c)}</span><b>${ksh(v)}</b><div class="bar"><i style="width:${Math.round(v / maxC * 100)}%"></i></div></div>`).join('') : '<p class="muted">Nothing spent this month yet.</p>'}</section>
  <section class="card"><h2>Expenses in ${monthName(m)}</h2>${me.length ? `<div class="list">${me.map(expRow).join('')}</div>` : '<p class="muted">No expenses recorded this month.</p>'}</section>`;
}
function expRow(e) { return `<button class="li" data-exp="${e.id}"><span class="ico" style="background:var(--bad-bg);color:var(--bad)">−</span><span class="tx"><b>${esc(e.category)}</b><span>${esc((e.lines || []).map(l => l.item).join(', '))}${e.paid_by ? ' · paid by ' + esc(e.paid_by) : ''} · ${fmtS(e.date)}</span></span><span class="amt neg">${ksh(e.total)}</span></button>`; }

// ============================================================
// MORE
// ============================================================
function renderMore() {
  const rows = [['crops', 'Crops and calendar', 'Crops, colours, stages and feeding days', true], ['products', 'Products', 'Sprays and fertilisers, with waiting days before harvest', can('edit_beds') || can('money')],
    ['bills', 'Regular bills', 'Rent and salaries every month', can('money')], ['reports', 'Reports', 'Download or print records', can('edit_beds') || can('money')],
    ['people', 'People and access', 'Who can record, edit and see money', can('people')], ['pin', 'Change expenses PIN', 'For the Expenses screen', can('people')],
    ['gap', 'Records for GAP', 'What the app keeps for certification', true], ['sync', 'Sync and offline', 'How records get saved', true]];
  return `<h1>${T('more')}</h1><section class="card">${rows.filter(r => r[3]).map(r => `<button class="mrow" data-more="${r[0]}"><span class="tx"><b>${r[1]}</b><span>${r[2]}</span></span><span class="chev" aria-hidden="true">›</span></button>`).join('')}</section>
  <section class="card"><h3>Language / Lugha</h3><div class="seg"><button class="${st.lang === 'en' ? 'on' : ''}" data-lang="en">English</button><button class="${st.lang === 'sw' ? 'on' : ''}" data-lang="sw">Kiswahili</button></div></section>
  <section class="card"><p class="muted">Signed in as ${esc(ME ? ME.name : '')}${EMAIL ? ' (' + esc(EMAIL) + ')' : ''} · ${esc(ME ? ME.role : '')} · version ${CONFIG.VERSION}</p>${Store.demo ? '<p class="muted">Demo mode: add your Supabase settings in js/config.js to go live.</p>' : '<button class="btn" data-act="signout">Sign out</button>'}</section>`;
}

// ============================================================
// SHELL
// ============================================================
const ICONS = { map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>', log: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>', sales: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>', expenses: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>', more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>' };
const tabs = () => ['map', 'log', ...(can('sales') || can('money') ? ['sales'] : []), ...(can('expenses') || can('money') ? ['expenses'] : []), 'more'];
function renderNav() { const cur = st.view === 'block' ? 'map' : st.view; const t = tabs(); const nav = document.getElementById('nav'); nav.hidden = false; nav.style.gridTemplateColumns = `repeat(${t.length},1fr)`; nav.innerHTML = t.map(k => `<button class="${cur === k ? 'on' : ''}" data-nav="${k}" aria-current="${cur === k ? 'page' : 'false'}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>${T(k)}</button>`).join(''); }
function render() {
  if (!ME) return;
  document.querySelector('.app').classList.remove('nonav');
  const m = document.getElementById('main');
  const v = st.view;
  m.innerHTML = v === 'map' ? renderMap() : v === 'block' ? renderBlock() : v === 'log' ? renderLog() : v === 'sales' ? renderSales() : v === 'expenses' ? renderExpenses() : renderMore();
  renderNav(); renderSel(); syncPill();
}

// ============================================================
// SHEETS
// ============================================================
const sheet = document.getElementById('sheet'), scrim = document.getElementById('scrim'); let hook = null, ctx = {};
function openSheet(html, h, c) { hook = h || null; ctx = c || {}; sheet.innerHTML = html; sheet.hidden = false; scrim.hidden = false; sheet.scrollTop = 0; const f = sheet.querySelector('h2'); if (f) { f.tabIndex = -1; f.focus(); } if (hook) hook(); }
function closeSheet() { sheet.hidden = true; scrim.hidden = true; hook = null; ctx = {}; render(); }
const head = (t, s) => `<div class="sheet-h"><div><h2>${t}</h2>${s ? `<p class="muted">${s}</p>` : ''}</div><button class="closex" data-act="close" aria-label="Close">✕</button></div>`;
const chips = (g, opts, on) => `<div class="chips" data-group="${g}">${opts.map(([v, l, s]) => `<button type="button" class="chip${v === on ? ' on' : ''}" data-v="${esc(v)}">${s || ''}${esc(l)}</button>`).join('')}</div>`;
const val = g => { const c = sheet.querySelector(`[data-group="${g}"] .chip.on`); return c ? c.dataset.v : ''; };
const q = s => sheet.querySelector(s);
const ERR = '<div class="err" id="err" role="alert"></div>';
const foot = (lbl, act) => `<div class="sheet-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="${act}">${lbl}</button></div>`;
const people = () => live('people').filter(p => p.active !== false).sort((a, b) => a.name.localeCompare(b.name));
const byField = () => `<div class="field"><span class="lab">Done by <em>optional</em></span>${chips('by', people().map(p => [p.name, p.name]), '')}</div>`;
const dateField = (lbl, v) => `<div class="field"><label for="f-date">${lbl}</label><input type="date" id="f-date" value="${v || today()}"></div>`;
const cropOpts = o => { o = o || {}; const r = []; if (o.keep) r.push(['__keep', 'Keep as is', '']); cropList().forEach(c => { if (o.mainOnly && c.kind !== 'main') return; r.push([c.id, c.name, swHtml(c.id)]); }); if (o.special) { r.push(['empty', 'Empty', swHtml('empty')]); r.push(['unploughed', 'Unploughed', swHtml('unploughed')]); } return r; };
const selKeys = () => [...sel].map(n => K(st.farm, st.block, n));
const selWhere = () => `${FARMS[st.farm].short} · ${bname(curBlk())} · beds ${rangeText(sel)}`;
function err(m) { const e = q('#err'); e.textContent = m; e.scrollIntoView({ block: 'nearest' }); return false; }
const mkRecord = (type, title, details, where_text, targets, date, done_by, extra) => save('records', Object.assign({ id: Store.uid(), date: date || today(), type, title, details: details || '', where_text, targets, done_by: done_by || '', photo_url: '', data: {}, deleted: false, created_by: EMAIL, created_at: new Date().toISOString() }, extra || {}));
function finish(msg) { toast(msg); sel.clear(); closeSheet(); }
const getDate = () => (q('#f-date') && q('#f-date').value) || today();

// scope for sprays and other work
function scopeOpts() {
  const o = [];
  if (st.view === 'block' && sel.size) o.push(['sel', `Selected beds (${sel.size})`]);
  if (st.view === 'block') o.push(['blk:' + st.block, curBlk().kind === 'greenhouse' ? 'Whole greenhouse' : `All of ${curBlk().label}`]);
  else activeBlocks(st.farm).forEach(b => o.push(['blk:' + b.code, bname(b)]));
  o.push(['farm:' + st.farm, `All of ${FARMS[st.farm].name}`], ['both', 'Both farms']); return o;
}
const scopeDefault = () => st.view === 'block' ? (sel.size ? 'sel' : 'blk:' + st.block) : 'farm:' + st.farm;
function blockKeys(fid, code) { const blk = blockOf(fid, code); if (!blk) return []; const ks = bedsIn(blk).filter(b => !inGH(blk, b.num)).map(b => b.id); return ks.length ? ks : (blk.kind === 'greenhouse' ? [K(fid, 'GH', '*')] : []); }
function scopeTargets(s) { if (s === 'sel') return selKeys(); if (s.startsWith('blk:')) return blockKeys(st.farm, s.slice(4)); const f = s === 'both' ? ['joshua', 'joel'] : [s.slice(5)]; return f.flatMap(x => activeBlocks(x).flatMap(b => blockKeys(x, b.code))); }
function scopeWhere(s) { if (s === 'sel') return selWhere(); if (s.startsWith('blk:')) return `${FARMS[st.farm].short} · ${bname(blockOf(st.farm, s.slice(4)))} (all beds)`; if (s === 'both') return 'Both farms (all beds)'; return `All of ${FARMS[s.slice(5)].name}`; }

// ---------- bed details / edit ----------
function editSheet(keys) {
  const one = keys.length === 1; const b = bedAt(keys[0]); const [f, code, n] = keys[0].split('|'); const blk = blockOf(f, code); const ro = !canField();
  let h = head(one ? `Bed ${bedLabel(code, n)}` : `Edit ${keys.length} beds`, one ? `${FARMS[f].name} · ${esc(bname(blk))}` : selWhere());
  if (one) { const m = nextFeed(b); h += `<div class="sumgrid"><div><span class="k">Crop</span><span class="v">${esc(C(b.crop).name)}${b.seedbed ? ' seedbed' : ''}</span></div><div><span class="k">Planted</span><span class="v">${b.plant_date ? (b.approx ? 'About ' : '') + fmtLong(b.plant_date) : 'No date'}</span></div>
    <div><span class="k">Day and stage</span><span class="v">${b.plant_date ? dayText(b) : 'Starts when a date is added'}</span></div><div><span class="k">Next feed</span><span class="v">${m ? esc(feedText(m)) : 'None due'}</span></div>
    <div><span class="k">Drip lines</span><span class="v">${b.drip === null || b.drip === undefined ? 'Not set' : b.drip}</span></div><div><span class="k">Condition</span><span class="v">${b.poor ? 'Poor growth' : 'Growing fine'}${b.needs_check ? ' · to check' : ''}</span></div></div>${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}`; }
  if (!ro) {
    h += one ? '<h3>Change details</h3>' : `<p class="note">Anything left on "Keep as is" stays the same on each bed.</p>`;
    h += `<div class="field"><span class="lab">Crop</span>${chips('crop', cropOpts({ keep: !one, special: 1 }), one ? b.crop : '__keep')}</div>
    <div class="field"><label for="f-date">Planting date <em>${one ? 'leave blank if not known' : 'blank keeps each bed’s date'}</em></label><input type="date" id="f-date" value="${one && b.plant_date ? b.plant_date : ''}"></div>
    <label class="check"><input type="checkbox" id="f-approx"${one && b.approx ? ' checked' : ''}><span>The date is approximate</span></label>
    ${one ? '' : '<label class="check"><input type="checkbox" id="f-clear"><span>Remove the planting date from these beds</span></label>'}
    <div class="field"><span class="lab">Drip lines</span>${chips('drip', [...(one ? [] : [['__keep', 'Keep as is']]), ['', 'Not set'], ['0', 'None'], ['1', '1'], ['2', '2'], ['3', '3']], one ? (b.drip === null || b.drip === undefined ? '' : String(b.drip)) : '__keep')}</div>
    <div class="field"><span class="lab">Condition</span>${chips('cond', [...(one ? [] : [['__keep', 'Keep as is']]), ['fine', 'Growing fine'], ['poor', 'Poor growth']], one ? (b.poor ? 'poor' : 'fine') : '__keep')}</div>
    <div class="field"><span class="lab">Needs checking</span>${chips('chk', [...(one ? [] : [['__keep', 'Keep as is']]), ['no', 'No'], ['yes', 'Yes']], one ? (b.needs_check ? 'yes' : 'no') : '__keep')}</div>
    <div class="field"><label for="f-note">Note</label><textarea id="f-note" rows="2" placeholder="Yellowing on lower leaves">${one ? esc(b.note) : ''}</textarea></div>${ERR}${foot('Save changes', 'saveEdit')}`;
  }
  if (one) h += `<h3>History of this bed</h3>${historyHtml(l => l.targets.includes(keys[0]))}`;
  openSheet(h, null, { keys });
}

// ---------- record sheets ----------
function plantSheet() {
  openSheet(head('Record planting', selWhere()) + `<div class="field"><span class="lab">Crop</span>${chips('crop', cropOpts(), '')}</div>
  ${dateField('<span id="f-datel">Planting date</span>')}<label class="check"><input type="checkbox" id="f-approx"><span>The date is approximate</span></label>
  <div class="field"><span class="lab">Drip lines <em>optional</em></span>${chips('drip', [['', 'Skip'], ['1', '1'], ['2', '2'], ['3', '3']], '')}</div>
  <p class="note warn" id="mix" hidden></p><p class="note" id="feednote" hidden></p>${byField()}${ERR}${foot('Save planting', 'savePlant')}`,
    () => { const c = val('crop'); const m = c ? mixMsg(c) : ''; q('#mix').textContent = m; q('#mix').hidden = !m; const cr = D.crops[c];
      q('#feednote').hidden = !(cr && cr.feeds.length); if (cr && cr.feeds.length) q('#feednote').textContent = `Day 0 is the ${cr.count_from.toLowerCase()} date. Reminders: ${cr.feeds.map(f => `${f[0]} on day ${f[1]}`).join(', ')}.`;
      q('#f-datel').textContent = cr && cr.count_from === 'Transplant' ? 'Transplant date' : 'Planting date'; });
}
function mixMsg(crop) {
  const blk = curBlk(), msgs = [];
  blk.subs.forEach((s, i) => {
    if (![...sel].some(n => n >= s[0] && n <= s[1])) return; const o = new Set();
    for (let n = s[0]; n <= s[1]; n++) { if (sel.has(n)) continue; const b = bedOf(blk, n); if (!b || inGH(blk, n)) continue; const c = C(b.crop); if (c.kind === 'none' || c.kind === 'fixed' || b.crop === crop) continue; o.add(c.name.toLowerCase()); }
    if (o.size) msgs.push(`${blk.kind === 'greenhouse' ? 'The greenhouse' : 'Hydrant ' + (i + 1)} still has ${[...o].join(', ')}, so it stays mixed until those come out.`);
  });
  return msgs.join(' ');
}
const pline = (p, r) => `<div class="pline"><input type="text" class="pn" list="prodlist" placeholder="Product" aria-label="Product" value="${esc(p || '')}"><input type="text" class="pr" placeholder="Rate per 20 L" aria-label="Rate" value="${esc(r || '')}"><button type="button" class="rm" data-act="rmline" aria-label="Remove this product">✕</button></div>`;
const productNames = () => { const s = new Set(live('products').map(p => p.name)); cropList().forEach(c => c.feeds.forEach(f => s.add(f[0]))); return [...s]; };
function fillProducts() { document.getElementById('prodlist').innerHTML = productNames().map(n => `<option value="${esc(n)}">`).join(''); }
function spraySheet() {
  fillProducts();
  openSheet(head('Record spray or feed', 'Add every product that went into the pump.') + `
  <div class="field"><span class="lab">Where</span>${chips('scope', scopeOpts(), scopeDefault())}</div>
  <div class="field"><span class="lab">Products</span><div id="plines" class="field">${pline()}</div><button type="button" class="btn sm addl" data-act="addline">+ Add another product</button>
  <div class="chips">${live('products').sort((a, b) => a.name.localeCompare(b.name)).map(p => `<button type="button" class="chip sm" data-addprod="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div></div>
  <div class="field"><span class="lab">Type <em>optional</em></span>${chips('type', [['', 'Skip'], ['Insecticide', 'Insecticide'], ['Fungicide', 'Fungicide'], ['Foliar', 'Foliar'], ['Fertiliser', 'Fertiliser']], '')}</div>
  <div class="two"><div class="field"><label for="f-pumps">Pumps <em>optional</em></label><input type="number" id="f-pumps" min="0" step="1" placeholder="4"></div>${dateField('Date')}</div>
  ${byField()}${ERR}${foot('Save', 'saveSpray')}`);
}
function workSheet() {
  openSheet(head('Record other work') + `<div class="field"><span class="lab">Where</span>${chips('scope', scopeOpts(), scopeDefault())}</div>
  <div class="field"><span class="lab">Work</span>${chips('wtype', [['Weeding', 'Weed · Palilia'], ['Tilling', 'Till · Lima'], ['Observation', 'Observe · Angalia'], ['Drip lines rolled up', 'Roll up drip lines'], ['Other', 'Other']], '')}</div>
  <div class="field"><label for="f-note">Note <em>optional</em></label><textarea id="f-note" rows="2" placeholder="Whiteflies under the leaves"></textarea></div>
  <div class="field"><label for="f-photo">Photo <em>optional, needs signal</em></label><input type="file" id="f-photo" accept="image/*"><img id="f-prev" class="thumb" alt="Chosen photo" hidden></div>
  ${dateField('Date')}${byField()}${ERR}${foot('Save', 'saveWork')}`, null, { photo: null });
}
const buyerList = () => `<datalist id="buyerlist">${[...new Set(live('sales').map(s => s.buyer).filter(Boolean))].map(b => `<option value="${esc(b)}">`).join('')}</datalist>`;
const saleFields = (pre) => `<div class="field"><label for="f-price">Price per unit (KSh)</label><input type="number" id="f-price" min="0" step="1" inputmode="numeric" placeholder="120" value="${pre && pre.price ? pre.price : ''}"></div>
    <div class="total"><span>Total</span><b id="tot">KSh 0</b></div>
    <div class="field"><label for="f-buyer">Buyer <em>optional</em></label><input type="text" id="f-buyer" list="buyerlist" placeholder="Mama Wanjiru, Kitengela market" value="${esc(pre && pre.buyer || '')}"></div>
    <div class="field"><span class="lab">Payment</span>${chips('pay', [['Cash', 'Cash'], ['M-Pesa', 'M-Pesa'], ['Credit', 'Credit']], pre && pre.pay_method || 'M-Pesa')}</div>
    ${pre && pre.id ? '' : `<div class="field" id="paidbox" hidden><label for="f-paid">Paid now (KSh) <em>part-payment</em></label><input type="number" id="f-paid" min="0" step="1" value="0"></div>`}`;
function saleHook() { const pb = q('#paidbox'); if (pb) pb.hidden = val('pay') !== 'Credit'; q('#tot').textContent = ksh((+q('#f-qty').value || 0) * (+q('#f-price').value || 0)); }
function harvestSheet() {
  const counts = {}; sel.forEach(n => { const c = bedOf(curBlk(), n).crop; if (D.crops[c]) counts[c] = (counts[c] || 0) + 1; }); const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '';
  const dests = [['store', 'Store'], ['home', 'Home use']]; if (can('sales')) dests.unshift(['sell', 'Sold now']);
  openSheet(head('Record harvest', selWhere()) + `<div class="field"><span class="lab">Crop</span>${chips('crop', cropOpts({ mainOnly: 1 }), top)}</div>
  <div class="two"><div class="field"><label for="f-qty">Quantity</label><input type="number" id="f-qty" min="0" step="0.5" inputmode="decimal" placeholder="16"></div><div class="field"><span class="lab">Unit</span>${chips('unit', [['kg', 'kg'], ['bunches', 'bunches'], ['crates', 'crates']], 'kg')}</div></div>
  <div class="field"><span class="lab">Where it goes</span>${chips('dest', dests, dests[0][0])}</div>
  <div id="salebox" class="field">${can('sales') ? saleFields() : ''}</div>
  <label class="check"><input type="checkbox" id="f-done"><span>These beds are finished. Mark them empty and drip lines rolled up.</span></label>
  ${dateField('Date')}${byField()}${ERR}${foot('Save harvest', 'saveHarvest')}${buyerList()}`,
    () => { q('#salebox').hidden = val('dest') !== 'sell'; if (can('sales')) saleHook(); });
}
function saleSheet(o) {
  o = o || {}; const s = o.sale;
  openSheet(head(s ? `Edit sale ${esc(s.receipt_no || '')}` : 'New sale', o.store ? `From store · lot ${esc(o.store.lot)}` : '') + `<div class="field"><span class="lab">Crop</span>${chips('crop', cropOpts({ mainOnly: 1 }), s ? s.crop : o.store ? o.store.crop : '')}</div>
  <div class="two"><div class="field"><label for="f-qty">Quantity</label><input type="number" id="f-qty" min="0" step="0.5" inputmode="decimal" placeholder="16" value="${s ? +s.qty : ''}"></div><div class="field"><span class="lab">Unit</span>${chips('unit', [['kg', 'kg'], ['bunches', 'bunches'], ['crates', 'crates']], s ? s.unit : o.store ? o.store.unit : 'kg')}</div></div>
  ${saleFields(s)}
  <div class="field"><span class="lab">Farm</span>${chips('farm', [['joshua', "Joshua's"], ['joel', "Joel's"]], s ? s.farm : st.farm)}</div>
  ${dateField('Date', s && s.date)}${ERR}${foot(s ? 'Save changes' : 'Save sale', 'saveSale')}${buyerList()}`, saleHook, o);
}
const eline = (i, a) => `<div class="erow"><input type="text" class="ei" placeholder="Item" aria-label="Item" value="${esc(i || '')}"><input type="number" class="ea" min="0" step="1" inputmode="numeric" placeholder="KSh" aria-label="Amount" value="${a || ''}"><button type="button" class="rm" data-act="rmline" aria-label="Remove this item">✕</button></div>`;
function expenseSheet(e) {
  const payers = people().filter(p => p.perms.includes('expenses') || p.perms.includes('money'));
  openSheet(head(e ? 'Edit expense' : 'New expense', 'List everything bought in one go.') + `<div class="field"><span class="lab">Category</span>${chips('cat', EXP_CATS.map(c => [c, c]), e ? e.category : '')}</div>
  <div class="field"><span class="lab">Items</span><div id="elines" class="field">${e ? e.lines.map(l => eline(l.item, l.amt)).join('') : eline() + eline()}</div><button type="button" class="btn sm addl" data-act="addeline">+ Add another item</button></div>
  <div class="total"><span>Total</span><b id="tot">KSh 0</b></div>
  <div class="field"><label for="f-sup">Supplier <em>optional</em></label><input type="text" id="f-sup" placeholder="Agropests, Kitengela" value="${esc(e ? e.supplier : '')}"></div>
  <div class="field"><span class="lab">Paid by</span>${chips('by', payers.map(p => [p.name, p.name]), e ? e.paid_by : (ME ? ME.name : ''))}</div>
  <div class="field"><span class="lab">Paid with</span>${chips('meth', [['Cash', 'Cash'], ['M-Pesa', 'M-Pesa'], ['Bank', 'Bank']], e ? e.method : 'M-Pesa')}</div>
  ${dateField('Date', e && e.date)}${ERR}${foot(e ? 'Save changes' : 'Save expense', 'saveExpense')}
  ${e ? `<button class="btn danger" data-act="delexp">Delete this expense</button>` : ''}`,
    () => { q('#tot').textContent = ksh([...sheet.querySelectorAll('.ea')].reduce((a, i) => a + (+i.value || 0), 0)); }, { exp: e });
}
function receiptText(s) { return `Parsley's Farm\nReceipt ${s.receipt_no || '(number pending)'}\n${fmtLong(s.date)}\nBuyer: ${s.buyer || '-'}\n${+s.qty} ${s.unit} ${C(s.crop).name} x ${ksh(s.price)} = ${ksh(s.total)}\nPaid: ${ksh(salePaid(s))}\nBalance: ${ksh(saleBal(s))}${s.lot ? '\nHarvest lot: ' + s.lot : ''}`; }
function receiptSheet(id) {
  const s = D.sales[id], bal = saleBal(s);
  openSheet(head(`Receipt ${esc(s.receipt_no || '(number pending)')}`) + `<div class="receipt"><div class="r"><b>Parsley's Farm</b><span>${fmtLong(s.date)}</span></div><div class="r"><span>Buyer</span><b>${esc(s.buyer || 'Not named')}</b></div>
  <div class="r"><span>${+s.qty} ${esc(s.unit)} ${esc(C(s.crop).name)} × ${ksh(s.price)}</span><b>${ksh(s.total)}</b></div>${s.lot ? `<div class="r"><span>Harvest lot</span><b>${esc(s.lot)}</b></div>` : ''}
  ${(s.payments || []).map(p => `<div class="r"><span>Paid ${fmtS(p.date)} (${esc(p.how)})</span><span>${ksh(p.amt)}</span></div>`).join('')}<div class="r"><span>Balance</span><span class="big">${ksh(bal)}</span></div></div>
  <div class="two"><button class="btn" data-act="copyrc">Copy receipt</button><button class="btn" data-act="printrc">Print</button></div>
  ${can('sales') && bal > 0 ? `<h3>Record a payment</h3><div class="two"><div class="field"><label for="f-pay">Amount (KSh)</label><input type="number" id="f-pay" min="1" step="1" value="${Math.round(bal)}"></div><div class="field"><span class="lab">How</span>${chips('how', [['Cash', 'Cash'], ['M-Pesa', 'M-Pesa']], 'M-Pesa')}</div></div>${ERR}<button class="btn primary" data-act="addpay">Save payment</button>` : bal <= 0 ? '<p class="note">Fully paid.</p>' : ''}
  ${can('sales') ? `<div class="two"><button class="btn" data-act="editsale">Edit sale</button><button class="btn danger" data-act="delsale">Delete sale</button></div>` : ''}`, null, { id });
}
function recordSheet(id) {
  const r = D.records[id]; const t = TYPES[r.type] || TYPES.edit; const mine = r.created_by === EMAIL;
  openSheet(head(esc(r.title), `${t[0]} · ${fmtLong(r.date)}`) + `<div class="sumgrid"><div><span class="k">Where</span><span class="v">${esc(r.where_text)}</span></div><div><span class="k">Done by</span><span class="v">${esc(r.done_by || 'Not recorded')}</span></div></div>
  ${r.details ? `<p>${esc(r.details)}</p>` : ''}${r.photo_url ? `<img src="${esc(r.photo_url)}" alt="Photo attached to this record" style="max-width:100%;border-radius:10px">` : ''}
  <p class="muted">Recorded by ${esc(r.created_by || 'setup')}. ${r.targets.length} bed${r.targets.length === 1 ? '' : 's'}.</p>
  ${can('edit_beds') || mine ? `<button class="btn danger" data-act="delrec">Delete this record</button><p class="muted">Deleting a record doesn't change the beds. Use Bed details to correct a bed.</p>` : ''}`, null, { id });
}

// ---------- more sheets ----------
function cropsSheet() {
  openSheet(head('Crops and calendar', 'Day 0 is the planting date, or the transplant date for crops set that way.') + `<div class="list">${cropList().map(c => `<button class="li" data-crop="${c.id}">${swHtml(c.id)}<span class="tx"><b>${esc(c.name)}</b><span>${KIND[c.kind] || ''}${c.stages.length ? ' · ' + c.stages.map(s => `${s[0]} day ${s[1]}`).join(', ') : ''}${c.feeds.length ? ' · feeds: ' + c.feeds.map(f => `${f[0]} day ${f[1]}`).join(', ') : ''}</span></span><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>${can('edit_beds') ? '<button class="btn primary wide" data-crop="__new">+ Add a crop</button>' : ''}`);
}
const srow = (n, d, cls, ph) => `<div class="erow st ${cls}"><input type="text" class="rn" placeholder="${ph}" aria-label="${ph}" value="${esc(n || '')}"><input type="number" class="rd" min="0" step="1" placeholder="Day" aria-label="Day" value="${d == null ? '' : d}"><button type="button" class="rm" data-act="rmline" aria-label="Remove">✕</button></div>`;
function cropEdit(id) {
  if (!can('edit_beds')) return;
  const c = id ? D.crops[id] : { name: '', name_sw: '', color: PALETTE.find(p => !cropList().some(x => x.color === p)) || PALETTE[0], kind: 'main', count_from: 'Planting', stages: [['Germinating', 0], ['Vegetative', 10], ['Ready', 40]], feeds: [] };
  openSheet(head(id ? `Edit ${esc(c.name)}` : 'Add a crop') + `<div class="two"><div class="field"><label for="f-cn">Name</label><input type="text" id="f-cn" value="${esc(c.name)}" placeholder="Basil"></div><div class="field"><label for="f-csw">Kiswahili name <em>optional</em></label><input type="text" id="f-csw" value="${esc(c.name_sw || '')}"></div></div>
  <div class="field"><span class="lab">Colour on the map</span><div class="pal" data-pal>${PALETTE.map(p => `<button type="button" style="background:${p}" data-color="${p}" class="${p === c.color ? 'on' : ''}" aria-label="Colour ${p}"></button>`).join('')}</div><p class="note warn" id="dup" hidden></p></div>
  <div class="field"><span class="lab">Type</span>${chips('kind', Object.entries(KIND), c.kind)}</div>
  <div class="field"><span class="lab">Count days from</span>${chips('from', [['Planting', 'Planting date'], ['Transplant', 'Transplant date']], c.count_from)}</div>
  <label class="check"><input type="checkbox" id="f-rem"${c.to_remove ? ' checked' : ''}><span>Being removed from the farm (shows a "To remove" tag)</span></label>
  <div class="field"><span class="lab">Stages <em>name and the day it starts</em></span><div id="stg" class="field">${c.stages.map(s => srow(s[0], s[1], 'sg', 'Stage')).join('')}</div><button type="button" class="btn sm addl" data-act="addstage">+ Add a stage</button></div>
  <div class="field"><span class="lab">Feeding reminders <em>product and day</em></span><div id="fds" class="field">${c.feeds.map(f => srow(f[0], f[1], 'fd', 'Product')).join('')}</div><button type="button" class="btn sm addl" data-act="addfeed">+ Add a feed</button></div>
  ${ERR}${foot(id ? 'Save crop' : 'Add crop', 'saveCrop')}`,
    () => { const on = q('[data-pal] .on'); const col = on ? on.dataset.color : ''; const other = cropList().find(x => x.id !== id && x.color === col && x.kind === val('kind')); q('#dup').hidden = !other; if (other) q('#dup').textContent = `${other.name} already uses this colour. Pick another so they don't look alike.`; }, { id });
}
function productsSheet() {
  const rows = live('products').sort((a, b) => a.name.localeCompare(b.name));
  const prow = p => `<div class="prow" data-pid="${p ? p.id : ''}"><input type="text" class="p-n" placeholder="Name" aria-label="Product name" value="${esc(p ? p.name : '')}"><input type="text" class="p-t" placeholder="Type" aria-label="Type" value="${esc(p ? p.type : '')}"><input type="text" class="p-a" placeholder="Active ingredient" aria-label="Active ingredient" value="${esc(p ? p.active_ingredient : '')}"><input type="number" class="p-h" min="0" step="1" placeholder="Days before harvest" aria-label="Days to wait before harvest" value="${p && p.phi_days != null ? p.phi_days : ''}"><div class="full"><span class="muted">Waiting days before harvest go into the GAP report.</span><button type="button" class="rm" data-act="rmprod" aria-label="Remove product">✕</button></div></div>`;
  openSheet(head('Products', 'Fill these in from your inputs workbook.') + `<div id="plist">${rows.map(prow).join('')}</div><button type="button" class="btn sm addl" data-act="addprodrow">+ Add a product</button>${ERR}${foot('Save products', 'saveProducts')}`, null, { prow });
}
function billsSheet() {
  const rows = live('bills').sort((a, b) => a.sort - b.sort);
  const brow = b => `<div class="prow" data-bid="${b ? b.id : ''}"><input type="text" class="b-n" placeholder="Bill name" aria-label="Bill name" value="${esc(b ? b.name : '')}"><input type="number" class="b-a" min="0" step="100" placeholder="KSh" aria-label="Amount" value="${b ? b.amount : ''}"><input type="text" class="b-c" placeholder="Category" aria-label="Category" value="${esc(b ? b.category : 'Other')}"><label class="check" style="padding:6px 10px"><input type="checkbox" class="b-on"${!b || b.active ? ' checked' : ''}><span>Active</span></label><div class="full"><input type="text" class="b-note" placeholder="Note, e.g. starts when hired" aria-label="Note" value="${esc(b ? b.note : '')}"><button type="button" class="rm" data-act="rmprod" aria-label="Remove bill">✕</button></div></div>`;
  openSheet(head('Regular bills', 'These appear every month under Expenses until marked paid.') + `<div id="plist">${rows.map(brow).join('')}</div><button type="button" class="btn sm addl" data-act="addbillrow">+ Add a bill</button>${ERR}${foot('Save bills', 'saveBills')}`, null, { brow });
}
function peopleSheet() {
  const P = live('people').sort((a, b) => a.name.localeCompare(b.name));
  openSheet(head('People and access', 'Each person signs in with their own email.') + `<div>${P.map(p => `<div class="person"><div class="ph"><span class="ico" style="background:var(--surface-2)">${esc(p.name[0])}</span><div class="tx" style="flex:1"><b>${esc(p.name)}${p.active === false ? ' (no access)' : ''}</b><div class="muted">${esc(p.id)}${p.note ? ' · ' + esc(p.note) : ''}</div></div></div>
    <div class="chips">${Object.keys(ROLES).map(r => `<button type="button" class="chip sm${p.role === r ? ' on' : ''}" data-setrole="${esc(p.id)}|${r}">${r}</button>`).join('')}</div>
    <div class="chips">${Object.keys(PERM_LABEL).map(x => `<button type="button" class="chip sm${p.perms.includes(x) ? ' on' : ''}" data-perm="${esc(p.id)}|${x}" aria-pressed="${p.perms.includes(x)}">${p.perms.includes(x) ? '✓ ' : ''}${PERM_LABEL[x]}</button>`).join('')}</div>
    ${p.id !== EMAIL ? `<button type="button" class="btn sm addl" data-toggleaccess="${esc(p.id)}">${p.active === false ? 'Give access again' : 'Remove access'}</button>` : ''}</div>`).join('')}</div>
  <h3>Add someone</h3><div class="two"><div class="field"><label for="f-pn">Name</label><input type="text" id="f-pn" placeholder="Reuben"></div><div class="field"><label for="f-pe">Email</label><input type="text" id="f-pe" inputmode="email" autocomplete="off" placeholder="name@gmail.com"></div></div>
  <div class="field"><span class="lab">Role</span>${chips('role', Object.keys(ROLES).map(r => [r, r]), 'Farm hand')}</div>${ERR}
  <button class="btn primary" data-act="addperson">Add person</button><p class="muted">They can then open the app and sign in with that email.</p>`);
}
function pinSheet() { openSheet(head('Change expenses PIN') + `<div class="field"><label for="f-p1">New PIN (4 to 8 digits)</label><input type="password" inputmode="numeric" id="f-p1" maxlength="8"></div><div class="field"><label for="f-p2">Type it again</label><input type="password" inputmode="numeric" id="f-p2" maxlength="8"></div>${ERR}${foot('Change PIN', 'savePin')}`); }
function syncSheet() {
  const s = Store.status();
  openSheet(head('Sync and offline') + `<p>With signal, every record goes straight to the server and the button at the top stays green. Without signal, records wait on this phone, the button turns amber and shows how many are waiting, and they send by themselves when signal returns.</p>
  <div class="sumgrid"><div><span class="k">Signal</span><span class="v">${s.online ? 'Online' : 'Offline'}</span></div><div><span class="k">Waiting to send</span><span class="v">${s.pending}</span></div></div>
  ${s.failed ? `<p class="note warn">${s.failed} change${s.failed > 1 ? 's' : ''} could not be saved. The server said: ${esc(s.failedItems[0].err || 'unknown error')}</p><div class="two"><button class="btn" data-act="retryfail">Try again</button><button class="btn danger" data-act="discardfail">Discard them</button></div>` : ''}
  ${Store.demo ? '<p class="note">Demo mode: nothing is sent anywhere.</p>' : '<button class="btn" data-act="refresh">Refresh from the server now</button>'}<button class="btn primary" data-act="close">Done</button>`);
}
function gapSheet() {
  openSheet(head('Records for GAP') + `<p>Certification schemes such as GLOBALG.A.P. and KenyaGAP check written farm records. Here is what the app keeps and what still needs adding.</p><div class="list">${[
    ['✓', 'Every spray and feed', 'Products, rates, pumps, date, beds, and who applied it'], ['✓', 'Every planting', 'Crop, date and beds'], ['✓', 'Harvest lots', 'Each harvest gets a lot number that follows it onto the sale receipt, so produce traces back to its beds'], ['✓', 'Sales and expenses', 'Receipts, payments and suppliers'],
    [live('products').some(p => p.phi_days != null) ? '✓' : '…', 'Product details', 'Active ingredient and waiting days before harvest, under More → Products'], ['…', 'Outside the app for now', 'Worker training, water tests, chemical store checks']].map(r => `<div class="li"><span class="ico" style="background:${r[0] === '✓' ? 'var(--good-bg)' : 'var(--warn-bg)'};color:${r[0] === '✓' ? 'var(--good)' : 'var(--warn)'}">${r[0]}</span><span class="tx"><b>${r[1]}</b><span>${r[2]}</span></span></div>`).join('')}</div>
  ${can('edit_beds') || can('money') ? '<button class="btn primary" data-act="reports">Open reports</button>' : ''}<button class="btn" data-act="close">Done</button>`);
}

// ---------- reports ----------
function reportsSheet() {
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(thisMonth(), -i));
  const types = [];
  if (can('edit_beds') || can('money')) types.push(['gap', 'Spray and feed record (GAP)'], ['trace', 'Harvest lots and sales (GAP)']);
  if (can('money')) types.push(['statement', 'Monthly money statement']);
  openSheet(head('Reports', 'Download a spreadsheet, or print and save as PDF.') + `<div class="field"><span class="lab">Report</span>${chips('rtype', types, types[0][0])}</div>
  <div class="field"><span class="lab">Month</span>${chips('rmonth', months.map(m => [m, monthName(m)]), st.month)}</div>
  <div class="two"><button class="btn primary" data-act="dlcsv">Download spreadsheet</button><button class="btn" data-act="printrep">Print or save PDF</button></div>
  <p class="muted">Spreadsheets open in Excel or Google Sheets. To make a PDF, choose "Save as PDF" in the print window.</p>`);
}
function buildReport(type, m) {
  const recs = live('records').filter(r => inMonth(r.date, m)).sort((a, b) => a.date.localeCompare(b.date));
  const prodBy = {}; live('products').forEach(p => prodBy[norm(p.name)] = p);
  if (type === 'gap') {
    const rows = recs.filter(r => r.type === 'spray').map(r => {
      const ps = (r.data && r.data.products) || r.title.split(' + ').map(n => ({ name: n, rate: '' }));
      const phi = Math.max(0, ...ps.map(p => (prodBy[norm(p.name)] || {}).phi_days || 0));
      return [r.date, r.where_text, r.targets.length, ps.map(p => p.name).join(' + '), ps.map(p => (prodBy[norm(p.name)] || {}).active_ingredient || '').filter(Boolean).join(', '), ps.filter(p => p.rate).map(p => `${p.name}: ${p.rate}`).join('; '), (r.data && r.data.pumps) || '', (r.data && r.data.type) || '', phi || '', phi ? isoOf(addDays(r.date, phi)) : '', r.done_by, r.created_by || ''];
    });
    return { title: `Spray and feed record · ${monthName(m)}`, cols: ['Date', 'Where', 'Beds', 'Products', 'Active ingredients', 'Rates', 'Pumps', 'Type', 'Waiting days', 'Safe to harvest from', 'Applied by', 'Recorded by'], rows };
  }
  if (type === 'trace') {
    const rows = recs.filter(r => r.type === 'harvest').map(r => { const sale = r.data && r.data.sale_id ? D.sales[r.data.sale_id] : null; return [r.date, (r.data && r.data.lot) || '', r.where_text, r.targets.map(k => k.split('|').slice(1).join('-')).join(' '), r.title, (r.data && r.data.dest) || '', sale ? sale.receipt_no || '' : '', sale ? sale.buyer : '', r.done_by]; });
    return { title: `Harvest lots and sales · ${monthName(m)}`, cols: ['Date', 'Lot', 'Where', 'Beds', 'Harvest', 'Went to', 'Receipt', 'Buyer', 'Harvested by'], rows };
  }
  const rows = [];
  live('sales').forEach(s => (s.payments || []).filter(p => inMonth(p.date, m)).forEach(p => rows.push([p.date, 'Money in', `Sale ${s.receipt_no || ''} · ${+s.qty} ${s.unit} ${C(s.crop).name}`, s.buyer, p.how, +p.amt, ''])));
  live('expenses').filter(e => inMonth(e.date, m)).forEach(e => rows.push([e.date, 'Money out', `${e.category}: ${(e.lines || []).map(l => `${l.item} (${l.amt})`).join(', ')}`, e.supplier || e.paid_by, e.method, '', +e.total]));
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  const i = moneyIn(m), o = moneyOut(m);
  rows.push(['', 'Total', '', '', '', i, o], ['', 'Balance', '', '', '', i - o, '']);
  return { title: `Money statement · ${monthName(m)}`, cols: ['Date', 'Kind', 'Details', 'Buyer or supplier', 'Method', 'In (KSh)', 'Out (KSh)'], rows };
}
function csvOf(r) { const c = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return [r.cols, ...r.rows].map(row => row.map(c).join(',')).join('\r\n'); }
function downloadCsv(r) {
  const blob = new Blob(['﻿' + csvOf(r)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = r.title.replace(/[^\w]+/g, '-').toLowerCase() + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function printHtml(title, body) {
  document.getElementById('print').innerHTML = `<h1>Parsley's Farm</h1><h2>${esc(title)}</h2><p>Printed ${fmtLong(today())}${ME ? ' by ' + esc(ME.name) : ''}</p>${body}`;
  try { window.print(); } catch (e) { toast('Printing is blocked here.'); }
}
const tableHtml = r => `<table><thead><tr>${r.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.rows.length ? r.rows.map(row => `<tr>${row.map(v => `<td>${esc(typeof v === 'number' ? Math.round(v).toLocaleString('en-KE') : v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${r.cols.length}">Nothing recorded this month.</td></tr>`}</tbody></table>`;

// ---------- photo ----------
function resizeImage(file) {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => { const s = Math.min(1, 1280 / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob(b => b ? res(b) : rej(new Error('Could not read the photo')), 'image/jpeg', 0.8); };
    img.onerror = () => rej(new Error('Could not read the photo')); img.src = URL.createObjectURL(file);
  });
}

// ============================================================
// SAVING
// ============================================================
const SAVE = {
  saveEdit() {
    const keys = ctx.keys, one = keys.length === 1; const c = val('crop'), d = q('#f-date').value, ap = q('#f-approx').checked, clr = !one && q('#f-clear').checked, dr = val('drip'), co = val('cond'), ck = val('chk'), nt = q('#f-note').value.trim(); const changed = new Set();
    keys.forEach(k => {
      const b = { ...bedAt(k) };
      if (c !== '__keep' && c !== b.crop) { b.crop = c; b.feeds_done = []; b.seedbed = false; changed.add('crop'); if (C(c).kind === 'none') { b.plant_date = null; b.poor = false; } }
      if (one) { const nd = C(b.crop).kind === 'none' ? null : (d || null); if (nd !== b.plant_date || ap !== !!b.approx) changed.add('date'); b.plant_date = nd; b.approx = !!nd && ap; }
      else if (clr) { b.plant_date = null; b.approx = false; changed.add('date'); } else if (d && C(b.crop).kind !== 'none') { b.plant_date = d; b.approx = ap; changed.add('date'); }
      if (dr !== '__keep') { const v = dr === '' ? null : +dr; if (v !== b.drip) changed.add('drip lines'); b.drip = v; }
      if (co !== '__keep') { const v = co === 'poor'; if (v !== b.poor) changed.add('condition'); b.poor = v; }
      if (ck !== '__keep') { const v = ck === 'yes'; if (v !== b.needs_check) changed.add('check flag'); b.needs_check = v; }
      if (one) { if (nt !== (b.note || '')) changed.add('note'); b.note = nt; } else if (nt) { b.note = nt; changed.add('note'); }
      save('beds', b);
    });
    if (!changed.size) { closeSheet(); return; }
    const [f, code] = keys[0].split('|');
    mkRecord('edit', 'Details changed: ' + [...changed].join(', '), nt, `${FARMS[f].short} · ${bname(blockOf(f, code))} · beds ${rangeText(keys.map(k => k.split('|')[2]))}`, keys);
    finish('Changes saved');
  },
  savePlant() {
    const c = val('crop'); if (!c) return err('Pick a crop first.'); const d = getDate(), dr = val('drip'), ap = q('#f-approx').checked, blk = curBlk();
    sel.forEach(n => { const b = { ...bedOf(blk, n), crop: c, plant_date: d, approx: ap, note: '', poor: false, needs_check: false, seedbed: false, feeds_done: [] }; if (dr !== '') b.drip = +dr; save('beds', b); });
    mkRecord('plant', (D.crops[c].count_from === 'Transplant' ? 'Transplanted ' : 'Planted ') + D.crops[c].name.toLowerCase(), '', selWhere(), selKeys(), d, val('by'), { data: { crop: c } });
    finish(`Planting saved · ${sel.size} beds`);
  },
  saveSpray() {
    const lines = [...sheet.querySelectorAll('.pline')].map(l => ({ name: l.querySelector('.pn').value.trim(), rate: l.querySelector('.pr').value.trim() })).filter(l => l.name);
    if (!lines.length) return err('Add at least one product.'); const s = val('scope'), targets = scopeTargets(s);
    targets.forEach(k => { if (k.endsWith('|*')) return; const b = bedAt(k); if (!b || !D.crops[b.crop]) return; let ch = false; const done = [...(b.feeds_done || [])];
      D.crops[b.crop].feeds.forEach(([fp]) => { if (lines.some(l => norm(l.name) === norm(fp)) && !done.includes(norm(fp))) { done.push(norm(fp)); ch = true; } }); if (ch) save('beds', { ...b, feeds_done: done }); });
    const pu = q('#f-pumps').value, t = val('type');
    mkRecord('spray', lines.map(l => l.name).join(' + '), [t, lines.filter(l => l.rate).map(l => `${l.name} ${l.rate}`).join(', '), pu ? pu + ' pumps' : ''].filter(Boolean).join(' · '), scopeWhere(s), targets, getDate(), val('by'), { data: { products: lines, pumps: pu, type: t } });
    finish(`Saved · ${lines.length} product${lines.length > 1 ? 's' : ''}`);
  },
  async saveWork() {
    const w = val('wtype'); if (!w) return err('Pick the type of work.'); const s = val('scope'); let photo = '';
    if (ctx.photo) { try { q('[data-act="saveWork"]').textContent = 'Uploading photo…'; photo = await Store.uploadPhoto(ctx.photo); } catch (e) { q('[data-act="saveWork"]').textContent = 'Save'; return err((e.message || 'The photo could not be uploaded.') + ' Remove the photo to save without it.'); } }
    if (w === 'Drip lines rolled up' && s === 'sel') { const blk = curBlk(); sel.forEach(n => save('beds', { ...bedOf(blk, n), crop: 'empty', plant_date: null, note: 'Drip lines rolled up', poor: false, feeds_done: [] })); }
    mkRecord('work', w, q('#f-note').value.trim(), scopeWhere(s), scopeTargets(s), getDate(), val('by'), { photo_url: photo });
    finish('Saved');
  },
  saveHarvest() {
    const c = val('crop'), qt = +q('#f-qty').value; if (!c) return err('Pick a crop first.'); if (!qt || qt <= 0) return err('Enter how much was harvested.');
    const u = val('unit'), de = val('dest'), fin = q('#f-done').checked, blk = curBlk(), d = getDate(); const lot = 'LOT-' + d.slice(2).replace(/-/g, '') + '-' + Store.uid().slice(0, 4).toUpperCase();
    let det = { sell: 'Sold now', store: 'To store', home: 'Home use' }[de], saleId = null;
    if (de === 'sell') {
      const p = +q('#f-price').value; if (!p || p <= 0) return err('Enter the price per unit, or choose Store or Home use.');
      const pay = val('pay'); const paidNow = pay === 'Credit' ? Math.max(0, +q('#f-paid').value || 0) : qt * p; if (paidNow > qt * p) return err('Paid now is more than the total.');
      saleId = newSale({ crop: c, qty: qt, unit: u, price: p, buyer: q('#f-buyer').value.trim(), pay, paidNow, farm: st.farm, lot, date: d }); det += ` · ${ksh(qt * p)}`;
    }
    if (de === 'store') { const id = c + '|' + u; const it = D.store_items[id] || { id, crop: c, unit: u, qty: 0, lot: '' }; save('store_items', { ...it, qty: (+it.qty || 0) + qt, lot }); }
    mkRecord('harvest', `Harvested ${qt} ${u} ${D.crops[c].name.toLowerCase()} · ${lot}`, det + (fin ? ' · beds cleared, lines rolled up' : ''), selWhere(), selKeys(), d, val('by'), { data: { lot, crop: c, qty: qt, unit: u, dest: de, sale_id: saleId } });
    if (fin) sel.forEach(n => save('beds', { ...bedOf(blk, n), crop: 'empty', plant_date: null, note: 'Harvested, lines rolled up', poor: false, feeds_done: [] }));
    finish(`Harvest saved · ${lot}`);
  },
  saveSale() {
    const c = val('crop'), qt = +q('#f-qty').value, p = +q('#f-price').value; if (!c) return err('Pick a crop first.'); if (!qt || qt <= 0) return err('Enter the quantity sold.'); if (!p || p <= 0) return err('Enter the price per unit.');
    const u = val('unit'), pay = val('pay');
    if (ctx.sale) {
      const s = ctx.sale; const total = qt * p; if (salePaid(s) > total) return err(`${ksh(salePaid(s))} has already been paid, more than the new total.`);
      let payments = s.payments || []; if (pay !== 'Credit' && s.pay_method === 'Credit' && salePaid(s) < total) payments = [...payments, { date: today(), amt: total - salePaid(s), how: pay }];
      if (pay !== 'Credit' && s.pay_method !== 'Credit') payments = [{ date: s.date, amt: total, how: pay }];
      save('sales', { ...s, crop: c, qty: qt, unit: u, price: p, total, buyer: q('#f-buyer').value.trim(), pay_method: pay, farm: val('farm'), date: getDate(), payments });
      toast('Sale updated'); receiptSheet(s.id); return;
    }
    if (ctx.store) { const it = D.store_items[ctx.store.id]; if (qt > +it.qty) return err(`Only ${+it.qty} ${it.unit} in store.`); save('store_items', { ...it, qty: +it.qty - qt }); }
    const paidNow = pay === 'Credit' ? Math.max(0, +q('#f-paid').value || 0) : qt * p; if (paidNow > qt * p) return err('Paid now is more than the total.');
    newSale({ crop: c, qty: qt, unit: u, price: p, buyer: q('#f-buyer').value.trim(), pay, paidNow, farm: val('farm'), lot: ctx.store ? ctx.store.lot : '', date: getDate() });
    toast('Sale saved'); closeSheet();
  },
  saveExpense() {
    const cat = val('cat'); const lines = [...sheet.querySelectorAll('.erow')].map(r => ({ item: r.querySelector('.ei').value.trim(), amt: +r.querySelector('.ea').value || 0 })).filter(l => l.item || l.amt);
    if (!cat) return err('Pick a category.'); if (!lines.length) return err('Add at least one item.'); if (lines.some(l => !l.item || l.amt <= 0)) return err('Each item needs a name and an amount.');
    const total = lines.reduce((a, l) => a + l.amt, 0); const e = ctx.exp;
    save('expenses', Object.assign(e ? { ...e } : { id: Store.uid(), bill_id: null, bill_month: null, deleted: false, created_by: EMAIL }, { date: getDate(), category: cat, lines, total, supplier: q('#f-sup').value.trim(), paid_by: val('by'), method: val('meth') }));
    toast(e ? 'Expense updated' : 'Expense saved · ' + ksh(total)); closeSheet();
  },
  saveCrop() {
    const n = q('#f-cn').value.trim(); if (!n) return err('Give the crop a name.'); const on = q('[data-pal] .on'); if (!on) return err('Pick a colour.');
    const rows = cls => [...sheet.querySelectorAll('.' + cls)].map(r => [r.querySelector('.rn').value.trim(), Math.max(0, Math.round(+r.querySelector('.rd').value || 0))]).filter(r => r[0]).sort((a, b) => a[1] - b[1]);
    const stg = rows('sg'); if (stg.length) stg[0][1] = 0; const id = ctx.id || (norm(n) || 'crop') + '-' + Store.uid().slice(0, 4);
    const old = D.crops[id] || { sort: 50, archived: false };
    save('crops', { ...old, id, name: n, name_sw: q('#f-csw').value.trim(), color: on.dataset.color, kind: val('kind'), count_from: val('from'), to_remove: q('#f-rem').checked, stages: stg, feeds: rows('fd') });
    toast(ctx.id ? 'Crop updated' : 'Crop added'); cropsSheet();
  },
  saveProducts() {
    const seen = new Set();
    [...sheet.querySelectorAll('#plist .prow')].forEach(r => { const name = r.querySelector('.p-n').value.trim(); if (!name) return; const id = r.dataset.pid || Store.uid(); seen.add(id); const h = r.querySelector('.p-h').value;
      const row = { ...(D.products[id] || { deleted: false }), id, name, type: r.querySelector('.p-t').value.trim(), active_ingredient: r.querySelector('.p-a').value.trim(), phi_days: h === '' ? null : Math.max(0, Math.round(+h)) };
      if (JSON.stringify(row) !== JSON.stringify(D.products[id])) save('products', row); });
    live('products').forEach(p => { if (!seen.has(p.id)) save('products', { ...p, deleted: true }); });
    toast('Products saved'); closeSheet();
  },
  saveBills() {
    const seen = new Set(); let i = 0;
    [...sheet.querySelectorAll('#plist .prow')].forEach(r => { const name = r.querySelector('.b-n').value.trim(); if (!name) return; const id = r.dataset.bid || Store.uid(); seen.add(id); i++;
      const row = { ...(D.bills[id] || { deleted: false }), id, name, amount: +r.querySelector('.b-a').value || 0, category: r.querySelector('.b-c').value.trim() || 'Other', active: r.querySelector('.b-on').checked, note: r.querySelector('.b-note').value.trim(), sort: i };
      if (JSON.stringify(row) !== JSON.stringify(D.bills[id])) save('bills', row); });
    live('bills').forEach(b => { if (!seen.has(b.id)) save('bills', { ...b, deleted: true }); });
    toast('Bills saved'); closeSheet();
  },
  async savePin() {
    const a = q('#f-p1').value, b = q('#f-p2').value; if (!/^[0-9]{4,8}$/.test(a)) return err('Use 4 to 8 digits.'); if (a !== b) return err("The two PINs don't match.");
    const r = await Store.setPin(a); if (!r.ok) return err(r.msg || 'Could not change the PIN. Check your signal.'); toast('PIN changed'); closeSheet();
  }
};
function newSale(o) {
  const id = Store.uid();
  save('sales', { id, receipt_no: Store.demo ? 'PF-' + String(live('sales').length + 1).padStart(4, '0') : null, date: o.date, crop: o.crop, qty: o.qty, unit: o.unit, price: o.price, total: o.qty * o.price, buyer: o.buyer, pay_method: o.pay, farm: o.farm, lot: o.lot || '', payments: o.paidNow > 0 ? [{ date: o.date, amt: o.paidNow, how: o.pay === 'Credit' ? 'Part-payment' : o.pay }] : [], deleted: false, created_by: EMAIL });
  return id;
}
function ghSet(v) {
  const blk = blockOf(st.farm, 'GH');
  for (let i = 1; i <= Math.max(v, 60); i++) { const k = K(st.farm, 'GH', i); const b = D.beds[k];
    if (i <= v) { if (!b) save('beds', { id: k, farm: st.farm, block: 'GH', num: i, crop: 'empty', plant_date: null, approx: false, note: '', drip: null, poor: false, needs_check: false, seedbed: false, feeds_done: [], active: true }); else if (!b.active) save('beds', { ...b, active: true }); }
    else if (b && b.active) save('beds', { ...b, active: false }); }
  save('blocks', { ...blk, subs: [[1, v]] });
}

// ============================================================
// SYNC PILL, TOAST
// ============================================================
function syncPill() {
  const p = document.getElementById('sync'), t = document.getElementById('syncTxt'); const s = Store.status();
  p.classList.toggle('wait', !s.failed && (!s.online || s.pending > 0)); p.classList.toggle('bad', !!s.failed);
  t.textContent = s.failed ? `${s.failed} not saved` : !s.online ? (s.pending ? `${s.pending} waiting` : 'Offline') : s.pending ? 'Saving…' : 'All saved';
}
let tt; function toast(m) { const e = document.getElementById('toast'); e.textContent = m; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 2200); }

// ============================================================
// EVENTS
// ============================================================
function openBlock(fid, code) { st.farm = fid; st.block = code; st.view = 'block'; sel.clear(); render(); window.scrollTo(0, 0); }
let confirmTimer = null;
function confirmTap(btn, label) { if (btn.dataset.armed) return true; btn.dataset.armed = '1'; const old = btn.textContent; btn.textContent = label; clearTimeout(confirmTimer); confirmTimer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; }, 4000); return false; }

document.addEventListener('click', async e => {
  const t = e.target; let m;
  if ((m = t.closest('[data-group] .chip'))) { m.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === m)); if (q('#err')) q('#err').textContent = ''; if (hook) hook(); return; }
  if ((m = t.closest('[data-color]'))) { m.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === m)); if (hook) hook(); return; }
  if ((m = t.closest('[data-addprod]'))) { const empty = [...sheet.querySelectorAll('.pline .pn')].find(i => !i.value); if (empty) empty.value = m.dataset.addprod; else q('#plines').insertAdjacentHTML('beforeend', pline(m.dataset.addprod)); return; }
  if ((m = t.closest('[data-setrole]'))) { const [id, r] = m.dataset.setrole.split('|'); save('people', { ...D.people[id], role: r, perms: [...ROLES[r]] }); peopleSheet(); return; }
  if ((m = t.closest('[data-perm]'))) { const [id, x] = m.dataset.perm.split('|'); const p = D.people[id]; const perms = p.perms.includes(x) ? p.perms.filter(y => y !== x) : [...p.perms, x]; save('people', { ...p, perms }); peopleSheet(); return; }
  if ((m = t.closest('[data-toggleaccess]'))) { const p = D.people[m.dataset.toggleaccess]; save('people', { ...p, active: p.active === false }); peopleSheet(); return; }
  if ((m = t.closest('[data-crop]'))) { if (m.dataset.crop === '__new') cropEdit(null); else cropEdit(m.dataset.crop); return; }
  if ((m = t.closest('[data-open]'))) { openBlock(st.farm, m.dataset.open); return; }
  if ((m = t.closest('[data-goto]'))) { const [f, b] = m.dataset.goto.split('|'); openBlock(f, b); return; }
  if ((m = t.closest('[data-bedkey]'))) { editSheet([m.dataset.bedkey]); return; }
  if ((m = t.closest('[data-bed]'))) { const n = +m.dataset.bed; sel.has(n) ? sel.delete(n) : sel.add(n); render(); return; }
  if ((m = t.closest('[data-sub]'))) { const blk = curBlk(); const ids = m.dataset.sub === 'x' ? blk.extras.filter(n => bedOf(blk, n)) : subBeds(blk, ...blk.subs[+m.dataset.sub]); const all = ids.every(n => sel.has(n)); ids.forEach(n => all ? sel.delete(n) : sel.add(n)); render(); return; }
  if ((m = t.closest('[data-nav]'))) { st.view = m.dataset.nav; sel.clear(); render(); window.scrollTo(0, 0); return; }
  if ((m = t.closest('[data-farm]'))) { st.farm = m.dataset.farm; st.lb = 'all'; render(); return; }
  if ((m = t.closest('[data-mode]'))) { st.mapMode = m.dataset.mode; render(); return; }
  if ((m = t.closest('[data-lb]'))) { st.lb = m.dataset.lb; render(); return; }
  if ((m = t.closest('[data-lc]'))) { st.lc = m.dataset.lc; render(); return; }
  if ((m = t.closest('[data-filter]'))) { st.logFilter = m.dataset.filter; render(); return; }
  if ((m = t.closest('[data-month]'))) { const [k, d] = m.dataset.month.split('|'); st[k] = shiftMonth(st[k], +d); render(); return; }
  if ((m = t.closest('[data-lang]'))) { st.lang = m.dataset.lang; try { localStorage.setItem('pf6_lang', st.lang); } catch (x) { } render(); return; }
  if ((m = t.closest('[data-sell]'))) { saleSheet({ store: D.store_items[m.dataset.sell] }); return; }
  if ((m = t.closest('[data-receipt]'))) { receiptSheet(m.dataset.receipt); return; }
  if ((m = t.closest('[data-exp]'))) { expenseSheet(D.expenses[m.dataset.exp]); return; }
  if ((m = t.closest('[data-rec]'))) { recordSheet(m.dataset.rec); return; }
  if ((m = t.closest('[data-bill]'))) { const b = D.bills[m.dataset.bill]; const mo = st.month; save('expenses', { id: Store.uid(), date: mo === thisMonth() ? today() : mo + '-01', category: b.category, lines: [{ item: b.name, amt: +b.amount }], total: +b.amount, supplier: '', paid_by: ME.name, method: 'M-Pesa', bill_id: b.id, bill_month: mo, deleted: false, created_by: EMAIL }); toast(`${b.name} marked paid`); render(); return; }
  if ((m = t.closest('[data-unbill]'))) { const b = D.bills[m.dataset.unbill]; const p = billPayment(b, st.month); if (p) save('expenses', { ...p, deleted: true }); toast(`${b.name} marked not paid`); render(); return; }
  if ((m = t.closest('[data-more]'))) { const k = m.dataset.more; ({ crops: cropsSheet, products: productsSheet, bills: billsSheet, people: peopleSheet, pin: pinSheet, gap: gapSheet, sync: syncSheet, reports: reportsSheet })[k](); return; }
  const a = t.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
  if (act === 'back') { st.view = 'map'; sel.clear(); render(); window.scrollTo(0, 0); }
  else if (act === 'clearsel') { sel.clear(); render(); }
  else if (act === 'edit') editSheet(selKeys());
  else if (act === 'plant') plantSheet(); else if (act === 'spray') spraySheet(); else if (act === 'harvest') harvestSheet(); else if (act === 'work') workSheet();
  else if (act === 'sale') saleSheet(); else if (act === 'expense') expenseSheet(); else if (act === 'reports') reportsSheet();
  else if (act === 'close') closeSheet(); else if (act === 'sync') syncSheet();
  else if (act === 'addline') q('#plines').insertAdjacentHTML('beforeend', pline());
  else if (act === 'addeline') q('#elines').insertAdjacentHTML('beforeend', eline());
  else if (act === 'addstage') q('#stg').insertAdjacentHTML('beforeend', srow('', null, 'sg', 'Stage'));
  else if (act === 'addfeed') q('#fds').insertAdjacentHTML('beforeend', srow('', null, 'fd', 'Product'));
  else if (act === 'addprodrow') q('#plist').insertAdjacentHTML('beforeend', ctx.prow());
  else if (act === 'addbillrow') q('#plist').insertAdjacentHTML('beforeend', ctx.brow());
  else if (act === 'rmprod') a.closest('.prow').remove();
  else if (act === 'rmline') { const row = a.closest('.pline,.erow'); const box = row.parentElement; if (box.id === 'plines' && box.children.length === 1) row.querySelectorAll('input').forEach(i => i.value = ''); else row.remove(); if (hook) hook(); }
  else if (act === 'ghsetup') { const v = Math.round(+document.getElementById('f-ghn').value); if (!(v >= 1 && v <= 60)) { document.getElementById('gherr').textContent = 'Enter a number from 1 to 60.'; return; } ghSet(v); toast(`${v} greenhouse beds created`); render(); }
  else if (act === 'ghresize') openSheet(head('Greenhouse beds', 'Beds you remove keep their history in the log.') + `<div class="field"><label for="f-ghn2">Number of beds</label><input type="number" id="f-ghn2" min="1" max="60" step="1" value="${bedsIn(curBlk()).length}"></div>${ERR}${foot('Save', 'ghsave')}`);
  else if (act === 'ghsave') { const v = Math.round(+q('#f-ghn2').value); if (!(v >= 1 && v <= 60)) return err('Enter a number from 1 to 60.'); ghSet(v); finish(`Greenhouse now has ${v} beds`); }
  else if (act === 'copyrc') { const txt = receiptText(D.sales[ctx.id]); try { await navigator.clipboard.writeText(txt); toast('Receipt copied. Paste it into WhatsApp or SMS.'); } catch (x) { toast('Copying is blocked here.'); } }
  else if (act === 'printrc') { const s = D.sales[ctx.id]; printHtml(`Receipt ${s.receipt_no || ''}`, `<pre style="font:inherit;white-space:pre-wrap">${esc(receiptText(s))}</pre>`); }
  else if (act === 'addpay') { const s = D.sales[ctx.id], amt = Math.round(+q('#f-pay').value); if (!(amt > 0)) return err('Enter the amount paid.'); if (amt > saleBal(s)) return err(`The balance is only ${ksh(saleBal(s))}.`); save('sales', { ...s, payments: [...(s.payments || []), { date: today(), amt, how: val('how') }] }); toast('Payment saved'); receiptSheet(ctx.id); }
  else if (act === 'editsale') saleSheet({ sale: D.sales[ctx.id] });
  else if (act === 'delsale') { if (!confirmTap(a, 'Tap again to delete')) return; save('sales', { ...D.sales[ctx.id], deleted: true }); toast('Sale deleted'); closeSheet(); }
  else if (act === 'delexp') { if (!confirmTap(a, 'Tap again to delete')) return; save('expenses', { ...ctx.exp, deleted: true }); toast('Expense deleted'); closeSheet(); }
  else if (act === 'delrec') { if (!confirmTap(a, 'Tap again to delete')) return; save('records', { ...D.records[ctx.id], deleted: true }); toast('Record deleted'); closeSheet(); }
  else if (act === 'addperson') {
    const n = q('#f-pn').value.trim(), em = q('#f-pe').value.trim().toLowerCase(); if (!n) return err('Enter a name.'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return err('Enter a valid email address.'); if (D.people[em] && !D.people[em].deleted) return err('That email is already on the list.');
    const r = val('role'); save('people', { id: em, name: n, role: r, perms: [...ROLES[r]], note: '', active: true }); toast(`${n} added`); peopleSheet();
  }
  else if (act === 'unlock') { const pin = document.getElementById('f-pin').value; const ok = await Store.checkPin(pin, EMAIL); if (ok) { st.pinOK = true; try { sessionStorage.setItem('pf6_pinok', '1'); } catch (x) { } render(); } else { document.getElementById('pinerr').textContent = navigator.onLine || Store.demo ? 'Wrong PIN.' : 'Wrong PIN, or this phone needs signal the first time.'; } }
  else if (act === 'dlcsv' || act === 'printrep') { const r = buildReport(val('rtype'), val('rmonth')); if (act === 'dlcsv') { try { downloadCsv(r); } catch (x) { toast('Downloads are blocked here.'); } } else printHtml(r.title, tableHtml(r)); }
  else if (act === 'retryfail') { Store.retryFailed(); syncSheet(); }
  else if (act === 'discardfail') { if (!confirmTap(a, 'Tap again to discard')) return; Store.discardFailed(); syncSheet(); }
  else if (act === 'refresh') { a.textContent = 'Refreshing…'; await refresh(true); toast('Up to date'); syncSheet(); }
  else if (act === 'signout') { if (!confirmTap(a, 'Tap again to sign out')) return; await Store.signOut(); location.reload(); }
  else if (act === 'sendcode') sendCode();
  else if (act === 'verifycode') verifyCode();
  else if (SAVE[act]) SAVE[act]();
});
scrim.addEventListener('click', closeSheet);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.blk')) { e.preventDefault(); openBlock(st.farm, e.target.dataset.open); }
  if (e.key === 'Enter' && e.target.id === 'f-pin') document.querySelector('[data-act="unlock"]').click();
});
sheet.addEventListener('input', () => { if (q('#err')) q('#err').textContent = ''; if (hook) hook(); });
sheet.addEventListener('change', async e => {
  if (e.target.id !== 'f-photo') return; const f = e.target.files && e.target.files[0]; const im = q('#f-prev');
  if (!f) { ctx.photo = null; im.hidden = true; return; }
  try { ctx.photo = await resizeImage(f); im.src = URL.createObjectURL(ctx.photo); im.hidden = false; } catch (x) { ctx.photo = null; err(x.message); }
});

// ============================================================
// LOGIN AND START
// ============================================================
function showLogin(msg) {
  ME = null; document.getElementById('nav').hidden = true; document.getElementById('selbar').hidden = true; document.querySelector('.app').classList.add('nonav');
  document.getElementById('main').innerHTML = `<div class="login"><span class="logo">PF</span><h1>Sign in</h1><p>Enter your email. We'll send you a 6-digit code.</p>
  <div class="field"><label for="f-email">Email</label><input type="text" id="f-email" inputmode="email" autocomplete="email" placeholder="name@gmail.com"></div>
  <button class="btn primary" data-act="sendcode">Send code</button>
  <div id="codebox" hidden class="field"><label for="f-code">Code from the email</label><input type="text" id="f-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"><button class="btn primary" data-act="verifycode">Sign in</button><p class="muted">You can also tap the link in the email.</p></div>
  <div class="err" id="lerr">${msg ? esc(msg) : ''}</div></div>`;
}
async function sendCode() {
  const em = document.getElementById('f-email').value.trim().toLowerCase(); const le = document.getElementById('lerr');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { le.textContent = 'Enter a valid email address.'; return; }
  le.textContent = ''; const { error } = await Store.sendCode(em);
  if (error) { le.textContent = error.message; return; }
  try { localStorage.setItem('pf6_email', em); } catch (e) { }
  document.getElementById('codebox').hidden = false; toast('Code sent. Check your email.');
}
async function verifyCode() {
  const em = document.getElementById('f-email').value.trim().toLowerCase(), code = document.getElementById('f-code').value.trim(); const le = document.getElementById('lerr');
  const { data, error } = await Store.verifyCode(em, code);
  if (error) { le.textContent = 'That code did not work. Check it, or send a new one.'; return; }
  start(data.session.user.email);
}
function showNoAccess() {
  document.getElementById('nav').hidden = true; document.querySelector('.app').classList.add('nonav');
  document.getElementById('main').innerHTML = `<div class="login"><span class="logo">PF</span><h1>Not on the farm list yet</h1><p>${esc(EMAIL)} isn't on the list of people who can use the farm app. Ask Rod to add this email under More → People and access, then open the app again.</p><button class="btn" data-act="signout">Use a different email</button></div>`;
}
async function refresh(full) {
  try {
    const fresh = await Store.pull(full);
    if (!fresh) return;
    Object.keys(fresh).forEach(t => mergeRows(t, fresh[t]));
    ME = D.people[EMAIL] && D.people[EMAIL].active !== false ? D.people[EMAIL] : null;
    if (!ME) { showNoAccess(); return; }
    if (sheet.hidden) render(); else syncPill();
  } catch (e) { console.warn('Refresh failed', e); syncPill(); }
}
async function start(email) {
  if (started) return; started = true; EMAIL = email.toLowerCase();
  const cache = await Store.loadCache(); Object.keys(cache).forEach(t => { if (cache[t]) D[t] = cache[t]; });
  ME = D.people[EMAIL] && D.people[EMAIL].active !== false ? D.people[EMAIL] : null;
  if (ME) render(); else document.getElementById('main').innerHTML = '<div class="empty-state"><b>Loading the farm…</b></div>';
  await refresh(!cache.beds);
  if (!ME && !navigator.onLine) document.getElementById('main').innerHTML = '<div class="empty-state"><b>Connect once to load the farm</b><span>After that, the app works without signal.</span></div>';
  Store.flush();
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
}
function loadDemo() {
  SEED.crops.forEach(c => D.crops[c.id] = { ...c, archived: false });
  SEED.blocks.forEach(b => D.blocks[b.id] = { ...b });
  SEED.beds.forEach(b => D.beds[b.id] = { ...b });
  SEED.records.forEach(r => { const id = Store.uid(); D.records[id] = { ...r, id, photo_url: '', data: {}, deleted: false, created_by: 'setup', created_at: r.date + 'T08:00:00Z' }; });
  SEED.bills.forEach(b => { const id = Store.uid(); D.bills[id] = { ...b, id, deleted: false }; });
  SEED.products.forEach(p => { const id = Store.uid(); D.products[id] = { ...p, id, deleted: false }; });
  SEED.demoPeople.forEach(p => D.people[p.id] = { id: p.id, name: p.name, role: p.role, perms: [...new Set([...ROLES[p.role], ...(p.extra || [])])], note: p.note, active: true });
  EMAIL = 'rod@example.com'; ME = D.people[EMAIL];
}

Store.on('status', () => syncPill());
Store.on('row', (t, row) => { if (!row || !row.id) return; if (Store.pendingIds(t).has(row.id)) return; D[t][row.id] = row; markDirty(t); if (t === 'sales' && sheet.hidden && st.view === 'sales') render(); });

(async function boot() {
  await Store.init();
  if (Store.demo) { document.querySelector('.demo').classList.remove('hide'); loadDemo(); render(); return; }
  Store.onAuth((ev, s) => { if ((ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') && s && s.user) start(s.user.email); });
  const s = await Store.session();
  if (s && s.user) start(s.user.email);
  else { const cached = (() => { try { return localStorage.getItem('pf6_email'); } catch (e) { return null; } })(); showLogin(); if (cached) document.getElementById('f-email').value = cached; }
})();
