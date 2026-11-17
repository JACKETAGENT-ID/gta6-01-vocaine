// Isla Verde — vehicles, traffic, pedestrians, police, coast guard, combat.
// 6 vehicle types: 4 land + 2 boats. Police chase on land, Coast Guard at sea.
import { mulberry32, randRange, randInt, pick, clamp, dist, angleTo, angleLerp } from './rng.js';
import { WORLD, isLand, isWater, isDeepWater, onRoad, onDock, collideBuildings, ROADS, DOCKS } from './world.js';

export const VEHICLE_TYPES = {
  sedan:     { name: 'Sedan Pantai',     w: 46, h: 22, max: 305, accel: 265, grip: 3.4, boat: false, colors: ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#9b59b6'] },
  pickup:    { name: 'Pickup Bak Terbuka', w: 50, h: 24, max: 275, accel: 235, grip: 3.0, boat: false, colors: ['#27ae60', '#e67e22', '#95a5a6', '#c0392b'] },
  bike:      { name: 'Motor Pantai',     w: 36, h: 14, max: 365, accel: 350, grip: 4.6, boat: false, colors: ['#e84393', '#00cec9', '#fdcb6e', '#d63031'] },
  van:       { name: 'Van Kargo',        w: 54, h: 26, max: 235, accel: 195, grip: 2.6, boat: false, colors: ['#ffffff', '#7f8c8d', '#6c5ce7', '#f5c542'] },
  speedboat: { name: 'Speedboat Coral',  w: 58, h: 22, max: 335, accel: 285, grip: 2.2, boat: true,  colors: ['#ff6b6b', '#48dbfb', '#feca57', '#ffffff'] },
  fisher:    { name: 'Perahu Nelayan',   w: 54, h: 24, max: 195, accel: 165, grip: 2.0, boat: true,  colors: ['#2e86de', '#10ac84', '#ee5253', '#f7b731'] },
};
export const POLICE_COLOR = '#1b2a4a';
export const COASTGUARD_COLOR = '#ff7f2a';

const LOOPS = [
  // coastal ring (clockwise)
  [[700, 403], [2500, 403], [2747, 700], [2747, 2500], [2500, 2783], [700, 2783], [453, 2500], [453, 700]],
  // town loop
  [[1320, 1320], [1880, 1320], [1880, 1580], [1320, 1580]],
  // port loop
  [[2582, 1000], [2582, 1900], [2100, 1502], [2582, 1502]],
  // strip loop
  [[1150, 2502], [2200, 2502], [2200, 2502], [1150, 2502]],
];
const BOAT_LOOPS = [
  [[1600, 100], [2950, 500], [3150, 1600], [2950, 2700], [1600, 3080], [250, 2700], [80, 1600], [250, 500]],
  [[2400, 300], [3150, 1600], [2600, 2950], [1600, 3050]],
];

export function makeVehicle(type, x, y, angle, color) {
  const t = VEHICLE_TYPES[type];
  return { type, x, y, angle, speed: 0, color: color || pick(Math.random, t.colors), driver: 'none', hp: 100, wake: 0 };
}

export function createEntities(world) {
  const rng = mulberry32(20240);
  const E = { cars: [], boats: [], peds: [], police: [], guard: [], bullets: [], enemies: [], particles: [], parked: [] };
  // parked vehicles around town / strip / port / village
  const parkSpots = [
    ['sedan', 1360, 1340, 0], ['pickup', 1700, 1340, 0], ['van', 1960, 1340, 0],
    ['sedan', 1360, 1620, Math.PI], ['bike', 1700, 1620, 0], ['pickup', 1960, 1620, Math.PI],
    ['sedan', 1200, 2520, 0], ['bike', 1500, 2520, 0], ['van', 1900, 2520, 0], ['sedan', 2150, 2520, 0],
    ['pickup', 2620, 1560, Math.PI / 2], ['van', 2620, 1700, Math.PI / 2], ['sedan', 2500, 1000, 0],
    ['pickup', 620, 1620, 0], ['sedan', 620, 1750, 0], ['bike', 500, 1400, Math.PI / 2],
    ['sedan', 500, 420, 0], ['pickup', 2700, 420, 0], ['bike', 1650, 500, Math.PI / 2],
  ];
  for (const [t, x, y, a] of parkSpots) E.parked.push(makeVehicle(t, x, y, a));
  // moored boats at docks
  const boatSpots = [
    ['speedboat', 3130, 1420, 0], ['speedboat', 3130, 1580, 0], ['fisher', 3150, 1500, 0],
    ['fisher', 80, 1600, Math.PI], ['fisher', 85, 1650, Math.PI], ['speedboat', 60, 1620, Math.PI],
    ['speedboat', 1720, 3050, Math.PI / 2], ['fisher', 1640, 3040, Math.PI / 2], ['speedboat', 1700, 3030, Math.PI / 2],
  ];
  for (const [t, x, y, a] of boatSpots) E.parked.push(makeVehicle(t, x, y, a));
  // traffic cars
  const trafficTypes = ['sedan', 'sedan', 'pickup', 'van', 'bike', 'sedan', 'pickup'];
  for (let i = 0; i < 16; i++) {
    const loop = LOOPS[i % LOOPS.length];
    const wp = loop[Math.floor(rng() * loop.length)];
    const v = makeVehicle(trafficTypes[i % trafficTypes.length], wp[0] + randRange(rng, -20, 20), wp[1] + randRange(rng, -20, 20), 0);
    v.driver = 'traffic';
    E.cars.push({ veh: v, loop, wp: Math.floor(rng() * loop.length), speed: randRange(rng, 90, 150), stuck: 0 });
  }
  // traffic boats patrolling the sea
  for (let i = 0; i < 5; i++) {
    const loop = BOAT_LOOPS[i % BOAT_LOOPS.length];
    const wp = loop[Math.floor(rng() * loop.length)];
    const v = makeVehicle(i % 2 ? 'fisher' : 'speedboat', wp[0], wp[1], 0);
    v.driver = 'traffic';
    E.boats.push({ veh: v, loop, wp: Math.floor(rng() * loop.length), speed: randRange(rng, 60, 110) });
  }
  // pedestrians
  const pedZones = [
    { x: 1150, y: 1150, w: 900, h: 600, n: 16 },
    { x: 1150, y: 2330, w: 950, h: 330, n: 12 },
    { x: 330, y: 1280, w: 480, h: 620, n: 10 },
    { x: 2380, y: 1150, w: 520, h: 700, n: 8 },
  ];
  const shirts = ['#ff7675', '#74b9ff', '#55efc4', '#fdcb6e', '#e17055', '#a29bfe', '#fd79a8', '#00b894'];
  for (const z of pedZones) {
    for (let i = 0; i < z.n; i++) {
      const x = randRange(rng, z.x + 30, z.x + z.w - 30), y = randRange(rng, z.y + 30, z.y + z.h - 30);
      if (!isLand(x, y) || onRoad(x, y, 8)) continue;
      E.peds.push({ x, y, angle: randRange(rng, 0, Math.PI * 2), speed: randRange(rng, 22, 42), tx: x, ty: y, shirt: pick(rng, shirts), skin: pick(rng, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524']), wait: randRange(rng, 0, 3) });
    }
  }
  return E;
}

export function spawnParticles(E, x, y, n, color, speed = 120, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = randRange(Math.random, speed * 0.3, speed);
    E.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: randRange(Math.random, life * 0.5, life), max: life, color, size: randRange(Math.random, 2, 5) });
  }
}

function driveVehicle(v, dt, steer, throttle, buildings, inWaterOk) {
  const t = VEHICLE_TYPES[v.type];
  const target = throttle * t.max;
  v.speed += clamp(target - v.speed, -t.accel * 1.6 * dt, t.accel * dt);
  v.angle += steer * t.grip * dt * clamp(Math.abs(v.speed) / 120, 0.25, 1) * (v.speed < 0 ? -1 : 1);
  const stepOk = (x, y) => t.boat ? (isWater(x, y) || onDock(x, y)) : (isLand(x, y) || onDock(x, y));
  let nx = v.x + Math.cos(v.angle) * v.speed * dt;
  let ny = v.y + Math.sin(v.angle) * v.speed * dt;
  if (!stepOk(nx, ny)) {
    // Deflect along the obstacle instead of beaching: try ±40° / ±80° steps.
    // (A boat hugging the curving shoreline, or a car cutting a corner, slides on.)
    let found = false;
    for (const da of [0.7, -0.7, 1.4, -1.4]) {
      const ax = v.x + Math.cos(v.angle + da) * v.speed * dt;
      const ay = v.y + Math.sin(v.angle + da) * v.speed * dt;
      if (stepOk(ax, ay)) { v.angle += da * 0.5; nx = ax; ny = ay; found = true; break; }
    }
    if (!found) { v.speed *= 0.4; nx = v.x; ny = v.y; }
  }
  v.x = nx; v.y = ny;
  const c = collideBuildings(v.x, v.y, Math.max(t.w, t.h) / 2 - 4, buildings);
  if (c.x !== v.x || c.y !== v.y) { v.x = c.x; v.y = c.y; v.speed *= 0.55; }
  v.x = clamp(v.x, 60, WORLD - 60); v.y = clamp(v.y, 60, WORLD - 60);
}

function followLoop(item, dt, buildings) {
  const v = item.veh;
  const t = VEHICLE_TYPES[v.type];
  const wp = item.loop[item.wp];
  const d = dist(v.x, v.y, wp[0], wp[1]);
  if (d < 40) { item.wp = (item.wp + 1) % item.loop.length; return; }
  const want = angleTo(v.x, v.y, wp[0], wp[1]);
  const steer = clamp(angleLerp(v.angle, want, 1) * 2, -1, 1);
  // slow down for player vehicle ahead
  driveVehicle(v, dt, steer, 0.55, buildings);
}

export function updateEntities(E, G, dt) {
  const world = G.world;
  // traffic cars
  for (const c of E.cars) {
    // avoid pileups: slow if another car close ahead
    followLoop(c, dt, world.buildings);
    // keep traffic on road-ish: if pushed off, steer back handled by loop
  }
  for (const b of E.boats) followLoop(b, dt, world.buildings);
  // pedestrians wander
  for (const p of E.peds) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    const d = dist(p.x, p.y, p.tx, p.ty);
    if (d < 12) {
      if (Math.random() < 0.4) { p.wait = randRange(Math.random, 1, 4); continue; }
      p.tx = clamp(p.x + randRange(Math.random, -160, 160), 300, 2900);
      p.ty = clamp(p.y + randRange(Math.random, -160, 160), 300, 2900);
      if (!isLand(p.tx, p.ty)) { p.tx = p.x; p.ty = p.y; }
      continue;
    }
    p.angle = angleLerp(p.angle, angleTo(p.x, p.y, p.tx, p.ty), dt * 4);
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (isLand(nx, ny) && !onRoad(nx, ny, 4)) { p.x = nx; p.y = ny; }
    else { p.tx = p.x; p.ty = p.y; }
  }
  // police: spawn to match wanted level
  const wantPolice = G.wanted >= 1 ? Math.min(2 + G.wanted, 6) : 0;
  while (E.police.length < wantPolice) {
    const a = Math.random() * Math.PI * 2;
    const px = clamp(G.player.x + Math.cos(a) * 700, 300, 2900);
    const py = clamp(G.player.y + Math.sin(a) * 700, 300, 2900);
    if (!isLand(px, py)) continue;
    const v = makeVehicle('sedan', px, py, 0, POLICE_COLOR);
    v.driver = 'police';
    E.police.push({ veh: v, siren: true });
  }
  while (E.police.length > wantPolice) E.police.pop();
  for (const p of E.police) {
    const v = p.veh;
    const d = dist(v.x, v.y, G.player.x, G.player.y);
    if (G.player.vehicle && VEHICLE_TYPES[G.player.vehicle.type].boat) { v.speed *= 0.98; continue; }
    const want = angleTo(v.x, v.y, G.player.x, G.player.y);
    const steer = clamp(angleLerp(v.angle, want, 1) * 2.2, -1, 1);
    const th = d > 90 ? 1 : 0.4;
    driveVehicle(v, dt, steer, th, world.buildings);
    // ram player vehicle / arrest on foot
    if (d < 46) {
      if (!G.player.vehicle && Math.abs(G.player.speed || 0) < 30) {
        G.arrested = true;
      } else if (G.player.vehicle) {
        G.player.vehicle.hp -= 14 * dt;
        spawnParticles(E, v.x, v.y, 2, '#ffd23f', 90, 0.3);
      }
    }
  }
  // coast guard: wanted 3+ while player at sea
  const atSea = G.player.vehicle && VEHICLE_TYPES[G.player.vehicle.type].boat;
  const wantGuard = (G.wanted >= 3 && atSea) ? Math.min(G.wanted - 1, 3) : 0;
  while (E.guard.length < wantGuard) {
    const a = Math.random() * Math.PI * 2;
    const px = clamp(G.player.x + Math.cos(a) * 650, 80, WORLD - 80);
    const py = clamp(G.player.y + Math.sin(a) * 650, 80, WORLD - 80);
    if (!isWater(px, py)) continue;
    const v = makeVehicle('speedboat', px, py, 0, COASTGUARD_COLOR);
    v.driver = 'guard';
    E.guard.push({ veh: v });
  }
  while (E.guard.length > wantGuard) E.guard.pop();
  for (const g of E.guard) {
    const v = g.veh;
    const d = dist(v.x, v.y, G.player.x, G.player.y);
    const want = angleTo(v.x, v.y, G.player.x, G.player.y);
    const steer = clamp(angleLerp(v.angle, want, 1) * 2.2, -1, 1);
    driveVehicle(v, dt, steer, d > 80 ? 1 : 0.5, world.buildings);
    if (d < 60 && G.player.vehicle) G.player.vehicle.hp -= 10 * dt;
  }
  // bullets
  for (let i = E.bullets.length - 1; i >= 0; i--) {
    const b = E.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { E.bullets.splice(i, 1); continue; }
    if (b.from === 'player') {
      for (const en of E.enemies) {
        if (en.hp > 0 && dist(b.x, b.y, en.x, en.y) < 16) { en.hp -= 34; spawnParticles(E, b.x, b.y, 6, '#ff5b4d', 140, 0.4); E.bullets.splice(i, 1); break; }
      }
      if (i >= E.bullets.length) continue;
      for (const p of E.police) {
        if (dist(b.x, b.y, p.veh.x, p.veh.y) < 24) { p.veh.hp -= 20; G.addWanted(1); spawnParticles(E, b.x, b.y, 6, '#ffd23f', 140, 0.4); E.bullets.splice(i, 1); break; }
      }
    } else {
      if (dist(b.x, b.y, G.player.x, G.player.y) < 15) {
        G.damagePlayer(9);
        E.bullets.splice(i, 1);
      }
    }
  }
  // enemies (mission guards)
  for (const en of E.enemies) {
    if (en.hp <= 0) continue;
    const d = dist(en.x, en.y, G.player.x, G.player.y);
    en.angle = angleTo(en.x, en.y, G.player.x, G.player.y);
    en.shootCd -= dt;
    if (d < 320 && d > 60) {
      en.x += Math.cos(en.angle) * 55 * dt; en.y += Math.sin(en.angle) * 55 * dt;
    }
    if (d < 340 && en.shootCd <= 0) {
      en.shootCd = randRange(Math.random, 0.9, 1.6);
      const sp = 520;
      E.bullets.push({ x: en.x + Math.cos(en.angle) * 14, y: en.y + Math.sin(en.angle) * 14, vx: Math.cos(en.angle) * sp, vy: Math.sin(en.angle) * sp, life: 1.1, from: 'enemy' });
    }
  }
  // particles
  for (let i = E.particles.length - 1; i >= 0; i--) {
    const p = E.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) E.particles.splice(i, 1);
  }
  // boat wakes
  for (const v of [...E.boats.map(b => b.veh), ...E.guard.map(g => g.veh), ...E.parked.filter(p => VEHICLE_TYPES[p.type].boat && p.driver === 'player')]) {
    if (Math.abs(v.speed) > 60 && Math.random() < 0.5) {
      E.particles.push({ x: v.x - Math.cos(v.angle) * 26, y: v.y - Math.sin(v.angle) * 26, vx: 0, vy: 0, life: 0.7, max: 0.7, color: '#cfeeff', size: 4 });
    }
  }
}

export function drawVehicle(ctx, v) {
  const t = VEHICLE_TYPES[v.type];
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-t.w / 2 + 3, -t.h / 2 + 4, t.w, t.h);
  if (t.boat) {
    // hull
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.moveTo(t.w / 2, 0); ctx.lineTo(t.w / 4, -t.h / 2); ctx.lineTo(-t.w / 2, -t.h / 2 + 2);
    ctx.lineTo(-t.w / 2, t.h / 2 - 2); ctx.lineTo(t.w / 4, t.h / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-t.w / 6, -t.h / 4, t.w / 3, t.h / 2);
    ctx.fillStyle = '#123';
    ctx.fillRect(t.w / 2 - 8, -3, 8, 6);
    if (v.driver === 'guard') { ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('CG', -6, 3); }
  } else {
    ctx.fillStyle = v.color;
    const r = 5;
    ctx.beginPath();
    ctx.roundRect(-t.w / 2, -t.h / 2, t.w, t.h, r); ctx.fill();
    // cabin / windshield
    ctx.fillStyle = 'rgba(20,40,60,0.85)';
    if (v.type === 'bike') { ctx.fillRect(-2, -3, 8, 6); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-t.w / 2 + 3, 0, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(t.w / 2 - 3, 0, 4, 0, 7); ctx.fill(); }
    else { ctx.fillRect(-t.w / 6, -t.h / 2 + 3, t.w / 3, t.h - 6); }
    // headlights
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(t.w / 2 - 2, -t.h / 2 + 2, 2, 4); ctx.fillRect(t.w / 2 - 2, t.h / 2 - 6, 2, 4);
    if (v.driver === 'police') {
      ctx.fillStyle = '#fff'; ctx.fillRect(-t.w / 4, -t.h / 2, t.w / 2, t.h);
      ctx.fillStyle = '#111'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('POLISI', 0, 3); ctx.textAlign = 'left';
      ctx.fillStyle = '#ff2222'; ctx.fillRect(-4, -t.h / 2 - 2, 4, 4);
      ctx.fillStyle = '#2266ff'; ctx.fillRect(0, -t.h / 2 - 2, 4, 4);
    }
  }
  ctx.restore();
}

export function drawPerson(ctx, x, y, angle, shirt, skin, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 3, 9, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(6, 0, 6, 0, 7); ctx.fill();
  if (opts.gun) { ctx.fillStyle = '#222'; ctx.fillRect(6, -2, 12, 3); }
  if (opts.hat) { ctx.fillStyle = '#f5d76e'; ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.fill(); }
  ctx.restore();
}
