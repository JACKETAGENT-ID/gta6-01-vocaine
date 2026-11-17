// Isla Verde — procedural WebAudio: ocean waves, engine hum, sirens, 3 radio stations.
// No audio files: everything is synthesized with oscillators and filtered noise.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.enabled = false;
    this.station = 0; this.radioTimer = null; this.step = 0;
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.waveGain = null; this.sirenOsc = null; this.sirenGain = null; this.sirenOn = false;
    this.stations = [
      { name: 'Suara Pantai FM', bpm: 96, root: 220, scale: [0, 3, 5, 7, 10], wave: 'triangle', bass: [0, 0, 7, 5] },
      { name: 'Radio Salsa Verde', bpm: 132, root: 196, scale: [0, 2, 4, 7, 9], wave: 'square', bass: [0, 5, 0, 7] },
      { name: 'Ombak Lo-Fi', bpm: 76, root: 174, scale: [0, 2, 3, 7, 8], wave: 'sine', bass: [0, 0, 3, 7] },
    ];
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
      this.startWaves();
      this.startEngine();
      this.startRadio();
    } catch (e) { this.enabled = false; }
  }
  noiseBuffer(seconds = 2) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  startWaves() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3); src.loop = true;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
    this.waveGain = this.ctx.createGain(); this.waveGain.gain.value = 0.05;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain); lfoGain.connect(this.waveGain.gain);
    src.connect(filt); filt.connect(this.waveGain); this.waveGain.connect(this.master);
    src.start(); lfo.start();
  }
  startEngine() {
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter); this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speed01, on) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.02 + speed01 * 0.05 : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(280 + speed01 * 900, t, 0.1);
  }
  setSiren(on) {
    if (!this.enabled) return;
    if (on && !this.sirenOn) {
      this.sirenOn = true;
      this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0.035;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.7;
      const lg = this.ctx.createGain(); lg.gain.value = 320;
      lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 780;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      this._sirenLfo = lfo;
    } else if (!on && this.sirenOn) {
      this.sirenOn = false;
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null;
    }
  }
  setRain(on) {
    if (!this.enabled || !this.waveGain) return;
    this.waveGain.gain.setTargetAtTime(on ? 0.11 : 0.05, this.ctx.currentTime, 0.5);
  }
  startRadio() {
    const st = this.stations[this.station];
    const stepMs = 60000 / st.bpm / 2;
    this.step = 0;
    this.radioTimer = setInterval(() => {
      if (!this.enabled || this.ctx.state !== 'running') return;
      this.playStep(st, this.step);
      this.step = (this.step + 1) % 32;
    }, stepMs);
  }
  playStep(st, step) {
    const t = this.ctx.currentTime;
    const scale = st.scale;
    const idx = [0, 2, 1, 3, 2, 4, 3, 1][step % 8];
    const semi = scale[idx % scale.length] + 12 * Math.floor(idx / scale.length);
    const freq = st.root * Math.pow(2, semi / 12);
    if (step % 2 === 0) this.blip(freq, 0.22, st.wave, 0.045, t);
    if (step % 8 === 0) this.blip(st.root * Math.pow(2, st.bass[(step / 8) % 4] / 12) / 2, 0.5, 'sine', 0.09, t);
    if (step % 4 === 2) this.hat(t);
  }
  blip(freq, dur, wave, vol, t) {
    const o = this.ctx.createOscillator(); o.type = wave; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  hat(t) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.05);
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    if (this.radioTimer) clearInterval(this.radioTimer);
    this.startRadio();
    return this.stations[this.station].name;
  }
  stationName() { return this.stations[this.station].name; }
  shoot() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.12);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  punch() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.09);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.12);
  }
  pickup() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    this.blip(660, 0.12, 'sine', 0.1, t); this.blip(990, 0.18, 'sine', 0.1, t + 0.09);
  }
  horn() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    this.blip(370, 0.25, 'square', 0.05, t); this.blip(466, 0.25, 'square', 0.05, t);
  }
  thunder() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer(1.2);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
}
