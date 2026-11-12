// ============================================================
// PARSLEY'S FARM v6 — How the two farms are drawn on the map
// Block contents (beds, hydrant sections, greenhouse) live in the database.
// This file only places each block on the drawing: [code, x, y, width, height].
// ============================================================
const FARMS = {
  joshua: {
    name: "Joshua's farm", short: "Joshua's",
    map: {
      h: 520,
      items: [['D', 6, 30, 30, 430], ['C', 42, 30, 92, 430], ['B', 154, 30, 92, 430], ['A', 262, 82, 92, 378]],
      deco: `
      <rect x="40" y="16" width="208" height="7" rx="2" class="wsoft"/><text x="42" y="12">Trench</text>
      <rect x="139" y="28" width="11" height="432" rx="2" class="wsoft"/><text transform="rotate(-90 147 250)" x="147" y="250" text-anchor="middle">Drainage</text>
      <rect x="250" y="28" width="8" height="432" class="pathr"/>
      <rect x="262" y="34" width="24" height="22" rx="2" class="bld"/><text x="274" y="70" text-anchor="middle">Tank</text>
      <rect x="290" y="34" width="30" height="22" rx="2" class="bld"/><text x="305" y="70" text-anchor="middle">Store</text>
      <rect x="324" y="28" width="30" height="30" rx="2" class="bld"/><text x="339" y="70" text-anchor="middle">House</text>
      <line x1="6" y1="500" x2="354" y2="500" class="road"/><text x="150" y="514" text-anchor="middle">Road side</text>
      <rect x="318" y="496" width="30" height="8" class="gate"/><text x="333" y="516" text-anchor="middle">Gate</text>`
    }
  },
  joel: {
    name: "Joel's farm", short: "Joel's",
    map: {
      h: 905,
      items: [['C', 216, 30, 138, 300], ['oldC', 6, 400, 36, 440], ['B', 52, 400, 138, 440], ['A', 216, 400, 138, 440]],
      deco: `
      <ellipse cx="108" cy="178" rx="88" ry="128" class="dam"/><text x="108" y="182" text-anchor="middle" class="deadt">Defunct dam</text>
      <rect x="22" y="322" width="40" height="22" rx="3" class="bld"/><text x="42" y="358" text-anchor="middle">Tank</text>
      <rect x="196" y="396" width="14" height="446" rx="2" class="wsoft"/><text transform="rotate(-90 205 620)" x="205" y="620" text-anchor="middle">Path and drainage</text>
      <rect x="300" y="886" width="40" height="8" class="gate"/><text x="282" y="894" text-anchor="end">Gate</text>`
    }
  }
};
