// Isla Verde — day/night cycle and tropical storms (rain, lightning, wind).
import { clamp } from './rng.js';

export class Weather {
  constructor() {
    this.hour = 10.0;          // 10:00 start
    this.storm = 0;            // seconds of storm remaining
    this.stormTimer = 75;      // seconds until next storm check
    this.rain = [];            // rain streaks {x,y,vy}
    this.flash = 0;            // lightning flash 0..1
    this.flashTimer = 0;
    this.wind = 0;
  }
  forceStorm(seconds) { this.storm = Math.max(this.storm, seconds); }
  update(dt, audio) {
    this.hour = (this.hour + dt / 60) % 24; // 1 game-hour per 60 real seconds
    this.stormTimer -= dt;
    if (this.stormTimer <= 0) {
      this.stormTimer = 75 + Math.random() * 90;
      if (Math.random() < 0.45) this.storm = 25 + Math.random() * 25;
    }
    if (this.storm > 0) {
      this.storm -= dt;
      this.wind = 0.7 + Math.random() * 0.3;
      if (this.rain.length < 220) {
        for (let i = 0; i < 6; i++) this.rain.push({ x: Math.random() * 1280, y: -20, vy: 900 + Math.random() * 300 });
      }
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashTimer = 4 + Math.random() * 8;
        this.flash = 1;
        if (audio) audio.thunder();
      }
    } else {
      this.wind = 0.1;
      this.rain.length = 0;
    }
    if (this.flash > 0) this.flash -= dt * 2.2;
    for (const r of this.rain) { r.y += r.vy * dt; r.x += this.wind * 160 * dt; }
    this.rain = this.rain.filter(r => r.y < 820 && r.x < 1320);
    if (audio) audio.setRain(this.storm > 0);
  }
  // 0 = pitch black .. 1 = bright noon
  daylight() {
    const h = this.hour;
    if (h < 5 || h > 20) return 0.12;
    if (h < 7) return 0.12 + ((h - 5) / 2) * 0.7;
    if (h > 18) return 0.82 - ((h - 18) / 2) * 0.7;
    return 0.82 + Math.sin(((h - 7) / 11) * Math.PI) * 0.18;
  }
  label() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    const hh = String(h).padStart(2, '0'), mm = String(m).padStart(2, '0');
    let part = 'Siang';
    if (h < 5 || h >= 21) part = 'Malam';
    else if (h < 7) part = 'Subuh';
    else if (h < 11) part = 'Pagi';
    else if (h < 15) part = 'Siang';
    else if (h < 18) part = 'Sore';
    else part = 'Senja';
    if (this.storm > 0) part += ' — BADAI';
    return hh + ':' + mm + ' — ' + part;
  }
  // overlay tint drawn over the world each frame
  tint() {
    const d = this.daylight();
    const stormDark = this.storm > 0 ? 0.25 : 0;
    const dark = clamp(1 - d - stormDark + 0.08, 0, 0.85);
    const h = this.hour;
    let color = 'rgba(8,12,40,' + dark.toFixed(3) + ')';
    if (h >= 17 && h < 19 && this.storm <= 0) color = 'rgba(255,120,40,' + (0.10 + (1 - d) * 0.12).toFixed(3) + ')';
    return { color, flash: Math.max(0, this.flash) };
  }
}
