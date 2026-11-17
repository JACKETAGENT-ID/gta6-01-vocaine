// Isla Verde — island map: zones, roads, buildings, docks, palms, treasure chests.
// World is 3200x3200. Island is a superellipse; ocean surrounds it.
import { mulberry32, randRange, randInt, pick, clamp } from './rng.js';

export const WORLD = 3200;
export const CX = 1600, CY = 1600, RX = 1480, RY = 1420;

export function islandValue(x, y) {
  const dx = Math.abs(x - CX) / RX, dy = Math.abs(y - CY) / RY;
  return Math.pow(dx, 3.2) + Math.pow(dy, 3.2);
}
export function isLand(x, y) { return islandValue(x, y) <= 1; }
export function isBeach(x, y) { const v = islandValue(x, y); return v > 0.82 && v <= 1; }
export function isWater(x, y) { return !isLand(x, y); }
export function isDeepWater(x, y) { return islandValue(x, y) > 1.35; }

export function superellipsePath(ctx, cx, cy, rx, ry, n = 3.2) {
  // Path matching islandValue()'s superellipse (power n), so the drawn land
  // exactly matches the walkable/drivable island. A plain ctx.ellipse (power 2)
  // would clip the island's corners away.
  ctx.beginPath();
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const x = cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export const ZONES = [
  { id: 'town',    name: 'Kota Verde',      x: 1150, y: 1150, w: 900, h: 600, color: '#b8a88a' },
  { id: 'strip',   name: 'Strip Marisol',   x: 1150, y: 2330, w: 950, h: 330, color: '#d8c49a' },
  { id: 'port',    name: 'Pelabuhan Coral', x: 2380, y: 1150, w: 520, h: 700, color: '#9a9a92' },
  { id: 'village', name: 'Desa Nelayan',    x: 330,  y: 1280, w: 480, h: 620, color: '#c9b489' },
  { id: 'jungle',  name: 'Jungle Verde',    x: 900,  y: 480,  w: 1400, h: 560, color: '#2e6b2f' },
  { id: 'north',   name: 'Tanjung Utara',   x: 1350, y: 170,  w: 500, h: 330, color: '#7fae62' },
];

export const ROADS = [
  // coastal ring road (rectangle loop)
  { x: 430, y: 380, w: 2340, h: 46, dirt: false },   // north edge
  { x: 430, y: 2760, w: 2340, h: 46, dirt: false },  // south edge
  { x: 430, y: 380, w: 46, h: 2426, dirt: false },   // west edge
  { x: 2724, y: 380, w: 46, h: 2426, dirt: false },  // east edge
  // town grid
  { x: 1300, y: 1150, w: 40, h: 600, dirt: false },
  { x: 1600, y: 1150, w: 40, h: 600, dirt: false },
  { x: 1900, y: 1150, w: 40, h: 600, dirt: false },
  { x: 1150, y: 1300, w: 900, h: 40, dirt: false },
  { x: 1150, y: 1560, w: 900, h: 40, dirt: false },
  // port
  { x: 2560, y: 900, w: 44, h: 1150, dirt: false },
  { x: 2050, y: 1480, w: 850, h: 44, dirt: false },
  // village
  { x: 560, y: 1080, w: 40, h: 1020, dirt: false },
  { x: 330, y: 1560, w: 480, h: 40, dirt: false },
  // tourist strip
  { x: 1000, y: 2480, w: 1300, h: 44, dirt: false },
  // jungle dirt roads
  { x: 1580, y: 380, w: 36, h: 720, dirt: true },
  { x: 900, y: 740, w: 1400, h: 36, dirt: true },
  { x: 1150, y: 1010, w: 36, h: 420, dirt: true },
  // lighthouse causeway
  { x: 1580, y: 170, w: 40, h: 230, dirt: true },
  // connectors
  { x: 2050, y: 1480, w: 200, h: 44, dirt: false },
  { x: 800, y: 1560, w: 350, h: 40, dirt: false },
];

export const DOCKS = [
  { id: 'port',    name: 'Dermaga Coral',  x: 2900, y: 1500, angle: 0, len: 260, w: 34 },
  { id: 'village', name: 'Dermaga Nelayan', x: 330, y: 1620, angle: Math.PI, len: 280, w: 30 },
  { id: 'marina',  name: 'Marina Marisol', x: 1680, y: 2680, angle: Math.PI / 2, len: 380, w: 30 },
];

export const SHOPS = [
  { id: 'gun',   name: 'Toko Senjata Roko', x: 1330, y: 1330, kind: 'gun' },
  { id: 'clinic', name: 'Klinik Pantai',   x: 1930, y: 1590, kind: 'clinic' },
  { id: 'bar',   name: 'Bar Ombak',        x: 1500, y: 2500, kind: 'bar' },
];

export function onRoad(x, y, pad = 0) {
  for (const r of ROADS) {
    if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return r;
  }
  return null;
}
export function onDock(x, y) {
  for (const d of DOCKS) {
    const dx = x - d.x, dy = y - d.y;
    const along = dx * Math.cos(d.angle) + dy * Math.sin(d.angle);
    const side = -dx * Math.sin(d.angle) + dy * Math.cos(d.angle);
    if (along > -10 && along < d.len && Math.abs(side) < d.w / 2 + 6) return d;
  }
  return null;
}

const BUILDING_COLORS = ['#e8d8b0', '#d9a066', '#c97b5a', '#8fb8c9', '#e0e0d8', '#b5c47a', '#d98a8a', '#7fa8d9'];
const ROOF_COLORS = ['#a34d2d', '#5d7a3a', '#3f6d8e', '#8e6b3f', '#6b4a7a'];
const BUILDING_TYPES = ['Rumah', 'Toko', 'Hotel', 'Gudang', 'Warung', 'Kantor', 'Losmen', 'Bengkel'];

export function buildWorld() {
  const rng = mulberry32(1337);
  const buildings = [];
  const zoneFor = (zid) => ZONES.find(z => z.id === zid);
  const spots = [
    { z: 'town', n: 34, wMin: 60, wMax: 130, hMin: 50, hMax: 110 },
    { z: 'strip', n: 18, wMin: 70, wMax: 150, hMin: 50, hMax: 90 },
    { z: 'port', n: 12, wMin: 90, wMax: 180, hMin: 70, hMax: 130 },
    { z: 'village', n: 20, wMin: 46, wMax: 90, hMin: 40, hMax: 80 },
    { z: 'jungle', n: 6, wMin: 50, wMax: 90, hMin: 46, hMax: 80 },
  ];
  for (const s of spots) {
    const z = zoneFor(s.z);
    let placed = 0, tries = 0;
    while (placed < s.n && tries < 400) {
      tries++;
      const w = randRange(rng, s.wMin, s.wMax);
      const h = randRange(rng, s.hMin, s.hMax);
      const x = randRange(rng, z.x + 14, z.x + z.w - w - 14);
      const y = randRange(rng, z.y + 14, z.y + z.h - h - 14);
      if (!isLand(x + w / 2, y + h / 2)) continue;
      let bad = false;
      for (const r of ROADS) {
        if (x < r.x + r.w + 26 && x + w > r.x - 26 && y < r.y + r.h + 26 && y + h > r.y - 26) { bad = true; break; }
      }
      if (bad) continue;
      for (const b of buildings) {
        if (x < b.x + b.w + 22 && x + w > b.x - 22 && y < b.y + b.h + 22 && y + h > b.y - 22) { bad = true; break; }
      }
      if (bad) continue;
      for (const d of DOCKS) {
        if (x < d.x + 120 && x + w > d.x - 120 && y < d.y + 120 && y + h > d.y - 120) { bad = true; break; }
      }
      if (bad) continue;
      buildings.push({
        x, y, w, h,
        color: pick(rng, BUILDING_COLORS),
        roof: pick(rng, ROOF_COLORS),
        type: pick(rng, BUILDING_TYPES),
        floors: randInt(rng, 1, 3),
        zone: s.z,
      });
      placed++;
    }
  }
  // palms: beach + jungle scatter
  const palms = [];
  let ptries = 0;
  while (palms.length < 300 && ptries < 3000) {
    ptries++;
    const x = randRange(rng, 200, 3000), y = randRange(rng, 200, 3000);
    if (!isLand(x, y)) continue;
    if (!isBeach(x, y)) {
      const inJungle = x > 900 && x < 2300 && y > 480 && y < 1040;
      if (!inJungle && rng() > 0.25) continue;
    }
    if (onRoad(x, y, 30)) continue;
    let bad = false;
    for (const b of buildings) if (x > b.x - 16 && x < b.x + b.w + 16 && y > b.y - 16 && y < b.y + b.h + 16) { bad = true; break; }
    if (bad) continue;
    palms.push({ x, y, s: randRange(rng, 0.8, 1.3), lean: randRange(rng, -0.25, 0.25) });
  }
  // 20 treasure chests: jungle 8, beach 6, village 3, port 3
  const chests = [];
  const chestAreas = [
    { x: 900, y: 480, w: 1400, h: 560, n: 8, land: true },
    { x: 300, y: 300, w: 2600, h: 2600, n: 6, beach: true },
    { x: 330, y: 1280, w: 480, h: 620, n: 3, land: true },
    { x: 2380, y: 1150, w: 520, h: 700, n: 3, land: true },
  ];
  for (const a of chestAreas) {
    let placed = 0, tries = 0;
    while (placed < a.n && tries < 300) {
      tries++;
      const x = randRange(rng, a.x + 20, a.x + a.w - 20);
      const y = randRange(rng, a.y + 20, a.y + a.h - 20);
      if (a.beach && !isBeach(x, y)) continue;
      if (a.land && !isLand(x, y)) continue;
      if (onRoad(x, y, 24)) continue;
      let bad = false;
      for (const b of buildings) if (x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20) { bad = true; break; }
      if (bad) continue;
      if (chests.some(c => Math.abs(c.x - x) < 120 && Math.abs(c.y - y) < 120)) continue;
      chests.push({ x, y, found: false, value: randInt(rng, 150, 600) });
      placed++;
    }
  }
  return { buildings, palms, chests };
}

export function collideBuildings(x, y, r, buildings) {
  // Circle vs building AABBs. Returns corrected {x, y} pushed out of overlaps.
  for (const b of buildings) {
    const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r; y = ny + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // center inside building: push out along smallest penetration axis
      const pl = x - b.x, pr = b.x + b.w - x, pt = y - b.y, pb = b.y + b.h - y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
      else if (m === pt) y = b.y - r; else y = b.y + b.h + r;
    }
  }
  return { x, y };
}
