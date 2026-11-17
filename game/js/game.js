// Isla Verde — open-world crime game. Main loop, input, player, wanted, save, staging.
// Vanilla JS, no libraries, no network. All art drawn on canvas, all sound synthesized.
import { WORLD, CX, CY, RX, RY, superellipsePath, buildWorld, isLand, isWater, onRoad, onDock, collideBuildings, ZONES, ROADS, DOCKS, SHOPS } from './world.js';
import { VEHICLE_TYPES, makeVehicle, createEntities, updateEntities, drawVehicle, drawPerson, spawnParticles, POLICE_COLOR } from './entities.js';
import { MISSIONS, MissionManager } from './missions.js';
import { Weather } from './weather.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { clamp, dist, angleTo, angleLerp, mulberry32 } from './rng.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const SAVE_KEY = 'islaverde-save-v1';

export const G = {
  state: 'menu', // menu | playing | paused | arrested | wasted
  world: null, entities: null, missions: new MissionManager(),
  weather: new Weather(), audio: new AudioEngine(), hud: new Hud(),
  player: null, wanted: 0, lastCrimeT: 0, time: 0,
  keys: {}, mouse: { x: 640, y: 400, down: false },
  cam: { x: 1600, y: 1600 },
  interactLabel: null, interactAction: null,
  shootCd: 0, punchCd: 0, saveT: 0,
  vehicleLib: { makeVehicle },
  missionById: (id) => MISSIONS.find(m => m.id === id),
};

function newPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: 100, money: 250, ammo: 24,
    weapon: 'pistol', vehicle: null, speed: 0, walkPhase: 0,
    shirt: '#2ecc71', skin: '#e0ac69',
  };
}

G.addWanted = function (n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.lastCrimeT = G.time;
};
G.setWanted = function (n) { G.wanted = clamp(n, 0, 5); G.lastCrimeT = G.time; };
G.forceStorm = function (s) { G.weather.forceStorm(s); };
G.spawnSparks = function (x, y) { spawnParticles(G.entities, x, y, 8, '#ffd23f', 200, 0.5); };
G.damagePlayer = function (n) {
  if (G.state !== 'playing') return;
  G.player.hp -= n;
  spawnParticles(G.entities, G.player.x, G.player.y, 5, '#ff5b4d', 120, 0.4);
  if (G.player.hp <= 0) {
    G.player.hp = 0;
    G.state = 'wasted';
    $('wasted').classList.remove('hidden');
    G.audio.setSiren(false);
  }
};
G.saveGame = function () {
  try {
    const save = {
      money: G.player.money, hp: G.player.hp, x: G.player.x, y: G.player.y,
      ammo: G.player.ammo, hour: G.weather.hour,
      done: [...G.missions.done],
      chests: G.world.chests.map(c => c.found),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (e) { return false; }
};
G.loadGame = function () {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
};
G.applySave = function (s) {
  G.player.money = s.money; G.player.hp = s.hp;
  G.player.x = s.x; G.player.y = s.y;
  G.player.ammo = s.ammo; G.weather.hour = s.hour;
  G.missions.done = new Set(s.done || []);
  (s.chests || []).forEach((f, i) => { if (G.world.chests[i]) G.world.chests[i].found = f; });
};

function initWorld() {
  G.world = buildWorld();
  G.entities = createEntities(G.world);
  G.player = newPlayer(1500, 2440);
  G.wanted = 0;
}

// ---------- input ----------
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run' };
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { G.keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return;
  G.audio.init();
  if (e.code === 'KeyE') doInteract();
  if (e.code === 'Space') { doPunch(); e.preventDefault(); }
  if (e.code === 'KeyR' && G.state === 'playing') { G.hud.toast('Radio: ' + G.audio.nextStation()); }
  if (e.code === 'KeyH' && G.player.vehicle) G.audio.horn();
  if (e.code === 'KeyM' && G.state === 'playing') $('bigmap').classList.toggle('hidden');
  if (e.code === 'Escape') {
    if (!$('bigmap').classList.contains('hidden')) { $('bigmap').classList.add('hidden'); return; }
    if (G.state === 'playing') pauseGame(true);
    else if (G.state === 'paused') pauseGame(false);
  }
  if (e.code === 'Enter' && (G.state === 'arrested' || G.state === 'wasted')) respawnAfterBust();
  if (e.code === 'Enter' && G.state === 'playing' && G.missions.dialog) G.missions.advanceDialog();
});
window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) G.keys[KEYMAP[e.code]] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  G.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  G.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', (e) => {
  G.audio.init();
  G.mouse.down = true;
  if (G.state === 'playing') doShoot();
});
window.addEventListener('mouseup', () => { G.mouse.down = false; });
window.addEventListener('error', (e) => { window.__gameError = String(e.message || e.error); });

// ---------- player actions ----------
function nearestVehicle(maxD) {
  let best = null, bd = maxD;
  const all = [...G.entities.parked, ...G.entities.cars.map(c => c.veh), ...G.entities.boats.map(b => b.veh)];
  for (const v of all) {
    if (v.hp <= 0) continue;
    const d = dist(G.player.x, G.player.y, v.x, v.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function computeInteract() {
  const p = G.player;
  if (p.vehicle || G.missions.dialog) { G.interactLabel = null; G.interactAction = null; return; }
  // mission start points first
  for (const sp of G.missions.startPoints()) {
    const m = G.missionById(sp.mission);
    if (!m || G.missions.done.has(sp.mission) || (G.missions.active && G.missions.active.id === sp.mission)) continue;
    if (dist(p.x, p.y, sp.x, sp.y) < 90) {
      G.interactLabel = 'E — Mulai Misi ' + m.id + ': ' + m.title;
      G.interactAction = () => { G.missions.startMission(m, G); };
      return;
    }
  }
  for (const c of G.world.chests) {
    if (!c.found && dist(p.x, p.y, c.x, c.y) < 55) {
      G.interactLabel = 'E — Buka peti harta karun';
      G.interactAction = () => {
        c.found = true; p.money += c.value;
        G.hud.toast('Peti harta! +$' + c.value);
        G.audio.pickup();
        spawnParticles(G.entities, c.x, c.y, 16, '#ffd23f', 160, 0.8);
        G.saveGame();
      };
      return;
    }
  }
  const v = nearestVehicle(70);
  if (v) {
    const stolen = v.driver === 'traffic';
    G.interactLabel = 'E — ' + (stolen ? 'Curi ' : 'Naik ') + VEHICLE_TYPES[v.type].name;
    G.interactAction = () => enterVehicle(v, stolen);
    return;
  }
  for (const s of SHOPS) {
    if (dist(p.x, p.y, s.x, s.y) < 80) {
      if (s.kind === 'gun') {
        G.interactLabel = 'E — Beli peluru $50 (24 butir)';
        G.interactAction = () => {
          if (p.money >= 50) { p.money -= 50; p.ammo += 24; G.hud.toast('Peluru +24'); G.audio.pickup(); }
          else G.hud.toast('Uang tidak cukup!');
        };
      } else if (s.kind === 'clinic') {
        G.interactLabel = 'E — Berobat $100 (HP penuh)';
        G.interactAction = () => {
          if (p.money >= 100) { p.money -= 100; p.hp = 100; G.hud.toast('HP pulih penuh'); G.audio.pickup(); }
          else G.hud.toast('Uang tidak cukup!');
        };
      } else {
        G.interactLabel = 'E — Minum jus kelapa $20 (+15 HP)';
        G.interactAction = () => {
          if (p.money >= 20) { p.money -= 20; p.hp = Math.min(100, p.hp + 15); G.hud.toast('Segar! HP +15'); G.audio.pickup(); }
          else G.hud.toast('Uang tidak cukup!');
        };
      }
      return;
    }
  }
  G.interactLabel = null; G.interactAction = null;
}
function doInteract() {
  if (G.state !== 'playing') return;
  if (G.missions.dialog) { G.missions.advanceDialog(); return; }
  if (G.player.vehicle) { exitVehicle(); return; }
  computeInteract();
  if (G.interactAction) G.interactAction();
}
function enterVehicle(v, stolen) {
  const p = G.player;
  if (stolen) {
    G.addWanted(1);
    G.hud.toast('Kendaraan dicuri! Polisi waspada.');
    spawnParticles(G.entities, v.x, v.y, 8, '#ff5b4d', 120, 0.5);
  }
  v.driver = 'player';
  p.vehicle = v;
  p.angle = v.angle;
  // remove from traffic lists so it stops following loops
  G.entities.cars = G.entities.cars.filter(c => c.veh !== v);
  G.entities.boats = G.entities.boats.filter(b => b.veh !== v);
  G.audio.horn();
}
function exitVehicle() {
  const p = G.player, v = p.vehicle;
  v.speed = 0; v.driver = 'none';
  const sx = v.x - Math.sin(v.angle) * 40, sy = v.y + Math.cos(v.angle) * 40;
  p.x = isLand(sx, sy) || onDock(sx, sy) ? sx : v.x + Math.sin(v.angle) * 40;
  p.y = isLand(sx, sy) || onDock(sx, sy) ? sy : v.y - Math.cos(v.angle) * 40;
  if (isWater(p.x, p.y) && !onDock(p.x, p.y)) { p.x = v.x; p.y = v.y; }
  p.vehicle = null;
  // re-park it so it stays in the world
  if (!G.entities.parked.includes(v)) G.entities.parked.push(v);
}
function doShoot() {
  const p = G.player;
  if (G.state !== 'playing' || G.shootCd > 0 || p.weapon !== 'pistol') return;
  if (p.ammo <= 0) { G.hud.toast('Peluru habis! Beli di Toko Senjata Roko.'); return; }
  p.ammo--; G.shootCd = 0.25;
  const wx = G.cam.x - 640 + G.mouse.x, wy = G.cam.y - 400 + G.mouse.y;
  const a = angleTo(p.x, p.y, wx, wy);
  const sp = 720;
  G.entities.bullets.push({ x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9, from: 'player' });
  G.audio.shoot();
  spawnParticles(G.entities, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, 3, '#ffe9a8', 90, 0.2);
}
function doPunch() {
  const p = G.player;
  if (G.state !== 'playing' || p.vehicle || G.punchCd > 0) return;
  G.punchCd = 0.4;
  G.audio.punch();
  const range = 38;
  const hit = (x, y) => dist(p.x, p.y, x, y) < range && Math.abs(angleLerp(p.angle, angleTo(p.x, p.y, x, y), 1)) < 1.2;
  for (const en of G.entities.enemies) {
    if (en.hp > 0 && hit(en.x, en.y)) { en.hp -= 25; spawnParticles(G.entities, en.x, en.y, 6, '#ff5b4d', 140, 0.4); }
  }
  for (const ped of G.entities.peds) {
    if (hit(ped.x, ped.y)) {
      G.addWanted(1);
      ped.tx = ped.x + (ped.x - p.x) * 3; ped.ty = ped.y + (ped.y - p.y) * 3;
      spawnParticles(G.entities, ped.x, ped.y, 5, '#ff7675', 120, 0.4);
      G.hud.toast('Kau memukul pejalan kaki! Buronan naik.');
    }
  }
  for (const pol of G.entities.police) {
    if (hit(pol.veh.x, pol.veh.y)) { pol.veh.hp -= 15; G.addWanted(1); }
  }
}
function respawnAfterBust() {
  const p = G.player;
  if (G.state === 'arrested') {
    p.money = Math.max(0, p.money - 300);
    p.x = 1600; p.y = 1450;
    G.hud.toast('Kau dibebaskan. Denda $300.');
  } else {
    p.money = Math.max(0, p.money - 200);
    p.x = 1930; p.y = 1590;
    G.hud.toast('Kau dirawat di Klinik Pantai. Biaya $200.');
  }
  p.hp = 100; p.vehicle = null;
  G.wanted = 0;
  G.entities.police.length = 0; G.entities.guard.length = 0;
  $('arrest').classList.add('hidden');
  $('wasted').classList.add('hidden');
  G.state = 'playing';
}

// ---------- update ----------
function updatePlayer(dt) {
  const p = G.player;
  G.shootCd = Math.max(0, G.shootCd - dt);
  G.punchCd = Math.max(0, G.punchCd - dt);
  if (G.missions.dialog) return; // frozen during dialogue
  const k = G.keys;
  if (p.vehicle) {
    const v = p.vehicle;
    const t = VEHICLE_TYPES[v.type];
    const steer = (k.left ? -1 : 0) + (k.right ? 1 : 0);
    const throttle = (k.up ? 1 : 0) + (k.down ? -0.6 : 0);
    const target = throttle * t.max;
    v.speed += clamp(target - v.speed, -t.accel * 1.8 * dt, t.accel * dt);
    v.angle += steer * t.grip * dt * clamp(Math.abs(v.speed) / 130, 0.25, 1) * (v.speed < 0 ? -1 : 1);
    const nx = v.x + Math.cos(v.angle) * v.speed * dt;
    const ny = v.y + Math.sin(v.angle) * v.speed * dt;
    const stepOk = (x, y) => t.boat ? (isWater(x, y) || onDock(x, y)) : (isLand(x, y) || onDock(x, y));
    let moved = false;
    if (stepOk(nx, ny)) { v.x = nx; v.y = ny; moved = true; }
    else {
      // deflect along the shoreline / obstacle instead of stopping dead
      for (const da of [0.7, -0.7, 1.4, -1.4]) {
        const ax = v.x + Math.cos(v.angle + da) * v.speed * dt;
        const ay = v.y + Math.sin(v.angle + da) * v.speed * dt;
        if (stepOk(ax, ay)) { v.angle += da * 0.5; v.x = ax; v.y = ay; moved = true; break; }
      }
      if (!moved) v.speed *= 0.45;
    }
    const c = collideBuildings(v.x, v.y, Math.max(t.w, t.h) / 2 - 4, G.world.buildings);
    if (c.x !== v.x || c.y !== v.y) { v.x = c.x; v.y = c.y; v.speed *= 0.55; spawnParticles(G.entities, v.x, v.y, 2, '#aaa', 60, 0.3); }
    v.x = clamp(v.x, 70, WORLD - 70); v.y = clamp(v.y, 70, WORLD - 70);
    p.x = v.x; p.y = v.y; p.angle = v.angle; p.speed = v.speed;
    G.audio.setEngine(Math.abs(v.speed) / t.max, true);
    if (Math.abs(v.speed) > 60 && t.boat && Math.random() < 0.6) {
      G.entities.particles.push({ x: v.x - Math.cos(v.angle) * 28, y: v.y - Math.sin(v.angle) * 28, vx: 0, vy: 0, life: 0.8, max: 0.8, color: '#dff3ff', size: 5 });
    }
    // wrecked?
    if (v.hp <= 0) {
      spawnParticles(G.entities, v.x, v.y, 40, '#ff6b35', 260, 1.0);
      spawnParticles(G.entities, v.x, v.y, 20, '#333', 120, 1.2);
      G.entities.parked = G.entities.parked.filter(x => x !== v);
      p.vehicle = null;
      p.x = v.x + 40; p.y = v.y;
      G.hud.toast('Kendaraanmu hancur!');
      G.audio.setEngine(0, false);
    }
  } else {
    G.audio.setEngine(0, false);
    let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my); mx /= len; my /= len;
      const sp = k.run ? 265 : 165;
      const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
      if ((isLand(nx, p.y) || onDock(nx, p.y)) && !onRoad(nx, p.y, 0) || isLand(nx, p.y) || onDock(nx, p.y)) {
        // allow walking on roads and land; block water
        if (isLand(nx, p.y) || onDock(nx, p.y)) p.x = nx;
      }
      if (isLand(p.x, ny) || onDock(p.x, ny)) p.y = ny;
      const c = collideBuildings(p.x, p.y, 12, G.world.buildings);
      p.x = c.x; p.y = c.y;
      p.angle = angleLerp(p.angle, Math.atan2(my, mx), dt * 10);
      p.walkPhase += dt * sp * 0.06;
      p.speed = sp;
    } else p.speed = 0;
    p.x = clamp(p.x, 70, WORLD - 70); p.y = clamp(p.y, 70, WORLD - 70);
  }
  // wanted decay: quiet for 8s and no police near -> -1
  if (G.wanted > 0 && G.time - G.lastCrimeT > 8) {
    const near = G.entities.police.some(pol => dist(pol.veh.x, pol.veh.y, p.x, p.y) < 450);
    if (!near) { G.wanted--; G.lastCrimeT = G.time; }
  }
  // slow health regen
  if (p.hp > 0 && p.hp < 100) p.hp = Math.min(100, p.hp + 1.2 * dt);
  computeInteract();
}

function update(dt) {
  G.time += dt;
  G.weather.update(dt, G.audio);
  if (G.state === 'playing') {
    updatePlayer(dt);
    updateEntities(G.entities, G, dt);
    G.missions.update(G, dt);
    // siren when police near
    const siren = G.entities.police.some(pol => dist(pol.veh.x, pol.veh.y, G.player.x, G.player.y) < 700) || G.entities.guard.length > 0;
    G.audio.setSiren(siren);
    // vehicle collisions with traffic: bump
    if (G.player.vehicle) {
      for (const c of G.entities.cars) {
        if (dist(c.veh.x, c.veh.y, G.player.x, G.player.y) < 48) {
          c.veh.speed *= 0.7; G.player.vehicle.speed *= 0.85;
        }
      }
    }
  }
  // camera follows player (allowed slightly past the world edge: it is all ocean)
  const tx = clamp(G.player.x, 440, WORLD - 440);
  const ty = clamp(G.player.y, 200, WORLD - 200);
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
  if (G.state === 'playing') G.hud.update(G);
}

// ---------- render ----------
function drawGround() {
  const cam = G.cam;
  const vx0 = cam.x - 640, vy0 = cam.y - 400, vx1 = cam.x + 640, vy1 = cam.y + 400;
  // ocean
  ctx.fillStyle = '#0a4a6e';
  ctx.fillRect(0, 0, 1280, 800);
  // animated wave streaks on water
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  const t = G.time;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + t * 0.05;
    const r = 1560 + Math.sin(t * 0.7 + i * 1.7) * 26;
    const x = CX + Math.cos(a) * r * (1480 / 1500), y = CY + Math.sin(a) * r * (1420 / 1500);
    const sx = x - vx0, sy = y - vy0;
    if (sx < -60 || sx > 1340 || sy < -60 || sy > 860) continue;
    ctx.beginPath();
    ctx.arc(sx, sy, 14 + (i % 3) * 4, a, a + 1.1);
    ctx.stroke();
  }
  // island land mass (superellipse clip — matches the island's true shape)
  ctx.save();
  superellipsePath(ctx, CX - vx0, CY - vy0, RX, RY);
  ctx.clip();
  // grass base with subtle checker variation
  ctx.fillStyle = '#69a854';
  ctx.fillRect(CX - vx0 - RX, CY - vy0 - RY, RX * 2, RY * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  const gs = 160;
  for (let gx = Math.floor(vx0 / gs) * gs; gx < vx1; gx += gs) {
    for (let gy = Math.floor(vy0 / gs) * gs; gy < vy1; gy += gs) {
      if (((gx / gs + gy / gs) % 2 + 2) % 2 === 0) ctx.fillRect(gx - vx0, gy - vy0, gs, gs);
    }
  }
  // beach ring (drawn as thick superellipse stroke inside clip)
  ctx.strokeStyle = '#e8d8a0';
  ctx.lineWidth = 64;
  superellipsePath(ctx, CX - vx0, CY - vy0, RX - 8, RY - 8);
  ctx.stroke();
  // jungle
  ctx.fillStyle = '#2e6b2f';
  ctx.fillRect(900 - vx0, 480 - vy0, 1400, 560);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 40; i++) {
    const jx = 920 + ((i * 173) % 1360), jy = 500 + ((i * 97) % 520);
    ctx.beginPath(); ctx.arc(jx - vx0, jy - vy0, 26 + (i % 4) * 8, 0, 7); ctx.fill();
  }
  // zone ground tints
  ctx.fillStyle = '#b8a88a'; ctx.fillRect(1150 - vx0, 1150 - vy0, 900, 600);
  ctx.fillStyle = '#d8c49a'; ctx.fillRect(1150 - vx0, 2330 - vy0, 950, 330);
  ctx.fillStyle = '#9a9a92'; ctx.fillRect(2380 - vx0, 1150 - vy0, 520, 700);
  ctx.fillStyle = '#c9b489'; ctx.fillRect(330 - vx0, 1280 - vy0, 480, 620);
  // roads
  for (const r of ROADS) {
    if (r.x > vx1 || r.x + r.w < vx0 || r.y > vy1 || r.y + r.h < vy0) continue;
    ctx.fillStyle = r.dirt ? '#8a6b3f' : '#4a4a4a';
    ctx.fillRect(r.x - vx0, r.y - vy0, r.w, r.h);
    if (!r.dirt) {
      ctx.strokeStyle = '#e8d44d';
      ctx.lineWidth = 2;
      ctx.setLineDash([18, 16]);
      ctx.beginPath();
      if (r.w > r.h) { ctx.moveTo(r.x - vx0, r.y + r.h / 2 - vy0); ctx.lineTo(r.x + r.w - vx0, r.y + r.h / 2 - vy0); }
      else { ctx.moveTo(r.x + r.w / 2 - vx0, r.y - vy0); ctx.lineTo(r.x + r.w / 2 - vx0, r.y + r.h - vy0); }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // docks
  for (const d of DOCKS) {
    ctx.strokeStyle = '#7a5a33';
    ctx.lineWidth = d.w;
    ctx.beginPath();
    ctx.moveTo(d.x - vx0, d.y - vy0);
    ctx.lineTo(d.x + Math.cos(d.angle) * d.len - vx0, d.y + Math.sin(d.angle) * d.len - vy0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < d.len; i += 22) {
      const px = d.x + Math.cos(d.angle) * i - vx0, py = d.y + Math.sin(d.angle) * i - vy0;
      ctx.beginPath(); ctx.moveTo(px - Math.sin(d.angle) * d.w / 2, py + Math.cos(d.angle) * d.w / 2);
      ctx.lineTo(px + Math.sin(d.angle) * d.w / 2, py - Math.cos(d.angle) * d.w / 2); ctx.stroke();
    }
  }
  // lighthouse
  ctx.fillStyle = '#fff';
  ctx.fillRect(1590 - vx0, 190 - vy0, 20, 60);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(1590 - vx0, 190 - vy0, 20, 14);
  ctx.fillRect(1590 - vx0, 222 - vy0, 20, 14);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(1600 - vx0, 184 - vy0, 8, 0, 7); ctx.fill();
  ctx.restore();
  // buildings (outside clip so shadows fall on beach too)
  for (const b of G.world.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    const bx = b.x - vx0, by = b.y - vy0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(bx + 6, by + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(bx + 4, by + 4, b.w - 8, Math.min(16, b.h / 3));
    ctx.fillStyle = 'rgba(20,40,60,0.8)';
    const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillRect(bx + 8 + i * 32, by + 22 + j * 30, 12, 14);
    }
  }
  // palms
  for (const pm of G.world.palms) {
    if (pm.x < vx0 - 30 || pm.x > vx1 + 30 || pm.y < vy0 - 30 || pm.y > vy1 + 30) continue;
    const px = pm.x - vx0, py = pm.y - vy0;
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pm.lean * 22, py - 20 * pm.s); ctx.stroke();
    ctx.strokeStyle = '#2f7d32';
    ctx.lineWidth = 3;
    const tx = px + pm.lean * 22, ty = py - 20 * pm.s;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + G.time * 0.1 + pm.lean;
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * 12, ty + Math.sin(a) * 12 - 4, tx + Math.cos(a) * 20, ty + Math.sin(a) * 20 + 6);
      ctx.stroke();
    }
  }
  // treasure chests
  for (const c of G.world.chests) {
    if (c.found) continue;
    if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
    const cxp = c.x - vx0, cyp = c.y - vy0;
    ctx.fillStyle = 'rgba(255,210,63,0.25)';
    ctx.beginPath(); ctx.arc(cxp, cyp, 18 + Math.sin(G.time * 3) * 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(cxp - 11, cyp - 8, 22, 16);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(cxp - 11, cyp - 8, 22, 5);
    ctx.fillRect(cxp - 2, cyp - 4, 4, 8);
  }
  // shops markers
  for (const s of SHOPS) {
    if (s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1) continue;
    ctx.fillStyle = s.kind === 'gun' ? '#ff6b6b' : s.kind === 'clinic' ? '#7dff9a' : '#ffd23f';
    ctx.beginPath(); ctx.arc(s.x - vx0, s.y - vy0, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(s.kind === 'gun' ? '$' : s.kind === 'clinic' ? '+' : '♪', s.x - vx0, s.y - vy0 + 4);
    ctx.textAlign = 'left';
  }
}

function drawEntities() {
  const cam = G.cam;
  const vx0 = cam.x - 640, vy0 = cam.y - 400;
  ctx.save();
  ctx.translate(-vx0, -vy0);
  // mission start markers
  for (const sp of G.missions.startPoints()) {
    const m = G.missionById(sp.mission);
    if (!m || G.missions.done.has(sp.mission) || (G.missions.active && G.missions.active.id === sp.mission)) continue;
    const bob = Math.sin(G.time * 3) * 4;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(sp.x, sp.y - 26 + bob); ctx.lineTo(sp.x - 9, sp.y - 44 + bob); ctx.lineTo(sp.x + 9, sp.y - 44 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', sp.x, sp.y - 32 + bob);
    ctx.textAlign = 'left';
  }
  // parked vehicles + traffic + boats
  for (const v of G.entities.parked) drawVehicle(ctx, v);
  for (const c of G.entities.cars) drawVehicle(ctx, c.veh);
  for (const b of G.entities.boats) drawVehicle(ctx, b.veh);
  for (const p of G.entities.police) drawVehicle(ctx, p.veh);
  for (const g of G.entities.guard) drawVehicle(ctx, g.veh);
  if (G.missions.chaseBoat) {
    drawVehicle(ctx, G.missions.chaseBoat.veh);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(G.missions.chaseBoat.veh.x - 30, G.missions.chaseBoat.veh.y - 42, 60, 7);
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(G.missions.chaseBoat.veh.x - 30, G.missions.chaseBoat.veh.y - 42, 60 * Math.max(0, G.missions.chaseBoat.hp / 100), 7);
  }
  // pedestrians
  for (const p of G.entities.peds) drawPerson(ctx, p.x, p.y, p.angle, p.shirt, p.skin);
  // escort tourist
  if (G.missions.escort) {
    const e = G.missions.escort;
    drawPerson(ctx, e.x, e.y, e.angle || 0, '#ffffff', '#f1c27d', { hat: true });
  }
  // enemies
  for (const en of G.entities.enemies) {
    if (en.hp <= 0) continue;
    drawPerson(ctx, en.x, en.y, en.angle, '#3d3d3d', '#c68642', { gun: true });
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(en.x - 16, en.y - 24, 32, 5);
    ctx.fillStyle = '#ff5b4d';
    ctx.fillRect(en.x - 16, en.y - 24, 32 * (en.hp / 100), 5);
  }
  // player
  const pl = G.player;
  if (!pl.vehicle) {
    const bob = Math.abs(pl.speed || 0) > 10 ? Math.sin(pl.walkPhase) * 2 : 0;
    drawPerson(ctx, pl.x, pl.y + bob, pl.angle, pl.shirt, pl.skin, { gun: pl.weapon === 'pistol' });
  } else drawVehicle(ctx, pl.vehicle);
  // bullets
  ctx.fillStyle = '#ffe9a8';
  for (const b of G.entities.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill();
  }
  // particles
  for (const pt of G.entities.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // objective beacon
  const m = G.missions;
  if (m.active && m.stage && !m.dialog) {
    const st = m.stage;
    const tx = st.type === 'chase' && m.chaseBoat ? m.chaseBoat.veh.x : st.x;
    const ty = st.type === 'chase' && m.chaseBoat ? m.chaseBoat.veh.y : st.y;
    ctx.strokeStyle = 'rgba(255,71,87,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tx, ty, 26 + Math.sin(G.time * 4) * 5, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,63,0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(tx, ty - 120); ctx.lineTo(tx, ty + 40); ctx.stroke();
  }
  ctx.restore();
  // off-screen objective arrow
  if (m.active && m.stage && !m.dialog) {
    const st = m.stage;
    const tx = st.type === 'chase' && m.chaseBoat ? m.chaseBoat.veh.x : st.x;
    const ty = st.type === 'chase' && m.chaseBoat ? m.chaseBoat.veh.y : st.y;
    const sx = tx - (G.cam.x - 640), sy = ty - (G.cam.y - 400);
    if (sx < 60 || sx > 1220 || sy < 60 || sy > 740) {
      const cxp = clamp(sx, 70, 1210), cyp = clamp(sy, 70, 730);
      const a = Math.atan2(sy - 400, sx - 640);
      ctx.save();
      ctx.translate(cxp, cyp); ctx.rotate(a);
      ctx.fillStyle = '#ff4757';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(dist(G.player.x, G.player.y, tx, ty)) + ' m', cxp, cyp + 30);
      ctx.textAlign = 'left';
    }
  }
}

function render() {
  drawGround();
  drawEntities();
  // day/night + storm tint
  const tint = G.weather.tint();
  ctx.fillStyle = tint.color;
  ctx.fillRect(0, 0, 1280, 800);
  if (tint.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,220,' + (tint.flash * 0.35).toFixed(3) + ')';
    ctx.fillRect(0, 0, 1280, 800);
  }
  // rain
  if (G.weather.storm > 0) {
    ctx.strokeStyle = 'rgba(180,210,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const r of G.weather.rain) {
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - G.weather.wind * 8, r.y + 16);
    }
    ctx.stroke();
  }
}

// ---------- menu / pause ----------
function showMenu() {
  G.state = 'menu';
  $('start-screen').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  const s = G.loadGame();
  $('btn-continue').style.display = s ? '' : 'none';
  $('save-line').textContent = s
    ? 'Save ditemukan: $' + s.money + ' · ' + (s.done || []).length + '/6 misi selesai · ' + (s.chests || []).filter(Boolean).length + '/20 peti'
    : 'Belum ada save. Mulai petualanganmu di Isla Verde!';
}
function startGame(fresh) {
  if (fresh) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    initWorld();
  } else {
    const s = G.loadGame();
    initWorld();
    if (s) G.applySave(s);
  }
  $('start-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('pause-screen').classList.add('hidden');
  G.state = 'playing';
  G.cam.x = G.player.x; G.cam.y = G.player.y;
  G.hud.toast(fresh ? 'Selamat datang di Isla Verde!' : 'Selamat datang kembali, kurir!');
}
function pauseGame(on) {
  if (on) {
    G.state = 'paused';
    $('pause-screen').classList.remove('hidden');
  } else {
    G.state = 'playing';
    $('pause-screen').classList.add('hidden');
  }
}
$('btn-new').addEventListener('click', () => { G.audio.init(); startGame(true); });
$('btn-continue').addEventListener('click', () => { G.audio.init(); startGame(false); });
$('btn-how').addEventListener('click', () => { $('howto').classList.toggle('hidden'); });
$('btn-resume').addEventListener('click', () => pauseGame(false));
$('btn-save').addEventListener('click', () => {
  const ok = G.saveGame();
  $('pause-save-line').textContent = ok ? 'Game tersimpan! ($' + G.player.money + ', ' + G.missions.done.size + '/6 misi)' : 'Gagal menyimpan.';
});
$('btn-quit').addEventListener('click', () => { G.saveGame(); $('pause-screen').classList.add('hidden'); showMenu(); });

// ---------- deterministic screenshot staging (?shot=) ----------
function stageShot(shot) {
  initWorld();
  $('start-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  G.state = 'playing';
  const p = G.player;
  if (shot === 'start') {
    // menu over a live beach scene
    showMenu();
    G.cam.x = 1600; G.cam.y = 2450;
    return;
  }
  if (shot === 'play') {
    // driving a sedan down the coastal road at the beach, daytime
    const v = makeVehicle('sedan', 700, 403, 0, '#e74c3c');
    v.driver = 'player'; v.speed = 210;
    G.entities.parked.push(v);
    p.vehicle = v; p.x = v.x; p.y = v.y; p.angle = 0;
    G.keys.up = true; // keep driving during the staged shot
    G.weather.hour = 10.5;
    G.cam.x = p.x; G.cam.y = p.y;
    return;
  }
  if (shot === 'chase') {
    // wanted 3: speedboat escape at the port, coast guard + police, dusk storm
    const v = makeVehicle('speedboat', 3140, 1560, -Math.PI / 2, '#48dbfb');
    v.driver = 'player'; v.speed = 240;
    G.entities.parked.push(v);
    p.vehicle = v; p.x = v.x; p.y = v.y; p.angle = -Math.PI / 2;
    G.keys.up = true; // keep sailing during the staged shot
    G.setWanted(3);
    G.weather.hour = 17.6;
    G.weather.storm = 40;
    const gvAhead = makeVehicle('speedboat', 3160, 1050, Math.PI / 2, '#ff7f2a');
    gvAhead.driver = 'guard';
    G.entities.guard.push({ veh: gvAhead });
    for (let i = 0; i < 2; i++) {
      const gv = makeVehicle('speedboat', 3170 - i * 60, 1660 - i * 40, -Math.PI / 2, '#ff7f2a');
      gv.driver = 'guard';
      G.entities.guard.push({ veh: gv });
    }
    for (let i = 0; i < 2; i++) {
      const pv = makeVehicle('sedan', 2747, 1250 + i * 230, 0, '#1b2a4a');
      pv.driver = 'police';
      G.entities.police.push({ veh: pv, siren: true });
    }
    G.cam.x = p.x; G.cam.y = p.y;
    return;
  }
  if (shot === 'mission') {
    // mission 2 in progress: pickup near the port warehouse, dialogue open
    const v = makeVehicle('pickup', 2500, 1250, Math.PI / 2, '#27ae60');
    v.driver = 'player'; v.speed = 0;
    G.entities.parked.push(v);
    p.vehicle = v; p.x = v.x; p.y = v.y; p.angle = Math.PI / 2;
    p.money = 1250;
    const m = G.missionById(2);
    G.missions.done.add(1);
    G.missions.startMission(m, G);
    G.weather.hour = 13.0;
    G.cam.x = p.x; G.cam.y = p.y;
    return;
  }
}

// ---------- boot ----------
initWorld();
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(shot);
} else {
  showMenu();
  G.cam.x = 1600; G.cam.y = 2450;
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__islaVerde = G;
