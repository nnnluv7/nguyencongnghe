const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, MODES, clearance } = require('../public/flappy-bird/core.js');
const start = (mode = 'normal', width = 1080) => { const e = new Engine({ width }); e.start(mode, 12345); return e; };

test('same daily seed produces the same obstacle and pickup route', () => {
  const a = start(), b = start();
  a.time = b.time = 30;
  for (let i = 0; i < 60; i++) { a.spawnWave(); b.spawnWave(); }
  assert.deepEqual(a.obstacles, b.obstacles);
  assert.deepEqual(a.pickups, b.pickups);
});

test('all difficulty levels retain a reachable corridor and bounded gap movement', () => {
  for (const mode of Object.keys(MODES)) {
    const e = start(mode, 400); e.time = 30;
    let previous = 310;
    e.onEvent = event => {
      if (event.type !== 'wave') return;
      assert.ok(event.gap >= MODES[mode].minGap);
      assert.ok(event.center - event.gap / 2 >= 85 - .001);
      assert.ok(event.center + event.gap / 2 <= 555.001);
      assert.ok(Math.abs(event.center - previous) <= 87.501);
      previous = event.center;
    };
    for (let i = 0; i < 500; i++) { e.level = 1 + Math.floor(i / 50); e.spawnWave(); }
  }
});

test('collision ends a run once, final score includes current progress', () => {
  const e = start(); let deaths = 0;
  e.onEvent = event => { if (event.type === 'death') deaths++; };
  e.distance = 21; e.points = 50;
  e.obstacles = [{ kind: 'rock', x: e.player.x, y: e.player.y, r: 25, age: 0, group: 1, closest: Infinity }];
  e.update(1 / 120); e.update(1 / 120); e.die('bomb');
  assert.equal(e.status, 'over'); assert.equal(e.reason, 'rock'); assert.equal(deaths, 1); assert.equal(e.score, 60);
});

test('shield absorbs a hit and provides time to leave the obstacle', () => {
  const e = start('easy');
  e.obstacles = [{ kind: 'rock', x: e.player.x, y: e.player.y, r: 25, age: 0, group: 1, closest: Infinity }];
  e.update(1 / 120); assert.equal(e.status, 'playing'); assert.equal(e.shield, 0); assert.ok(e.invulnerable > 1);
  e.update(1 / 120); assert.equal(e.status, 'playing');
});

test('dash has a cooldown, pierces obstacles, but does not bypass map boundaries', () => {
  const e = start(); assert.equal(e.activateDash(), true); assert.equal(e.activateDash(), false);
  e.obstacles = [{ kind: 'rock', x: e.player.x, y: e.player.y, r: 25, age: 0, group: 1, closest: Infinity }];
  e.update(1 / 120); assert.equal(e.status, 'playing');
  e.player.y = 30; e.player.vy = -100; e.update(1 / 120);
  assert.equal(e.reason, 'ceiling');
});

test('a near miss scores once per wave, including two nearby obstacles', () => {
  const e = start(); const { x, y } = e.player;
  e.obstacles = [1, -1].map(sign => ({ kind: 'rock', x: x - 40, y: y + sign * 25, r: 12, age: 0, group: 7, closest: Infinity }));
  e.update(1 / 120); assert.equal(e.nearMisses, 1); assert.equal(e.combo, 2); assert.equal(e.points, 50);
  e.update(1 / 120); assert.equal(e.nearMisses, 1);
});

test('pause freezes physics and score, then resumes', () => {
  const e = start(); e.pause(); const before = JSON.stringify([e.player, e.score, e.time, e.dashCooldown]);
  for (let i = 0; i < 400; i++) e.update(1 / 120, true);
  assert.equal(JSON.stringify([e.player, e.score, e.time, e.dashCooldown]), before);
  e.resume(); e.update(1 / 120); assert.ok(e.time > 0);
});

test('warning bombs cannot damage the player before the warning expires', () => {
  const e = start(); e.player.vy = 0;
  e.obstacles = [{ kind: 'bomb', x: e.player.x, y: e.player.y, r: 21, warning: 1.25, vy: 0, group: 1, age: 0, closest: Infinity }];
  e.update(1 / 120); assert.equal(e.status, 'playing'); assert.ok(e.obstacles[0].warning > 1.2);
});

test('restart resets temporary effects and mode state', () => {
  const e = start('easy'); e.activateDash(); e.points = 999; e.nearMisses = 3; e.die('ground');
  e.start('hard', 99); assert.equal(e.status, 'playing'); assert.equal(e.shield, 0); assert.equal(e.dash, 0); assert.equal(e.score, 0); assert.equal(e.dashCooldown, 0); assert.equal(e.nearMisses, 0);
});

test('narrow-screen speed preserves reaction time at high levels', () => {
  const e = start('normal', 400); e.time = 150; e.update(1 / 120);
  assert.ok((e.width - e.player.x + 70) / e.speed >= 1.3 - .001);
});

test('circle and rock-wall collisions use a forgiving inner hitbox', () => {
  const wall = { kind: 'wall', x: 200, y: 0, w: 78, h: 200 };
  assert.ok(clearance({ x: 240, y: 215, r: 12 }, wall) > 0);
  assert.ok(clearance({ x: 240, y: 205, r: 12 }, wall) < 0);
});
