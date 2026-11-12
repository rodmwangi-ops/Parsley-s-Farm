// ============================================================
// PARSLEY'S FARM v6 — Starting data (farm state on 12 Nov 2026)
// Used two ways:
//   1. tools/make-seed.js turns this into supabase/02_seed.sql
//   2. Demo mode (no Supabase settings yet) runs on this data in memory
// After setup, everything is edited in the app, not here.
// ============================================================
(function (root) {
  const SEED = {};

  SEED.crops = [
    { id: 'hoho', name: 'Hoho', name_sw: 'Pilipili hoho', color: '#1E7A34', kind: 'main', count_from: 'Transplant',
      stages: [['Vegetative', 0], ['Flowering', 30], ['Fruiting', 60]], feeds: [['DAP', 14], ['CAN', 21], ['NPK 17:17:17', 35]], sort: 1 },
    { id: 'dhania', name: 'Dhania', name_sw: 'Dhania', color: '#F2C12E', kind: 'main', count_from: 'Planting',
      stages: [['Germinating', 0], ['Vegetative', 11], ['Ready to cut', 40]], feeds: [], sort: 2 },
    { id: 'kunde', name: 'Kunde', name_sw: 'Kunde', color: '#C2185B', kind: 'main', count_from: 'Planting',
      stages: [['Germinating', 0], ['Vegetative', 7], ['Ready', 26]], feeds: [], sort: 3 },
    { id: 'basil', name: 'Basil', name_sw: 'Basil', color: '#5B3FA8', kind: 'main', count_from: 'Planting',
      stages: [['Vegetative', 0], ['Ready to cut', 30]], feeds: [], sort: 4 },
    { id: 'veg', name: "Workers' veg", name_sw: 'Mboga za wafanyakazi', color: '#E8731A', kind: 'other', count_from: 'Planting', stages: [], feeds: [], sort: 10 },
    { id: 'mchicha', name: 'Mchicha', name_sw: 'Mchicha', color: '#E8731A', kind: 'other', count_from: 'Planting', stages: [], feeds: [], sort: 11 },
    { id: 'spinach', name: 'Spinach', name_sw: 'Spinachi', color: '#E8731A', kind: 'other', count_from: 'Planting', stages: [], feeds: [], sort: 12, to_remove: true },
    { id: 'sukuma', name: 'Sukuma', name_sw: 'Sukuma wiki', color: '#E8731A', kind: 'other', count_from: 'Planting', stages: [], feeds: [], sort: 13, to_remove: true },
    { id: 'managu', name: 'Managu', name_sw: 'Managu', color: '#E8731A', kind: 'other', count_from: 'Planting', stages: [], feeds: [], sort: 14, to_remove: true },
    { id: 'mito', name: 'Mito', name_sw: 'Mito', color: '#E8731A', kind: 'other', count_from: 'Planting', stages: [], feeds: [], sort: 15, to_remove: true },
    { id: 'cassava', name: 'Cassava', name_sw: 'Muhogo', color: '#7A4E2A', kind: 'fixed', count_from: 'Planting', stages: [], feeds: [], sort: 20 },
    { id: 'sweetpot', name: 'Sweet potato', name_sw: 'Viazi vitamu', color: '#7A4E2A', kind: 'fixed', count_from: 'Planting', stages: [], feeds: [], sort: 21 }
  ];

  SEED.blocks = [
    { id: 'joshua-A', farm: 'joshua', code: 'A', label: 'Block A', kind: 'block', was: 'A1', top_note: 'Houses and store end', bottom_note: 'Road end',
      subs: [[1, 7], [8, 17], [18, 34]], extras: [], short_beds: [1, 2], gh_range: null, sub_notes: { 0: "Planned: workers' vegetable beds" }, sort: 1 },
    { id: 'joshua-B', farm: 'joshua', code: 'B', label: 'Block B', kind: 'block', was: 'A2', top_note: 'Trench end', bottom_note: 'Road end',
      subs: [[1, 9], [10, 19], [20, 36]], extras: [], short_beds: [], gh_range: null, sub_notes: {}, sort: 2 },
    { id: 'joshua-C', farm: 'joshua', code: 'C', label: 'Block C', kind: 'block', was: 'A3', top_note: 'Trench end', bottom_note: 'Road end',
      subs: [[1, 10], [11, 20], [21, 35]], extras: [], short_beds: [], gh_range: null, sub_notes: {}, sort: 3 },
    { id: 'joshua-D', farm: 'joshua', code: 'D', label: 'Block D', kind: 'defunct', was: 'A4', top_note: '', bottom_note: '',
      subs: [], extras: [], short_beds: [], gh_range: null, sub_notes: {}, sort: 4 },
    { id: 'joel-A', farm: 'joel', code: 'A', label: 'Block A', kind: 'block', was: 'B1', top_note: 'Top of the map', bottom_note: 'Gate end',
      subs: [[1, 10], [11, 20], [21, 30], [31, 42]], extras: [43, 44], short_beds: [], gh_range: [15, 30],
      sub_notes: { 3: 'Kipchoge to check beds 31 to 42, his list was counted in reverse' }, sort: 1 },
    { id: 'joel-B', farm: 'joel', code: 'B', label: 'Block B', kind: 'block', was: 'B2', top_note: 'Top of the map', bottom_note: 'Gate end',
      subs: [[1, 10], [11, 20], [21, 30], [31, 42]], extras: [43], short_beds: [], gh_range: null,
      sub_notes: { 3: 'Kipchoge to confirm: 41 or 42 beds' }, sort: 2 },
    { id: 'joel-C', farm: 'joel', code: 'C', label: 'Block C', kind: 'block', was: 'B4, formerly Block D', top_note: 'Dam end', bottom_note: 'Block A end',
      subs: [[1, 10], [11, 20], [21, 30]], extras: [], short_beds: [1], gh_range: null, sub_notes: {}, sort: 3 },
    { id: 'joel-GH', farm: 'joel', code: 'GH', label: 'Greenhouse', kind: 'greenhouse', was: 'new', top_note: 'Door end', bottom_note: '',
      subs: [], extras: [], short_beds: [], gh_range: null, sub_notes: {}, sort: 4 },
    { id: 'joel-oldC', farm: 'joel', code: 'oldC', label: 'Old Block C', kind: 'defunct', was: 'B3', top_note: '', bottom_note: '',
      subs: [], extras: [], short_beds: [], gh_range: null, sub_notes: {}, sort: 5 }
  ];

  // ---- beds ----
  const beds = {};
  function block(farm, code) {
    const b = SEED.blocks.find(x => x.id === farm + '-' + code);
    const nums = [];
    b.subs.forEach(([a, z]) => { for (let i = a; i <= z; i++) nums.push(i); });
    b.extras.forEach(i => nums.push(i));
    nums.forEach(n => {
      if (b.gh_range && n >= b.gh_range[0] && n <= b.gh_range[1]) return; // retired, under the greenhouse
      beds[`${farm}|${code}|${n}`] = { id: `${farm}|${code}|${n}`, farm, block: code, num: n, crop: 'empty', plant_date: null, approx: false,
        note: '', drip: null, poor: false, needs_check: false, seedbed: false, feeds_done: [], active: true };
    });
  }
  function S(farm, code, r, p) {
    const [a, z] = String(r).split('-').map(Number);
    for (let i = a; i <= (z || a); i++) Object.assign(beds[`${farm}|${code}|${i}`], p);
  }
  ['A', 'B', 'C'].forEach(c => block('joshua', c));
  ['A', 'B', 'C'].forEach(c => block('joel', c));

  // Joshua's Block A
  S('joshua', 'A', '1-3', { crop: 'dhania' }); S('joshua', 'A', '4-5', { crop: 'kunde' }); S('joshua', 'A', 6, { crop: 'mchicha' });
  S('joshua', 'A', 7, { crop: 'dhania' }); S('joshua', 'A', 8, { crop: 'dhania' });
  S('joshua', 'A', 9, { crop: 'hoho', seedbed: true, note: 'Seedlings for transplanting' });
  S('joshua', 'A', '10-14', { crop: 'kunde' }); S('joshua', 'A', '15-16', { crop: 'spinach' }); S('joshua', 'A', 17, { crop: 'kunde' });
  S('joshua', 'A', '18-19', { crop: 'kunde' }); S('joshua', 'A', '20-21', { crop: 'dhania', poor: true, note: 'Poor growth' });
  S('joshua', 'A', '22-24', { crop: 'kunde' }); S('joshua', 'A', '25-29', { crop: 'dhania', note: 'Germinating' });
  S('joshua', 'A', '30-33', { crop: 'dhania', note: 'Just germinated' }); S('joshua', 'A', 34, { crop: 'sweetpot' });
  // Joshua's Block B
  S('joshua', 'B', '1-4', { crop: 'kunde' }); S('joshua', 'B', '5-7', { crop: 'hoho', plant_date: '2026-10-31' }); S('joshua', 'B', '8-9', { crop: 'kunde' });
  S('joshua', 'B', '10-15', { crop: 'kunde', note: 'Mature' }); S('joshua', 'B', '16-19', { crop: 'kunde', note: 'Not yet mature' });
  S('joshua', 'B', '20-22', { crop: 'dhania', note: 'Just germinated' }); S('joshua', 'B', '23-28', { crop: 'empty', note: 'Being ploughed' });
  S('joshua', 'B', '29-36', { crop: 'dhania', poor: true, note: 'Poor growth' });
  // Joshua's Block C
  S('joshua', 'C', 1, { crop: 'unploughed', note: 'Cut by the trench, needs ploughing' }); S('joshua', 'C', '2-10', { crop: 'dhania', note: 'Maturing' });
  S('joshua', 'C', '11-19', { crop: 'kunde', note: 'Mature' }); S('joshua', 'C', 20, { crop: 'cassava', drip: 1 });
  S('joshua', 'C', '21-35', { crop: 'hoho', plant_date: '2026-10-31' });
  // Joel's Block A
  S('joel', 'A', '1-10', { crop: 'kunde', note: 'Germinated' }); S('joel', 'A', '11-14', { crop: 'kunde', plant_date: '2026-11-06' });
  S('joel', 'A', 31, { crop: 'dhania', note: 'Small', needs_check: true }); S('joel', 'A', '32-33', { crop: 'empty', needs_check: true });
  S('joel', 'A', '34-36', { crop: 'spinach', needs_check: true }); S('joel', 'A', 37, { crop: 'sukuma', needs_check: true });
  S('joel', 'A', '38-42', { crop: 'dhania', note: 'Germinating', needs_check: true });
  S('joel', 'A', '43-44', { crop: 'unploughed', note: 'Piping fitted, needs tilling' });
  // Joel's Block B
  S('joel', 'B', '1-8', { crop: 'hoho', note: 'Young' }); S('joel', 'B', '9-10', { crop: 'managu' });
  S('joel', 'B', '11-33', { crop: 'empty', note: 'Hoho removed (anaemic)' }); S('joel', 'B', '34-42', { crop: 'hoho', note: 'Young' }); S('joel', 'B', 42, { needs_check: true, note: 'Young · confirm the block has 42 beds' });
  S('joel', 'B', 43, { crop: 'unploughed', note: 'Piping fitted, needs tilling' });
  // Joel's Block C
  S('joel', 'C', 1, { crop: 'sukuma', note: 'Small bed (about 12 m)' }); S('joel', 'C', '2-6', { crop: 'kunde', note: 'Almost ready' });
  S('joel', 'C', '7-10', { crop: 'dhania', note: 'Germinating' }); S('joel', 'C', '11-18', { crop: 'dhania', note: 'Half almost ready, half germinating' });
  S('joel', 'C', '19-20', { crop: 'kunde', note: 'Medium' }); S('joel', 'C', '21-24', { crop: 'kunde', note: 'Sown, not up yet' });
  S('joel', 'C', 25, { crop: 'mito' }); S('joel', 'C', '26-29', { crop: 'kunde', note: 'Sown, not up yet' });
  S('joel', 'C', 30, { crop: 'cassava', drip: 0, note: 'No drip line' });
  SEED.beds = Object.values(beds);

  const keys = (f, c, a, z) => Array.from({ length: z - a + 1 }, (_, i) => `${f}|${c}|${a + i}`);
  SEED.records = [
    { date: '2026-10-31', type: 'plant', title: 'Transplanted hoho', details: '', where_text: "Joshua's · Block C · beds 21–35", targets: keys('joshua', 'C', 21, 35), done_by: '' },
    { date: '2026-10-31', type: 'plant', title: 'Transplanted hoho', details: '', where_text: "Joshua's · Block B · beds 5–7", targets: keys('joshua', 'B', 5, 7), done_by: '' },
    { date: '2026-11-06', type: 'plant', title: 'Planted kunde', details: '', where_text: "Joel's · Block A · beds 11–14", targets: keys('joel', 'A', 11, 14), done_by: '' }
  ];

  SEED.bills = [
    { name: 'Rent', category: 'Rent', amount: 16800, active: true, note: '', sort: 1 },
    { name: 'Salary · Joel', category: 'Salaries', amount: 10000, active: true, note: '', sort: 2 },
    { name: 'Salary · Joshua', category: 'Salaries', amount: 10000, active: true, note: '', sort: 3 },
    { name: 'Salary · Supervisor', category: 'Salaries', amount: 10000, active: false, note: 'Starts when hired', sort: 4 }
  ];

  // Fill in active ingredients and waiting days (pre-harvest interval) from the inputs workbook in the app.
  SEED.products = [
    { name: 'Alonze', type: 'Insecticide', active_ingredient: '', phi_days: null },
    { name: 'Tihan', type: 'Insecticide', active_ingredient: '', phi_days: null },
    { name: 'Cyclotron', type: 'Insecticide', active_ingredient: '', phi_days: null },
    { name: 'Metacop', type: 'Fungicide', active_ingredient: '', phi_days: null },
    { name: 'Algreen', type: 'Foliar', active_ingredient: '', phi_days: null },
    { name: 'DAP', type: 'Fertiliser', active_ingredient: '', phi_days: null },
    { name: 'CAN', type: 'Fertiliser', active_ingredient: '', phi_days: null },
    { name: 'NPK 17:17:17', type: 'Fertiliser', active_ingredient: '', phi_days: null }
  ];

  // Demo mode only. Real people are added in Supabase (see SETUP.md) and then in the app.
  SEED.demoPeople = [
    { id: 'rod@example.com', name: 'Rod', role: 'Admin', note: 'Owner' },
    { id: 'lorna@example.com', name: 'Lorna', role: 'Admin', note: 'Buys inputs, records expenses' },
    { id: 'kipchoge@example.com', name: 'Kipchoge', role: 'Checker', note: 'Checks beds, adds expenses when sent to buy', extra: ['expenses'] },
    { id: 'levi@example.com', name: 'Levi', role: 'Family', note: '' },
    { id: 'joel@example.com', name: 'Joel', role: 'Farm hand', note: '' },
    { id: 'joshua@example.com', name: 'Joshua', role: 'Farm hand', note: '' }
  ];

  SEED.ROLES = {
    'Admin': ['field', 'edit_beds', 'sales', 'expenses', 'money', 'people'],
    'Supervisor': ['field', 'edit_beds', 'sales', 'expenses'],
    'Checker': ['field', 'edit_beds'],
    'Family': ['money'],
    'Farm hand': ['field']
  };

  root.SEED = SEED;
  if (typeof module !== 'undefined') module.exports = SEED;
})(typeof window !== 'undefined' ? window : globalThis);
