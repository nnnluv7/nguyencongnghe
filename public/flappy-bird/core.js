/* Bay Đi Đừng Cáu — deterministic gameplay; no dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NCNFlight = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MODES = Object.freeze({
    easy: { name: 'Thử tay', speed: 190, gap: 280, minGap: 220, interval: 2.05, gravity: 720, flap: -275 },
    normal: { name: 'Căng thật', speed: 225, gap: 245, minGap: 178, interval: 1.85, gravity: 780, flap: -285 },
    hard: { name: 'Đừng cáu', speed: 255, gap: 218, minGap: 158, interval: 1.65, gravity: 820, flap: -295 }
  });
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function seededRandom(seed) {
    let a = Number(seed) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(text) {
    let n = 2166136261;
    for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
    return n >>> 0;
  }
  function clearance(p, o) {
    if (o.kind === 'wall') {
      const x = clamp(p.x, o.x + 5, o.x + o.w - 5);
      const y = clamp(p.y, o.y + 5, o.y + o.h - 5);
      return Math.hypot(p.x - x, p.y - y) - p.r;
    }
    return Math.hypot(p.x - o.x, p.y - o.y) - p.r - o.r;
  }
  class Engine {
    constructor(options = {}) {
      this.width = options.width || 1080;
      this.height = 640;
      this.onEvent = options.onEvent || function () {};
      this.status = 'ready';
      this.player = { x: Math.min(210, this.width * .25), y: 310, vy: 0, r: 12, wing: 0 };
      this.obstacles = []; this.pickups = []; this.time = 0; this.distance = 0;
      this.mode = 'normal'; this.score = 0; this.dash = 0; this.shield = 0;
    }
    emit(type, data = {}) { this.onEvent({ type, ...data }); }
    resize(width) {
      const oldWidth = this.width, oldX = this.player.x;
      this.width = Math.max(400, width);
      this.player.x = Math.min(210, this.width * .25);
      for (const o of [...this.obstacles, ...this.pickups]) o.x = this.player.x + (o.x - oldX) * this.width / oldWidth;
    }
    start(mode = 'normal', seed = Date.now()) {
      this.mode = MODES[mode] ? mode : 'normal'; this.settings = MODES[this.mode];
      this.seed = Number(seed) >>> 0; this.random = seededRandom(this.seed);
      this.status = 'playing'; this.time = 0; this.distance = 0; this.points = 0; this.score = 0;
      this.stars = 0; this.nearMisses = 0; this.combo = 1; this.comboTime = 0;
      this.dash = 0; this.dashCooldown = 0; this.shield = this.mode === 'easy' ? 8 : 0; this.invulnerable = 0;
      this.level = 1; this.speed = this.settings.speed; this.wave = 0; this.lastPattern = '';
      this.spawnClock = 1.5; this.lastGap = 310; this.holdClock = 0; this.obstacles = []; this.pickups = [];
      this.scoredGroups = new Set(); this.reason = ''; this.player.y = 310; this.player.vy = -100; this.player.wing = 0;
      this.emit('start');
    }
    flap() {
      if (this.status !== 'playing') return false;
      this.player.vy = this.settings.flap; this.player.wing = 1; this.holdClock = .22;
      this.emit('flap'); return true;
    }
    activateDash() {
      if (this.status !== 'playing' || this.dashCooldown > 0) return false;
      this.dash = .55; this.dashCooldown = 8; this.emit('dash'); return true;
    }
    pause() { if (this.status === 'playing') { this.status = 'paused'; this.emit('pause'); } }
    resume() { if (this.status === 'paused') { this.status = 'playing'; this.emit('resume'); } }
    die(reason) {
      if (this.status !== 'playing') return;
      this.score = Math.floor(this.distance / 2) + this.points;
      this.status = 'over'; this.reason = reason;
      this.emit('death', { reason, x: this.player.x, y: this.player.y });
    }
    addPickup(kind, x, y) {
      this.pickups.push({ kind, x, y, r: kind === 'star' ? 12 : 17, phase: this.random() * Math.PI * 2 });
    }
    spawnWave() {
      this.wave++;
      const cfg = this.settings, rnd = this.random;
      const gap = Math.max(cfg.minGap, cfg.gap - (this.level - 1) * 10);
      const center = clamp(this.lastGap + (rnd() - .5) * 175, 85 + gap / 2, this.height - 85 - gap / 2);
      this.lastGap = center;
      const group = this.wave, x = this.width + 95;
      const pick = rnd();
      let pattern = this.wave <= 2 ? 'gate' : pick < .43 ? 'gate' : pick < .7 ? 'eagle' : pick < .88 ? 'rock' : 'bomb';
      if (pattern === 'bomb' && (this.time < 12 || this.lastPattern === 'bomb')) pattern = 'rock';
      this.lastPattern = pattern;
      const add = o => this.obstacles.push({ ...o, group, closest: Infinity, age: 0, warned: false, phase: rnd() * Math.PI * 2 });
      if (pattern === 'gate') {
        add({ kind: 'wall', x, y: 0, w: 78, h: center - gap / 2, top: true });
        add({ kind: 'wall', x, y: center + gap / 2, w: 78, h: this.height - center - gap / 2, top: false });
      } else if (pattern === 'eagle') {
        const y = center < 320 ? center + gap / 2 + 24 : center - gap / 2 - 24;
        add({ kind: 'eagle', x, y, baseY: y, r: 27, extraSpeed: 48, amplitude: 24 });
        if (this.level > 2) {
          const y2 = center < 320 ? center - gap / 2 - 26 : center + gap / 2 + 26;
          add({ kind: 'eagle', x: x + 55, y: y2, baseY: y2, r: 25, extraSpeed: 48, amplitude: 18 });
        }
      } else if (pattern === 'rock') {
        add({ kind: 'rock', x, y: center - gap / 2 - 32, baseY: center - gap / 2 - 32, r: 37, amplitude: 10 });
        add({ kind: 'rock', x: x + 32, y: center + gap / 2 + 32, baseY: center + gap / 2 + 32, r: 40, amplitude: 10 });
      } else {
        // Bombs are visible for 1.25 seconds before becoming dangerous.
        add({ kind: 'bomb', x: this.width - 62, y: 32, r: 21, warning: 1.25, vy: 70 });
        this.emit('warning', { text: 'BOM RƠI · NHÌN VỆT ĐỎ' });
      }
      if (pattern !== 'bomb') {
        for (let i = 0; i < 3; i++) this.addPickup('star', x + 100 + i * 43, center + Math.sin(i * .8) * 19);
        if (this.wave % 6 === 0) this.addPickup('shield', x + 244, center);
      } else {
        this.addPickup('star', x + 45, clamp(center - 70, 130, 480));
      }
      this.emit('wave', { pattern, gap, center, group });
    }
    update(dt, held = false) {
      if (this.status !== 'playing') return;
      dt = clamp(dt, 0, .034);
      const p = this.player, cfg = this.settings;
      this.time += dt; this.distance += this.speed * dt / 10;
      this.dash = Math.max(0, this.dash - dt); this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      this.shield = Math.max(0, this.shield - dt); this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.holdClock -= dt; if (held && this.holdClock <= 0) this.flap();
      p.vy = Math.min(445, p.vy + cfg.gravity * dt); p.y += p.vy * dt; p.wing = Math.max(0, p.wing - dt * 4);
      if (p.y - p.r < 25) { this.die('ceiling'); return; }
      if (p.y + p.r > this.height - 33) { this.die('ground'); return; }
      const level = Math.min(10, 1 + Math.floor(this.time / 15));
      if (level !== this.level) { this.level = level; this.emit('level', { level }); }
      // Narrow screens retain at least 1.3 seconds of horizontal warning.
      this.speed = Math.min(cfg.speed + (this.level - 1) * 13, Math.max(cfg.speed, (this.width - p.x + 70) / 1.3));
      this.spawnClock -= dt;
      if (this.spawnClock <= 0) {
        this.spawnWave();
        this.spawnClock = Math.max(1.32, cfg.interval - (this.level - 1) * .045) + this.random() * .25;
      }
      this.comboTime = Math.max(0, this.comboTime - dt);
      if (!this.comboTime) this.combo = 1;
      for (const o of this.obstacles) {
        o.age += dt;
        if (o.kind === 'bomb' && o.warning > 0) { o.warning = Math.max(0, o.warning - dt); continue; }
        o.x -= (this.speed + (o.extraSpeed || 0)) * dt;
        if (o.kind === 'bomb') {
          o.vy += 190 * dt; o.y += o.vy * dt;
          if (o.y > this.height - 35) { o.remove = true; this.emit('explosion', { x: o.x, y: this.height - 35 }); continue; }
        } else if (o.amplitude) o.y = o.baseY + Math.sin(o.age * (o.kind === 'eagle' ? 2.3 : 1.3) + o.phase) * o.amplitude;
        const d = clearance(p, o);
        if (this.dash <= 0 && this.invulnerable <= 0) o.closest = Math.min(o.closest, d);
        if (d <= 0 && this.dash <= 0 && this.invulnerable <= 0) {
          if (this.shield > 0) { this.shield = 0; this.invulnerable = 1.15; this.emit('shieldBreak', { x: p.x, y: p.y }); }
          else { this.die(o.kind); break; }
        }
        const edge = o.kind === 'wall' ? o.x + o.w : o.x + o.r;
        if (!o.passed && edge < p.x - p.r) {
          o.passed = true;
          if (o.closest > 0 && o.closest < 31 && !this.scoredGroups.has(o.group)) {
            this.scoredGroups.add(o.group); this.nearMisses++; this.combo = Math.min(5, this.combo + 1); this.comboTime = 6;
            const points = 25 * this.combo; this.points += points; this.emit('near', { points, combo: this.combo, x: p.x, y: p.y - 40 });
          }
        }
      }
      this.obstacles = this.obstacles.filter(o => !o.remove && o.x + (o.w || o.r || 0) > -70);
      // Only the last few group IDs are needed, even during long sessions.
      for (const group of this.scoredGroups) if (group < this.wave - 20) this.scoredGroups.delete(group);
      if (this.status !== 'playing') return;
      for (const s of this.pickups) {
        s.x -= this.speed * dt;
        if (Math.hypot(s.x - p.x, s.y - p.y) < s.r + p.r + 3) {
          s.remove = true;
          if (s.kind === 'star') { const points = 10 * this.combo; this.stars++; this.points += points; this.emit('star', { x: s.x, y: s.y, points }); }
          else { this.shield = 8; this.emit('shield', { x: s.x, y: s.y }); }
        }
      }
      this.pickups = this.pickups.filter(s => !s.remove && s.x > -30);
      this.score = Math.floor(this.distance / 2) + this.points;
    }
  }
  return { Engine, MODES, seededRandom, hash, clamp, clearance };
});
