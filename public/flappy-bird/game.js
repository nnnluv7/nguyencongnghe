import {mountScores} from '../assets/ncn-arcade/arcade.js?v=20261027-photo-save-1';
import {installScrollUI} from '../assets/ncn-theme/scroll-ui.js?v=20261024-compact-1';
const scrollUI = installScrollUI();
(function () {
  'use strict';
  const { Engine, MODES, hash, clamp } = NCNFlight;
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas'), ctx = canvas.getContext('2d'), shell = $('gameShell');
  if (!ctx) { $('startButton').disabled = true; $('modeDescription').textContent = 'Trình duyệt này chưa hỗ trợ Canvas. Hãy thử Chrome, Safari hoặc Edge.'; return; }
  const storageKey = 'ncn-flight-v1';
  let saved = {}, persistent = true;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {}; } catch (_) { persistent = false; }
  const cleanScore = n => Number.isFinite(n) && n >= 0 ? Math.floor(Math.min(n, 100000000)) : 0;
  const records = { easy: cleanScore(saved.easy), normal: cleanScore(saved.normal), hard: cleanScore(saved.hard), daily: cleanScore(saved.daily), date: typeof saved.date === 'string' ? saved.date : '' };
  let muted = saved.muted === true;
  let reduced = typeof saved.reduced === 'boolean' ? saved.reduced : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = 'normal', daily = false, challengeDate = '', recordBefore = 0, bestThisRun = 0;
  let width = 1080, ratio = 1, held = false, pointerId = null, flapKeys = new Set();
  let lastFrame = 0, accumulator = 0, visualTime = 0, camera = 0, shake = 0, flash = 0;
  let deadAt = 0, overPresented = false, messageUntil = 0, helpPrevious = 'ready';
  let particles = [], floaters = [], audioContext = null, viewScore = -1, viewStars = -1;
  const engine = new Engine({ width, onEvent: onEvent });
  const phases = ['KHỞI ĐỘNG', 'GIÓ ĐỔI CHIỀU', 'BẦU TRỜI NỔI LOẠN', 'CĂNG RỒI ĐẤY', 'ĐỪNG CHỚP MẮT', 'KHÔNG PHẢI DẠNG VỪA', 'PHẢN XẠ THẦN SẦU', 'BẬC THẦY BẦU TRỜI', 'CÒN BAY LÀ CÒN GỠ', 'HUYỀN THOẠI'];
  const descriptions = { easy: 'Khe rộng, bay chậm. Tặng lá chắn trong 8 giây đầu.', normal: 'Vừa đủ khó để muốn thử thêm một lần.', hard: 'Bay nhanh, khe hẹp. Tay vững thì cứ thử.' };
  const deaths = {
    wall: ['Vách đá không né bạn.', 'Một cú chạm hơi thân thiết với núi.', 'Mẹo: nhìn khe đá kế tiếp, đừng chỉ nhìn chú chim.'],
    eagle: ['Đại bàng xin đường!', 'Bạn vừa bay vào giờ cao điểm của đại bàng.', 'Mẹo: đại bàng lượn lên xuống. Để ý cả khoảng trống phía dưới.'],
    rock: ['Đá cũng biết bay à?', 'Biết chứ. Và vừa tìm thấy bạn.', 'Mẹo: giữ bình tĩnh và đi theo hàng sao giữa những tảng đá.'],
    bomb: ['Bùm. Hơi to chuyện.', 'Bom đã báo trước. Tay mình chưa kịp báo theo.', 'Mẹo: thấy vệt đỏ thì đổi độ cao. Lướt đúng lúc có thể cứu bạn.'],
    ceiling: ['Trời cũng có giới hạn.', 'Bay cao là tốt. Cao quá thì…', 'Mẹo: thả tay cho chim hạ xuống. Lướt không bảo vệ khỏi trần.'],
    ground: ['Hạ cánh hơi mạnh.', 'Chú chim chưa được cấp bằng đáp đất.', 'Mẹo: chạm ngắn, đều nhịp. Giữ lâu sẽ khiến chim bay lên liên tục.']
  };
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({ ...records, muted, reduced })); } catch (_) { persistent = false; }
  }
  function localDate() {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const v = t => p.find(x => x.type === t).value;
    return v('year') + '-' + v('month') + '-' + v('day');
  }
  function sharedDate() {
    const value = new URLSearchParams(location.search).get('challenge');
    if (!value || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return '';
    const d = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value ? value : '';
  }
  function currentRecord() { return daily ? records.date === challengeDate ? records.daily : 0 : records[mode]; }
  function updateRecords() {
    $('welcomeBest').textContent = records[mode].toLocaleString('vi-VN');
    $('footerBest').textContent = String(records[mode]).padStart(3, '0');
    $('recordMode').textContent = MODES[mode].name.toUpperCase();
  }
  function audioUnlock() {
    if (muted) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audioContext) audioContext = new Audio();
      if (audioContext.state === 'suspended') audioContext.resume().catch(function () {});
    } catch (_) { /* Sound is optional. */ }
  }
  function tone(frequency, duration = .08, type = 'sine', volume = .035, endFrequency) {
    if (muted || !audioContext || audioContext.state !== 'running') return;
    try {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
      osc.type = type; osc.frequency.setValueAtTime(frequency, now);
      if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
      gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(now); osc.stop(now + duration);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch (_) { /* Keep the game playable if audio is unavailable. */ }
  }
  function sound(type) {
    if (type === 'flap') tone(360, .065, 'sine', .018, 620);
    if (type === 'star') tone(900 + engine.combo * 95, .1, 'sine', .035, 1600);
    if (type === 'near') { tone(600, .16, 'triangle', .05, 1400); }
    if (type === 'dash') tone(220, .25, 'sawtooth', .018, 1300);
    if (type === 'shield') tone(430, .25, 'sine', .04, 1350);
    if (type === 'shieldBreak') tone(650, .15, 'triangle', .05, 110);
    if (type === 'death') tone(180, .34, 'sawtooth', .055, 42);
    if (type === 'warning') tone(240, .18, 'square', .016, 330);
    if (type === 'level') tone(480, .22, 'triangle', .035, 960);
  }
  function burst(x, y, color, count = 12, power = 140) {
    if (reduced) count = Math.ceil(count / 3);
    for (let i = 0; i < count && particles.length < 180; i++) {
      const angle = Math.random() * Math.PI * 2, speed = power * (.3 + Math.random());
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + Math.random() * .35, max: .8, r: 1.5 + Math.random() * 3, color });
    }
  }
  function floater(text, x, y, color = '#ffe0a0') { if (floaters.length < 14) floaters.push({ text, x, y, life: .95, color }); }
  function message(text, duration = 1.8) { $('runMessage').textContent = text; $('runMessage').classList.add('show'); messageUntil = visualTime + duration; }
  function onEvent(e) {
    sound(e.type);
    if (e.type === 'star') { burst(e.x, e.y, '#ffda80', 7, 90); floater('+' + e.points, e.x, e.y - 16); }
    if (e.type === 'near') { burst(e.x, e.y + 20, '#6ce9cf', 10); floater('NÉ SÁT +' + e.points, e.x + 20, e.y, '#8ff4d8'); }
    if (e.type === 'shield') { burst(e.x, e.y, '#7dedde', 20); message('LÁ CHẮN · 8 GIÂY BẢO VỆ'); }
    if (e.type === 'shieldBreak') { burst(e.x, e.y, '#78efdf', 24, 200); shake = reduced ? 0 : 3; }
    if (e.type === 'dash') { burst(engine.player.x - 16, engine.player.y, '#6ce9cf', 18, 240); }
    if (e.type === 'warning') message(e.text, 1.25);
    if (e.type === 'level') { updateLevel(); message('CHẶNG ' + String(e.level).padStart(2, '0') + ' · ' + phases[e.level - 1], 2.2); }
    if (e.type === 'explosion') { burst(e.x, e.y, '#ff9364', 19, 170); }
    if (e.type === 'death') {
      held = false; flapKeys.clear(); deadAt = visualTime; overPresented = false;
      burst(e.x, e.y, '#77dfcb', 24, 210); burst(e.x, e.y, '#ff946d', 14, 180);
      shake = reduced ? 0 : 9; flash = reduced ? 0 : .13;
      $('dashButton').hidden = true; $('shieldLabel').hidden = true;
      bestThisRun = engine.score; recordBefore = currentRecord();
      if (daily) { records.date = challengeDate; records.daily = Math.max(recordBefore, bestThisRun); }
      else records[mode] = Math.max(recordBefore, bestThisRun);
      persist(); updateRecords();
    }
  }
  function updateLevel() {
    $('levelValue').textContent = daily ? 'ĐƯỜNG BAY ' + challengeDate.slice(8) + '/' + challengeDate.slice(5, 7) : 'CHẶNG ' + String(engine.level).padStart(2, '0') + ' · ' + phases[engine.level - 1];
  }
  function chooseMode(value) {
    if (!MODES[value]) return;
    mode = value;
    document.querySelectorAll('[data-mode]').forEach(b => { const selected = b.dataset.mode === value; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
    $('modeDescription').textContent = descriptions[mode]; updateRecords();
  }
  async function start(isDaily = false, keepDate = false) {
    if(!await scores.begin({mode:isDaily?'daily':mode,date:keepDate?challengeDate:sharedDate()||localDate()}))return;
    daily = isDaily;
    if (daily && !keepDate) challengeDate = sharedDate() || localDate();
    audioUnlock(); held = false; flapKeys.clear(); pointerId = null; accumulator = 0;
    particles = []; floaters = []; shake = 0; flash = 0; camera = 0; overPresented = false;
    const seed = daily ? hash('ncn-flight-2026-v1:' + challengeDate) : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    engine.start(daily ? 'normal' : mode, seed);
    for (const id of ['welcomeScreen', 'overScreen', 'pauseScreen', 'helpScreen']) $(id).hidden = true;
    $('hud').hidden = false; $('dashButton').hidden = false; $('sceneCaption').hidden = true;
    $('shareStatus').textContent = ''; viewScore = -1; viewStars = -1;
    updateLevel(); updateHUD(); canvas.focus({ preventScroll: true });
    message('CHẠM ĐỂ BAY · SHIFT / ϟ ĐỂ LƯỚT', 2.4);
  }
  function home() {
    engine.status = 'ready'; held = false; flapKeys.clear(); accumulator = 0;
    ['overScreen', 'pauseScreen', 'helpScreen', 'hud', 'dashButton', 'shieldLabel'].forEach(id => $(id).hidden = true);
    $('welcomeScreen').hidden = false; $('sceneCaption').hidden = false; $('runMessage').classList.remove('show');
    updateRecords(); $('startButton').focus({ preventScroll: true });
  }
  function externalPanel() {
    return document.body.classList.contains('ncn-menu-open') || Boolean(document.querySelector('dialog[open],.ncn-account-menu[open]'));
  }
  function pause({focus = true} = {}) {
    if (engine.status !== 'playing') return;
    engine.pause(); scores.checkpoint(engine.score,0,{force:true}); held = false; flapKeys.clear(); accumulator = 0;
    $('pauseScreen').hidden = false; $('dashButton').hidden = true; scrollUI?.show();
    if (focus && !externalPanel()) $('resumeButton').focus({ preventScroll: true });
  }
  function resume() {
    if (engine.status !== 'paused' || externalPanel()) return;
    $('pauseScreen').hidden = true; $('helpScreen').hidden = true; $('dashButton').hidden = false;
    held = false; flapKeys.clear(); accumulator = 0; engine.resume(); canvas.focus({ preventScroll: true }); audioUnlock();
  }
  function showHelp() {
    if (!$('helpScreen').hidden) return;
    helpPrevious = engine.status;
    if (engine.status === 'playing') pause();
    $('pauseScreen').hidden = true; $('helpScreen').hidden = false; $('closeHelpButton').focus({ preventScroll: true });
  }
  function closeHelp() {
    $('helpScreen').hidden = true;
    if (helpPrevious === 'playing' || helpPrevious === 'paused') { $('pauseScreen').hidden = false; $('resumeButton').focus({ preventScroll: true }); }
    else if (helpPrevious === 'over') $('retryButton').focus({ preventScroll: true });
    else $('startButton').focus({ preventScroll: true });
  }
  function presentResult() {
    scores.finish(bestThisRun);
    overPresented = true;
    const text = deaths[engine.reason] || deaths.wall;
    $('deathTitle').textContent = text[0]; $('deathText').textContent = text[1]; $('resultTip').textContent = text[2];
    $('resultKicker').textContent = daily ? 'ĐƯỜNG BAY ' + challengeDate + ' · CĂNG THẬT' : MODES[mode].name.toUpperCase() + ' · CHUYẾN BAY KẾT THÚC';
    $('finalScore').textContent = bestThisRun.toLocaleString('vi-VN');
    $('finalDistance').textContent = Math.floor(engine.distance) + ' m'; $('finalStars').textContent = engine.stars; $('finalNear').textContent = engine.nearMisses;
    $('newRecord').hidden = bestThisRun <= recordBefore || bestThisRun === 0;
    const medals = [{ at: 0, name: 'TẬP BAY' }, { at: 250, name: 'CÁNH ĐỒNG' }, { at: 600, name: 'CÁNH BẠC' }, { at: 1200, name: 'CÁNH VÀNG' }, { at: 2500, name: 'HUYỀN THOẠI' }];
    let index = medals.findIndex(m => m.at > bestThisRun); if (index === -1) index = medals.length;
    const medal = medals[index - 1], next = medals[index];
    $('medalName').textContent = '✦ ' + medal.name;
    $('medalTarget').textContent = next ? 'Mốc tiếp theo: ' + next.at.toLocaleString('vi-VN') : 'Đã chạm mốc cao nhất';
    $('medalFill').style.width = (next ? clamp((bestThisRun - medal.at) / (next.at - medal.at) * 100, 0, 100) : 100) + '%';
    if (!persistent) $('resultTip').textContent += ' Điểm chỉ được giữ trong phiên này.';
    $('overScreen').hidden = false; $('retryButton').focus({ preventScroll: true });
  }
  function updateHUD() {
    if (engine.score !== viewScore) { $('scoreValue').textContent = engine.score; viewScore = engine.score; }
    if (engine.stars !== viewStars) { $('starsValue').textContent = engine.stars; viewStars = engine.stars; }
    $('distanceValue').textContent = Math.floor(engine.distance) + ' m';
    $('comboValue').textContent = engine.combo > 1 ? 'COMBO ×' + engine.combo : '';
    const ready = engine.dashCooldown <= 0;
    $('dashButton').disabled = !ready; $('dashTitle').textContent = ready ? 'LƯỚT' : engine.dashCooldown.toFixed(1) + 's';
    $('dashHint').textContent = ready ? 'SHIFT / D' : 'ĐANG HỒI'; $('dashFill').style.width = ((8 - engine.dashCooldown) / 8 * 100) + '%';
    $('shieldLabel').hidden = engine.shield <= 0; $('shieldLabel').querySelector('span').textContent = engine.shield.toFixed(1) + 's';
  }
  function resize() {
    const rect = shell.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextWidth = Math.max(400, 640 * rect.width / rect.height);
    if (Math.abs(nextWidth - width) > 100 && engine.status === 'playing') pause();
    width = nextWidth; engine.resize(width); ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  }
  // All artwork is drawn locally. No images, font downloads or third-party scripts.
  function ellipse(x, y, rx, ry, color, rotation = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); ctx.fill(); }
  function polygon(points, color) { ctx.fillStyle = color; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); }
  function pathLine(points, color, w = 2) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
  function star(x, y, radius, color, rotation = 0) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = rotation - Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .46 : radius; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    polygon(pts, color);
  }
  function mountains(base, amplitude, period, scroll, dark, light) {
    const shift = (camera * scroll) % period;
    const points = [[-period, 670]];
    for (let i = -2; i < width / period + 3; i++) {
      const x = i * period - shift, y = base - amplitude * (.75 + .25 * Math.sin(i * 2.4));
      points.push([x, base], [x + period * .42, y], [x + period, base + 25]);
    }
    points.push([width + period * 2, 670]); polygon(points, dark);
    for (let i = -2; i < width / period + 3; i++) {
      const x = i * period - shift, y = base - amplitude * (.75 + .25 * Math.sin(i * 2.4));
      polygon([[x + period * .42, y], [x + period * .57, base + 12], [x + period, base + 25]], light);
    }
  }
  function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, 640);
    gradient.addColorStop(0, '#242740'); gradient.addColorStop(.38, '#5a4a69'); gradient.addColorStop(.75, '#b67a86'); gradient.addColorStop(1, '#e5a28a');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, 640);
    const sunX = width * .78, sunY = 182, sunR = width < 600 ? 65 : 83;
    const glow = ctx.createRadialGradient(sunX, sunY, 35, sunX, sunY, sunR * 2.5);
    glow.addColorStop(0, '#ffd5a51f'); glow.addColorStop(1, '#ffd5a500');
    ctx.fillStyle = glow; ctx.fillRect(sunX - 230, sunY - 230, 460, 460);
    ellipse(sunX, sunY, sunR, sunR, '#ffd0a2');
    ctx.strokeStyle = '#f2c4ac22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sunX, sunY, sunR + 17, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 39; i++) {
      const x = ((i * 193.7 + 34 - camera * .025) % (width + 30) + width + 30) % (width + 30), y = 38 + ((i * 71.3) % 215);
      ctx.globalAlpha = .25 + .2 * Math.sin(i + visualTime * .6);
      if (i % 9 === 0) { pathLine([[x - 3, y], [x + 3, y]], '#ffe8ca', 1); pathLine([[x, y - 3], [x, y + 3]], '#ffe8ca', 1); }
      else ellipse(x, y, 1, 1, '#ffe8ca');
    } ctx.globalAlpha = 1;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 234 + 60 - camera * .055) % (width + 260) + width + 260) % (width + 260) - 100, y = 175 + (i % 3) * 62;
      ellipse(x, y, 95, 10, '#be9baa24'); ellipse(x - 30, y - 8, 40, 14, '#be9baa24');
    }
    mountains(438, 160, 290, .09, '#69617c', '#81718a');
    mountains(510, 154, 350, .19, '#4d506d', '#5d5b78');
    mountains(610, 165, 245, .34, '#343e58', '#444960');
    ctx.fillStyle = '#192d43'; ctx.fillRect(0, 609, width, 31);
    for (let i = -1; i < width / 83 + 2; i++) {
      const x = i * 83 - camera * .55 % 83;
      polygon([[x, 623], [x + 14, 601], [x + 43, 612], [x + 57, 598], [x + 83, 623]], '#26374e');
    }
    ctx.fillStyle = '#ffaa753a'; ctx.fillRect(0, 607, width, 2);
    ctx.fillStyle = '#1c233b88'; ctx.fillRect(0, 0, width, 22);
    pathLine([[0, 24], [width, 24]], '#b1a0c335', 1);
    for (let i = 0; i < width / 95; i++) polygon([[i * 95 + 24, 0], [i * 95 + 37, 27], [i * 95 + 44, 0]], '#292a42');
  }
  function drawBird(x, y, size = 1, angle = 0, wing = 0, shield = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size, size);
    if (shield) { ctx.strokeStyle = '#80f3dfaa'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 34 + Math.sin(visualTime * 5) * 1.5, 0, Math.PI * 2); ctx.stroke(); ellipse(0, 0, 33, 33, '#63f3dc0d'); }
    const flutter = Math.sin(visualTime * 15) * 4 + wing * 6;
    polygon([[-19, -3], [-39, -15], [-31, 0], [-42, 5], [-18, 11]], '#38b8ae');
    polygon([[-6, 14], [-24, 22 + flutter * .25], [-41, 16], [-33, 29], [-15, 25], [7, 18]], '#ed715c');
    ellipse(0, 0, 26, 20, '#5de0c5'); ellipse(6, 8, 18, 12, '#9df3d1');
    ellipse(-9, 7 - flutter * .4, 14, 9 + flutter * .25, '#27ac9f', -.35 - wing * .4);
    ellipse(13, -7, 10, 11, '#fff4d9'); ellipse(17, -7, 3.8, 5, '#202b3e'); ellipse(18, -9, 1.3, 1.5, '#ffffff');
    polygon([[24, -3], [40, 3], [24, 8]], '#ffba5c'); pathLine([[26, 2], [37, 3]], '#d37e3c', 1.1);
    pathLine([[7, -18], [18, -20]], '#278c88', 2);
    ellipse(15, 7, 4, 2.3, '#f7b0a375');
    ctx.restore();
  }
  function drawEagle(o) {
    ctx.save(); ctx.translate(o.x, o.y);
    const f = Math.sin(o.age * 8 + o.phase) * 17;
    polygon([[5, 4], [48, 10], [57, 0], [39, -4], [23, -7]], '#a47e66');
    polygon([[-8, -4], [15, -35 - f], [49, -30 - f], [34, -17 - f * .6], [18, 0], [2, 14]], '#b98a68');
    polygon([[2, 0], [17, 22 + f], [43, 26 + f], [29, 10], [11, -5]], '#825f55');
    ellipse(3, 4, 24, 13, '#aa7b5d'); ellipse(-18, 0, 15, 12, '#fff0d4');
    polygon([[-30, -1], [-45, 6], [-29, 7], [-26, 11]], '#f4b65b');
    ellipse(-24, -1, 2.7, 3.2, '#293143'); pathLine([[-31, -9], [-19, -5]], '#67504b', 2.6);
    ctx.restore();
  }
  function drawRock(o) {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.age * .4 + o.phase);
    const r = o.r + 3, points = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, v = r * (.91 + .08 * Math.sin(i * 6 + o.phase)); points.push([Math.cos(a) * v, Math.sin(a) * v]); }
    polygon(points, '#646079');
    polygon([points[4], points[5], points[6], [-3, -4]], '#9990a1');
    polygon([points[0], points[1], points[2], [3, -2]], '#43465f');
    pathLine([[-19, -12], [-3, -2], [-7, 17]], '#b4a4af55', 2);
    ctx.restore();
  }
  function drawWall(o) {
    const x = o.x, y = o.y, w = o.w, h = o.h;
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#48475f'); g.addColorStop(.45, '#7e7285'); g.addColorStop(1, '#45465f');
    const tip = o.top ? y + h : y;
    if (o.top) polygon([[x + 6, 0], [x + w - 7, 0], [x + w, h - 25], [x + w - 14, h - 3], [x + 40, h - 9], [x + 16, h], [x, h - 23]], g);
    else polygon([[x, 640], [x, y + 27], [x + 18, y], [x + 40, y + 8], [x + w - 17, y + 2], [x + w, y + 22], [x + w - 6, 640]], g);
    polygon([[x + 10, o.top ? 0 : 640], [x + 23, tip + (o.top ? -13 : 14)], [x + 37, tip + (o.top ? -9 : 12)], [x + 31, o.top ? 0 : 640]], '#b4a0a023');
    for (let i = 0; i < Math.floor(h / 65); i++) { const cy = o.top ? tip - 28 - i * 65 : tip + 30 + i * 65; pathLine([[x + 8, cy - 8], [x + 38, cy], [x + 27, cy + 19]], '#302f494a', 2); }
    pathLine([[x + 18, tip + (o.top ? -2 : 3)], [x + 39, tip + (o.top ? -8 : 8)], [x + 58, tip + (o.top ? -3 : 3)]], '#c1a3a280', 2);
  }
  function drawBomb(o) {
    if (o.warning > 0) {
      ctx.save(); ctx.strokeStyle = '#ff9a7950'; ctx.lineWidth = 2; ctx.setLineDash([8, 10]); pathLine([[o.x, 60], [o.x, 602]], '#ff997866', 2); ctx.setLineDash([]);
      const cy = 70; ellipse(o.x, cy, 22, 22, '#6c3d49aa'); ctx.strokeStyle = '#ffb08a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(o.x, cy, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (o.warning / 1.25)); ctx.stroke();
      ctx.font = 'bold 23px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe1c0'; ctx.fillText('!', o.x, cy + 8); ctx.restore(); return;
    }
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.sin(o.age * 3) * .15);
    ellipse(0, 0, 23, 23, '#232b40'); ctx.strokeStyle = '#dd806e'; ctx.lineWidth = 2; ctx.stroke();
    ellipse(-6, -6, 9, 11, '#4d4d63', -.6); polygon([[-13, -17], [8, -21], [11, -14], [-9, -10]], '#e88068');
    ctx.fillStyle = '#756b78'; ctx.fillRect(-6, -29, 12, 8);
    pathLine([[0, -28], [5, -35], [13, -36], [16, -44]], '#e3b98c', 3);
    star(16, -44, 5 + Math.sin(visualTime * 15) * 1.5, '#ffcf85', visualTime);
    ctx.fillStyle = '#f5ae88'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('×', 1, 7); ctx.restore();
  }
  function drawPickup(o) {
    const bob = Math.sin(visualTime * 3 + o.phase) * 3;
    if (o.kind === 'star') { ellipse(o.x, o.y + bob, 21, 21, '#ffd68110'); star(o.x, o.y + bob, 12.5, '#ffd88b', Math.sin(visualTime * 2 + o.phase) * .13); star(o.x - 2, o.y + bob - 2, 5, '#fff3bf'); }
    else {
      const pts = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; pts.push([o.x + Math.cos(a) * 19, o.y + bob + Math.sin(a) * 19]); }
      ellipse(o.x, o.y + bob, 26, 26, '#60ecd91b'); polygon(pts, '#1e5e6b'); ctx.strokeStyle = '#81f2db'; ctx.lineWidth = 2; ctx.stroke();
      polygon([[o.x - 7, o.y + bob - 7], [o.x + 7, o.y + bob - 7], [o.x + 5, o.y + bob + 4], [o.x, o.y + bob + 9], [o.x - 5, o.y + bob + 4]], '#a0f6df');
    }
  }
  function drawIdle() {
    const mobile = width < 700;
    const x = mobile ? width * .29 : width * .73, y = mobile ? 500 : 290;
    ctx.save(); ctx.strokeStyle = '#f8d9bf29'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 8]); ctx.beginPath();
    ctx.moveTo(x - 170, y + 40); ctx.bezierCurveTo(x - 70, y + 90, x - 110, y - 70, x + 10, y); ctx.bezierCurveTo(x + 80, y + 50, x + 95, y - 85, x + 190, y - 65); ctx.stroke(); ctx.restore();
    drawBird(x, y + (reduced ? 0 : Math.sin(visualTime * 1.8) * 13), mobile ? 1.45 : 2.15, -.12, Math.sin(visualTime * 8) * .3);
    for (let i = 0; i < 3; i++) star(x + 90 + i * 34, y - 50 - Math.sin(i) * 18, 6.5, '#ffdfa094', .2);
    if (!mobile) { drawEagle({ x: width * .93, y: 137 + Math.sin(visualTime) * 9, age: visualTime * .4, phase: 0 }); drawRock({ x: width * .91, y: 445 + Math.sin(visualTime) * 4, age: visualTime * .1, phase: 2, r: 30 }); }
  }
  function render(dt) {
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / 640, 0, 0);
    ctx.save();
    if (shake > .2 && !reduced) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= Math.pow(.02, dt); }
    drawSky();
    if (engine.status === 'ready') drawIdle();
    else {
      engine.pickups.forEach(drawPickup);
      for (const o of engine.obstacles) {
        if (o.x > width + 85 || o.x < -100) continue;
        if (o.kind === 'wall') drawWall(o); else if (o.kind === 'eagle') drawEagle(o); else if (o.kind === 'rock') drawRock(o); else drawBomb(o);
      }
      const p = engine.player;
      if (engine.status !== 'over') {
        if (engine.dash > 0) {
          for (let i = 5; i > 0; i--) { ctx.globalAlpha = (6 - i) * .055; drawBird(p.x - i * 20, p.y + i * 1.5, 1, -.12, p.wing); }
          ctx.globalAlpha = 1; pathLine([[p.x - 130, p.y], [p.x - 35, p.y]], '#83ffe770', 3);
        }
        ctx.globalAlpha = engine.invulnerable > 0 ? .65 : 1;
        drawBird(p.x, p.y, 1, clamp(p.vy / 750, -.4, .55), p.wing, engine.shield > 0 || engine.dash > 0); ctx.globalAlpha = 1;
      }
    }
    for (const p of particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt;
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ellipse(p.x, p.y, p.r, p.r, p.color);
    }
    particles = particles.filter(p => p.life > 0); ctx.globalAlpha = 1;
    for (const f of floaters) { f.life -= dt; f.y -= 25 * dt; ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = f.color; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); }
    floaters = floaters.filter(f => f.life > 0); ctx.globalAlpha = 1;
    if (flash > 0) { flash = Math.max(0, flash - dt); ctx.fillStyle = '#ffad7d'; ctx.globalAlpha = flash; ctx.fillRect(0, 0, width, 640); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function frame(timestamp) {
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0; lastFrame = timestamp; visualTime += dt;
    if (engine.status === 'playing') {
      accumulator += dt;
      while (accumulator >= 1 / 120) { engine.update(1 / 120, held || flapKeys.size > 0); accumulator -= 1 / 120; }
      camera += engine.speed * dt; updateHUD();
    } else { accumulator = 0; if (engine.status === 'ready' && !reduced) camera += 18 * dt; }
    if (engine.status === 'over' && !overPresented && visualTime - deadAt > .48) presentResult();
    if (visualTime > messageUntil) $('runMessage').classList.remove('show');
    render(dt); requestAnimationFrame(frame);
  }
  const scores=mountScores({game:'flight',host:shell,anchor:document.querySelector('.underbar'),pause:()=>pause({focus:false})});
  $('startButton').addEventListener('click', () => start(false));
  $('dailyButton').addEventListener('click', () => start(true));
  $('retryButton').addEventListener('click', () => { if (engine.status === 'over' && overPresented) start(daily, true); });
  $('homeButton').addEventListener('click', home); $('pauseHomeButton').addEventListener('click', home);
  $('pauseButton').addEventListener('click', pause); $('resumeButton').addEventListener('click', resume);
  $('helpButton').addEventListener('click', showHelp); $('closeHelpButton').addEventListener('click', closeHelp);
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => chooseMode(b.dataset.mode)));
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0 || pointerId !== null || engine.status !== 'playing') return;
    e.preventDefault(); pointerId = e.pointerId; held = true; audioUnlock(); engine.flap(); canvas.focus({ preventScroll: true });
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  function releasePointer(e) { if (e.pointerId === pointerId) { held = false; pointerId = null; } }
  window.addEventListener('pointerup', releasePointer); window.addEventListener('pointercancel', releasePointer); canvas.addEventListener('lostpointercapture', releasePointer);
  $('dashButton').addEventListener('pointerdown', e => { e.preventDefault(); if (engine.status === 'playing') { audioUnlock(); engine.activateDash(); } });
  $('dashButton').addEventListener('click', e => { if (e.detail === 0) engine.activateDash(); });
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || externalPanel() || e.target.isContentEditable) return;
    if (e.code === 'Tab') {
      const modal = ['helpScreen', 'pauseScreen', 'overScreen'].map($).find(el => !el.hidden);
      if (modal) {
        const targets = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]'));
        const first = targets[0], last = targets[targets.length - 1];
        if (first && e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (first && !e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const flap = ['Space', 'ArrowUp', 'KeyW'].includes(e.code);
    if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) {
      e.preventDefault();
      if (!$('helpScreen').hidden) closeHelp(); else if (engine.status === 'playing') pause(); else if (engine.status === 'paused') resume();
      return;
    }
    if (engine.status === 'playing' && (flap || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyD')) {
      e.preventDefault(); if (e.repeat) return; audioUnlock();
      if (flap) { flapKeys.add(e.code); engine.flap(); } else engine.activateDash();
    } else if (engine.status === 'ready' && flap && e.target === canvas && !e.repeat) { e.preventDefault(); start(false); }
    else if (engine.status === 'over' && e.code === 'KeyR' && overPresented && !e.repeat) { e.preventDefault(); start(daily, true); }
  });
  document.addEventListener('keyup', e => flapKeys.delete(e.code));
  const checkPanels = () => { if (externalPanel()) pause({focus: false}); };
  const panelObserver = new MutationObserver(checkPanels);
  panelObserver.observe(document.body, {attributes: true, subtree: true, attributeFilter: ['class', 'open']});
  document.addEventListener('toggle', checkPanels, true);
  window.addEventListener('blur', () => { held = false; flapKeys.clear(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { held = false; flapKeys.clear(); pause(); } lastFrame = 0; });
  function soundButton() { $('soundButton').setAttribute('aria-pressed', String(!muted)); $('soundButton').setAttribute('aria-label', muted ? 'Bật âm thanh' : 'Tắt âm thanh'); $('soundButton').title = muted ? 'Bật âm thanh' : 'Tắt âm thanh'; $('soundButton').style.opacity = muted ? '.5' : '1'; }
  $('soundButton').addEventListener('click', () => { muted = !muted; audioUnlock(); soundButton(); persist(); if (!muted) tone(660, .09); });
  $('motionCheckbox').checked = reduced;
  $('motionCheckbox').addEventListener('change', e => { reduced = e.target.checked; document.body.classList.toggle('reduced-motion', reduced); persist(); });
  document.body.classList.toggle('reduced-motion', reduced); soundButton();
  if (!shell.requestFullscreen && !shell.webkitRequestFullscreen) $('fullscreenButton').hidden = true;
  $('fullscreenButton').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
      else await (shell.requestFullscreen ? shell.requestFullscreen() : shell.webkitRequestFullscreen());
    } catch (_) { message('Trình duyệt chưa cho phép toàn màn hình.'); }
  });
  document.addEventListener('fullscreenchange', resize); document.addEventListener('webkitfullscreenchange', resize);
  $('shareButton').addEventListener('click', async () => {
    const url = 'https://nguyencongnghe.com/flappy-bird/' + (daily ? '?challenge=' + challengeDate : '');
    const text = 'Mình vừa đạt ' + bestThisRun + ' điểm trong Bay Đi Đừng Cáu (' + (daily ? 'đường bay ' + challengeDate : MODES[mode].name) + '). Bạn bay được bao xa?';
    try {
      if (navigator.share) { await navigator.share({ title: 'Bay Đi Đừng Cáu · NCN Arcade', text, url }); $('shareStatus').textContent = 'Đã mở chia sẻ.'; }
      else if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text + '\n' + url); $('shareStatus').textContent = 'Đã sao chép điểm và đường dẫn.'; }
      else $('shareStatus').textContent = text + ' ' + url;
    } catch (err) { if (err.name !== 'AbortError') $('shareStatus').textContent = text + ' ' + url; }
  });
  if (sharedDate()) $('dailyButton').querySelector('small').textContent = 'Lời thách đấu · ' + sharedDate();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(shell); else window.addEventListener('resize', resize);
  resize(); chooseMode('normal'); requestAnimationFrame(frame);
})();
