// Isla Verde — 6 story missions with dialogue, stages, markers and rewards.
// Giver: Mara, a courier who runs packages between the port, the jungle and the sea.
export const MISSIONS = [
  {
    id: 1, title: 'Paket Pertama', giver: 'MARA', reward: 500,
    intro: [
      'MARA: Kau kurir baru itu? Bagus. Aku Mara — aku yang mengatur semua paket di pulau ini.',
      'MARA: Paket pertama gampang: ambil bungkusan di Dermaga Coral, antar ke warung di Desa Nelayan. Jangan bikin ribut.',
      'MARA: Ada mobil parkir di dekat sini kalau kakimu capek. Pergi!',
    ],
    stages: [
      { type: 'goto', x: 2900, y: 1420, radius: 70, text: 'Ambil paket di Dermaga Coral (timur)', banner: 'AMBIL PAKET' },
      { type: 'goto', x: 560, y: 1620, radius: 70, text: 'Antar paket ke warung Desa Nelayan (barat)', banner: 'ANTAR PAKET' },
    ],
    outro: ['MARA: Cepat juga. Ini upahmu. Paket berikutnya lebih... menarik.'],
  },
  {
    id: 2, title: 'Muatan Tengah Malam', giver: 'MARA', reward: 900,
    intro: [
      'MARA: Ada muatan yang harus lewat pelabuhan tanpa diperiksa. Peti-peti di gudang timur.',
      'MARA: Bawa ke pondok di tengah jungle. Kalau polisi melihatmu dekat gudang, mereka curiga. Pelan-pelan saja.',
    ],
    stages: [
      { type: 'goto', x: 2620, y: 1250, radius: 80, text: 'Ambil peti di gudang Pelabuhan Coral', banner: 'AMBIL PETI' },
      { type: 'goto', x: 1600, y: 760, radius: 80, text: 'Antar ke pondok jungle (tengah pulau)', banner: 'SELUNDUPKAN' },
    ],
    outro: ['MARA: Muatan aman. Pemiliknya senang. Kau mulai dipercaya.'],
    onStageStart: (G, stageIdx) => { if (stageIdx === 0) G.setWanted(1); },
  },
  {
    id: 3, title: 'Rampok Gudang Pelabuhan', giver: 'ORLO', reward: 1500,
    intro: [
      'ORLO: Mara bilang kau bisa diandalkan. Aku Orlo — aku butuh uang kas gudang pelabuhan.',
      'ORLO: Masuk, ambil tasnya, keluar cepat. Ada penjaga bersenjata di dalam. Bawa pistolmu.',
      'ORLO: Begitu tas di tangan, polisi pasti datang. Lari ke perahu, bukan ke jalan!',
    ],
    stages: [
      { type: 'combat', x: 2560, y: 1400, radius: 90, text: 'Kalahkan penjaga gudang (3 orang)', banner: 'SERBU GUDANG', enemies: 3 },
      { type: 'goto', x: 2620, y: 1450, radius: 60, text: 'Ambil tas uang di gudang', banner: 'AMBIL TAS' },
      { type: 'goto', x: 3120, y: 1500, radius: 70, text: 'Kabur ke speedboat di dermaga!', banner: 'KABUR LEWAT LAUT' },
    ],
    outro: ['ORLO: Hah! Tas penuh. Bagianmu di sini. Mara benar soal kau.'],
    onStageStart: (G, stageIdx) => { if (stageIdx === 2) G.setWanted(3); },
  },
  {
    id: 4, title: 'Kejar Laut', giver: 'MARA', reward: 1200,
    intro: [
      'MARA: Perahu pengkhianat kabur ke laut lepas dengan muatan kita. Dia cepat — kau butuh speedboat.',
      'MARA: Kejar dia dan tabrak sampai dia menyerah. Coast Guard ikut patroli malam ini, hati-hati.',
    ],
    stages: [
      { type: 'goto', x: 3120, y: 1500, radius: 70, text: 'Naik speedboat di Dermaga Coral', banner: 'NAIK SPEEDBOAT' },
      { type: 'chase', x: 2600, y: 300, radius: 120, text: 'Kejar dan tabrak perahu pengkhianat!', banner: 'KEJAR DIA', chaseBoat: true },
    ],
    outro: ['MARA: Muatan kembali. Laut memang milikmu, kurir.'],
    onStageStart: (G, stageIdx) => { if (stageIdx === 1) G.setWanted(2); },
  },
  {
    id: 5, title: 'Turis Hilang', giver: 'MARA', reward: 800,
    intro: [
      'MARA: Turis dari Strip Marisol tersesat di jungle utara. Keluarganya panik dan membayar mahal.',
      'MARA: Temukan dia di dekat jalan tanah, lalu antar dia kembali ke hotel di strip. Dia takut — jangan bawa senjata di depannya.',
    ],
    stages: [
      { type: 'goto', x: 1200, y: 760, radius: 80, text: 'Cari turis di jungle utara', banner: 'CARI TURIS' },
      { type: 'escort', x: 1500, y: 2500, radius: 90, text: 'Antar turis ke Bar Ombak di Strip Marisol', banner: 'ANTAR PULANG' },
    ],
    outro: ['TURIS: Terima kasih! Aku tidak akan keluar dari hotel lagi. Ini untukmu.'],
  },
  {
    id: 6, title: 'Badai Terakhir', giver: 'MARA', reward: 2500,
    intro: [
      'MARA: Ini yang terakhir dan terbesar: serahkan muatan ke kapal lepas pantai — di tengah badai.',
      'MARA: Hujan, ombak, Coast Guard... tapi bayarannya sepadan. Ambil muatan di mercusuar utara, lalu ke titik temu di laut.',
      'MARA: Setelah ini, kau bukan kurir lagi. Kau legenda Isla Verde.',
    ],
    stages: [
      { type: 'goto', x: 1600, y: 220, radius: 70, text: 'Ambil muatan di Mercusuar Tanjung Utara', banner: 'AMBIL MUATAN' },
      { type: 'goto', x: 1600, y: 120, radius: 90, text: 'Serahkan ke kapal di laut utara (tahan 5 detik)', banner: 'SERAHKAN DI TENGAH BADAI', hold: 5 },
    ],
    outro: ['MARA: Selesai. Badai, polisi, laut — semuanya kau kalahkan. Isla Verde milikmu sekarang.'],
    onStageStart: (G, stageIdx) => { if (stageIdx === 0) { G.setWanted(2); G.forceStorm(45); } },
  },
];

export class MissionManager {
  constructor() {
    this.active = null;       // mission object
    this.stageIdx = 0;
    this.dialog = null;       // {lines, idx, speaker}
    this.banner = null;       // {title, sub, t}
    this.holdT = 0;
    this.chaseBoat = null;    // entity for mission 4
    this.escort = null;       // ped for mission 5
    this.done = new Set();
  }
  get stage() { return this.active ? this.active.stages[this.stageIdx] : null; }
  startMission(m, G) {
    this.active = m; this.stageIdx = 0; this.holdT = 0; this.chaseBoat = null; this.escort = null;
    this.showBanner(m.title, 'Misi ' + m.id + ' dari ' + m.giver + ' — hadiah $' + m.reward);
    this.say(m.intro, m.giver);
    this.setupStage(G);
  }
  say(lines, speaker) { this.dialog = { lines, idx: 0, speaker }; }
  advanceDialog() {
    if (!this.dialog) return false;
    this.dialog.idx++;
    if (this.dialog.idx >= this.dialog.lines.length) { this.dialog = null; return false; }
    return true;
  }
  showBanner(title, sub) { this.banner = { title, sub, t: 3.2 }; }
  setupStage(G) {
    const s = this.stage;
    if (!s) return;
    if (s.banner) this.showBanner(s.banner, s.text);
    if (s.enemies) {
      for (let i = 0; i < s.enemies; i++) {
        G.entities.enemies.push({
          x: s.x + (i - 1) * 70, y: s.y + (i % 2 ? 60 : -60),
          hp: 100, angle: 0, shootCd: 1 + i * 0.4,
          shirt: '#3d3d3d', skin: '#c68642',
        });
      }
    }
    if (s.chaseBoat) {
      const { makeVehicle } = G.vehicleLib;
      const v = makeVehicle('speedboat', s.x + 300, s.y, 0, '#8e44ad');
      v.driver = 'traffic';
      this.chaseBoat = { veh: v, loop: [[2900, 280], [2500, 200], [2000, 150], [2900, 100]], wp: 0, speed: 150, hp: 100 };
    }
    if (s.type === 'escort') {
      const prev = this.active.stages[this.stageIdx - 1];
      this.escort = { x: prev.x, y: prev.y, angle: 0, shirt: '#ffffff', skin: '#f1c27d' };
    }
    if (this.active && this.active.onStageStart) this.active.onStageStart(G, this.stageIdx);
  }
  update(G, dt) {
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    if (!this.active || this.dialog) return;
    const s = this.stage;
    if (!s) return;
    const p = G.player;
    if (s.type === 'goto' || s.type === 'escort') {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (s.type === 'escort' && this.escort) {
        this.escort.x += (p.x - this.escort.x) * Math.min(1, dt * 1.2);
        this.escort.y += (p.y - this.escort.y) * Math.min(1, dt * 1.2);
      }
      if (s.hold) {
        if (d < s.radius) {
          this.holdT += dt;
          if (this.holdT >= s.hold) { this.holdT = 0; this.nextStage(G); }
        } else this.holdT = 0;
      } else if (d < s.radius) this.nextStage(G);
    } else if (s.type === 'combat') {
      if (G.entities.enemies.every(e => e.hp <= 0)) this.nextStage(G);
    } else if (s.type === 'chase' && this.chaseBoat) {
      const cb = this.chaseBoat;
      // fleeing boat follows its loop
      const wp = cb.loop[cb.wp];
      const d = Math.hypot(cb.veh.x - wp[0], cb.veh.y - wp[1]);
      if (d < 60) cb.wp = (cb.wp + 1) % cb.loop.length;
      const want = Math.atan2(wp[1] - cb.veh.y, wp[0] - cb.veh.x);
      let diff = want - cb.veh.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cb.veh.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff * 2 * dt));
      cb.veh.speed += (170 - cb.veh.speed) * dt * 0.5;
      cb.veh.x += Math.cos(cb.veh.angle) * cb.veh.speed * dt;
      cb.veh.y += Math.sin(cb.veh.angle) * cb.veh.speed * dt;
      // ramming: player boat contact damages it
      const pd = Math.hypot(p.x - cb.veh.x, p.y - cb.veh.y);
      if (pd < 70 && p.vehicle) {
        cb.hp -= 40 * dt;
        if (Math.random() < 0.3) G.spawnSparks(cb.veh.x, cb.veh.y);
      }
      if (cb.hp <= 0) this.nextStage(G);
    }
  }
  nextStage(G) {
    this.stageIdx++;
    if (this.stageIdx >= this.active.stages.length) this.complete(G);
    else this.setupStage(G);
  }
  complete(G) {
    const m = this.active;
    G.player.money += m.reward;
    this.done.add(m.id);
    this.active = null; this.stageIdx = 0; this.chaseBoat = null; this.escort = null;
    this.showBanner('MISI SELESAI', 'Hadiah $' + m.reward + ' — ' + m.title);
    this.say(m.outro, m.giver);
    G.saveGame();
    G.audio.pickup();
  }
  // mission start points (Mara at the bar, Orlo at the port warehouse)
  startPoints() {
    return [
      { mission: 1, x: 1500, y: 2500, label: 'MARA — Misi 1' },
      { mission: 2, x: 1500, y: 2500, label: 'MARA — Misi 2' },
      { mission: 3, x: 2560, y: 1500, label: 'ORLO — Misi 3' },
      { mission: 4, x: 1500, y: 2500, label: 'MARA — Misi 4' },
      { mission: 5, x: 1500, y: 2500, label: 'MARA — Misi 5' },
      { mission: 6, x: 1600, y: 220, label: 'MARA — Misi 6' },
    ];
  }
  nextAvailable() {
    for (const m of MISSIONS) if (!this.done.has(m.id) && (!this.active || this.active.id !== m.id)) return m;
    return null;
  }
}
