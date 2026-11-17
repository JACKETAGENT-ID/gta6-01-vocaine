// Isla Verde — HUD (cash, health, wanted stars, objective, radio, speed)
// and the minimap + big map, drawn from the live world state.
import { WORLD, ZONES, ROADS, DOCKS, isWater } from './world.js';
import { VEHICLE_TYPES } from './entities.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.map = $('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.bigmap = $('bigmap-canvas');
    this.bigCtx = this.bigmap.getContext('2d');
    this.toastT = null;
    this.lastCash = -1;
  }
  toast(text, ms = 2600) {
    const el = $('toast');
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { el.style.opacity = '0'; }, ms);
  }
  update(G) {
    const p = G.player;
    if (p.money !== this.lastCash) { $('cash').textContent = '$' + p.money.toLocaleString('en-US'); this.lastCash = p.money; }
    $('health-fill').style.width = Math.max(0, p.hp) + '%';
    $('health-text').textContent = Math.max(0, Math.round(p.hp));
    $('ammo').textContent = p.weapon === 'pistol'
      ? 'Pistol — ' + p.ammo + ' peluru' + (p.ammo === 0 ? ' (beli di Toko Senjata)' : '')
      : 'Tangan kosong — pukul dengan Spasi';
    $('time-label').textContent = G.weather.label();
    let stars = '';
    for (let i = 0; i < 5; i++) stars += '<span class="' + (i < G.wanted ? 'star-on' : 'star-off') + '">★</span>';
    $('wanted').innerHTML = stars;
    $('radio-label').textContent = 'RADIO: ' + G.audio.stationName();
    const m = G.missions;
    if (m.active && m.stage) {
      $('objective-title').textContent = 'MISI ' + m.active.id + ' — ' + m.active.title;
      let txt = m.stage.text;
      if (m.stage.type === 'chase' && m.chaseBoat) txt += '  [' + Math.max(0, Math.ceil(m.chaseBoat.hp)) + '%]';
      if (m.stage.hold && m.holdT > 0) txt += '  [' + (m.stage.hold - m.holdT).toFixed(1) + ' dtk]';
      $('objective-text').textContent = txt;
    } else {
      const next = m.nextAvailable();
      $('objective-title').textContent = next ? 'MISI BERIKUTNYA: ' + next.title : 'SEMUA MISI SELESAI';
      $('objective-text').textContent = next
        ? 'Temui ' + next.giver + ' di penanda kuning di peta (M untuk peta besar).'
        : 'Isla Verde milikmu. Cari 20 peti harta karun!';
    }
    if (p.vehicle) {
      $('speedo').classList.remove('hidden');
      $('speed-num').textContent = Math.round(Math.abs(p.vehicle.speed) * 0.42);
      $('vehicle-name').textContent = VEHICLE_TYPES[p.vehicle.type].name + (p.vehicle.hp < 50 ? ' — RUSAK!' : '');
    } else $('speedo').classList.add('hidden');
    const d = m.dialog;
    if (d) {
      $('dialog').classList.remove('hidden');
      $('dialog-speaker').textContent = d.speaker;
      $('dialog-text').textContent = d.lines[d.idx];
    } else $('dialog').classList.add('hidden');
    const b = m.banner;
    if (b) {
      $('mission-banner').classList.remove('hidden');
      $('mission-banner-title').textContent = b.title;
      $('mission-banner-sub').textContent = b.sub;
    } else $('mission-banner').classList.add('hidden');
    if (G.interactLabel) {
      $('interact').classList.remove('hidden');
      $('interact').textContent = G.interactLabel;
    } else $('interact').classList.add('hidden');
    this.drawMinimap(G, this.mapCtx, 200);
  }
  drawWorldBase(ctx, size, G) {
    const s = size / WORLD;
    ctx.fillStyle = '#0a4a6e';
    ctx.fillRect(0, 0, size, size);
    // land mass
    ctx.fillStyle = '#7fae62';
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, 1480 * s, 1420 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // beach ring
    ctx.strokeStyle = '#e8d8a0';
    ctx.lineWidth = 10 * s + 2;
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, 1420 * s, 1360 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    // jungle
    ctx.fillStyle = '#2e6b2f';
    ctx.fillRect(900 * s, 480 * s, 1400 * s, 560 * s);
    // zones
    ctx.fillStyle = 'rgba(220,200,160,0.7)';
    ctx.fillRect(1150 * s, 1150 * s, 900 * s, 600 * s);
    ctx.fillStyle = 'rgba(200,200,190,0.8)';
    ctx.fillRect(2380 * s, 1150 * s, 520 * s, 700 * s);
    ctx.fillStyle = 'rgba(230,210,150,0.8)';
    ctx.fillRect(330 * s, 1280 * s, 480 * s, 620 * s);
    // roads
    ctx.fillStyle = '#5a5a5a';
    for (const r of ROADS) ctx.fillRect(r.x * s, r.y * s, Math.max(2, r.w * s), Math.max(2, r.h * s));
    // docks
    ctx.strokeStyle = '#8a6b3f';
    ctx.lineWidth = 6;
    for (const d of DOCKS) {
      ctx.beginPath();
      ctx.moveTo(d.x * s, d.y * s);
      ctx.lineTo((d.x + Math.cos(d.angle) * d.len) * s, (d.y + Math.sin(d.angle) * d.len) * s);
      ctx.stroke();
    }
    // treasure chests (unfound only)
    ctx.fillStyle = '#ffd23f';
    for (const c of G.world.chests) {
      if (c.found) continue;
      ctx.beginPath(); ctx.arc(c.x * s, c.y * s, 4, 0, 7); ctx.fill();
    }
  }
  drawMarkers(ctx, size, G) {
    const s = size / WORLD;
    const p = G.player, m = G.missions;
    // mission start points
    ctx.fillStyle = '#ffd23f';
    for (const sp of m.startPoints()) {
      const mission = G.missionById(sp.mission);
      if (!mission || m.done.has(sp.mission) || (m.active && m.active.id === sp.mission)) continue;
      ctx.beginPath(); ctx.arc(sp.x * s, sp.y * s, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
    }
    // active objective
    if (m.active && m.stage) {
      const st = m.stage;
      const tx = m.stage.type === 'chase' && m.chaseBoat ? m.chaseBoat.veh.x : st.x;
      const ty = m.stage.type === 'chase' && m.chaseBoat ? m.chaseBoat.veh.y : st.y;
      ctx.fillStyle = '#ff4757';
      ctx.beginPath(); ctx.arc(tx * s, ty * s, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    // police
    ctx.fillStyle = '#3b82f6';
    for (const pol of G.entities.police) { ctx.beginPath(); ctx.arc(pol.veh.x * s, pol.veh.y * s, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ff7f2a';
    for (const g of G.entities.guard) { ctx.beginPath(); ctx.arc(g.veh.x * s, g.veh.y * s, 4, 0, 7); ctx.fill(); }
    // player arrow
    ctx.save();
    ctx.translate(p.x * s, p.y * s);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -6); ctx.lineTo(-7, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  drawMinimap(G, ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
    this.drawWorldBase(ctx, size, G);
    this.drawMarkers(ctx, size, G);
    ctx.restore();
  }
  drawBigmap(G) {
    const ctx = this.bigCtx;
    ctx.clearRect(0, 0, 760, 760);
    this.drawWorldBase(ctx, 760, G);
    this.drawMarkers(ctx, 760, G);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    for (const z of ZONES) ctx.fillText(z.name, z.x / WORLD * 760 + 6, z.y / WORLD * 760 + 20);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('● Misi  ● Tujuan  ● Polisi  ● Coast Guard  ◆ Peti harta', 16, 744);
  }
}
