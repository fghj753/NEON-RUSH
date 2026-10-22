/* NEON RUSH 3D: pure HTML5 Canvas, custom 3D engine, no libraries. */
'use strict';
(() => {
  // ================= DOM =================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const bloomA = document.createElement('canvas');
  const bloomB = document.createElement('canvas');
  const bA = bloomA.getContext('2d');
  const bB = bloomB.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('hud'), score: $('score'), bestHud: $('best-hud'), mult: $('mult'), speed: $('speed'),
    shield: $('shield'), zone: $('zone'), banner: $('zone-banner'), hint: $('hint'),
    menu: $('menu'), pause: $('pause'), over: $('over'), bestMenu: $('best-menu'),
    finalScore: $('final-score'), finalDist: $('final-dist'), finalCrystals: $('final-crystals'),
    finalBest: $('final-best'), newRecord: $('new-record'), flash: $('flash'), mute: $('mute-btn'),
    play: $('play-btn'), resume: $('resume-btn'), restart: $('restart-btn'), menuBtn: $('menu-btn'),
  };

  // ================= Utils =================
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mulC = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const WHITE = [255, 255, 255];
  const storage = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  // ================= Palettes / zones =================
  const ZONES = [
    { name: 'SYNTHWAVE',   skyTop: [10, 2, 30], skyMid: [62, 8, 92],  skyHor: [255, 70, 150], sunA: [255, 236, 110], sunB: [255, 40, 150], grid: [255, 50, 210], ground: [10, 2, 24], accent: [0, 240, 255],  block: [255, 45, 150], mtn: [40, 8, 72],  gem: [255, 220, 80] },
    { name: 'CYBER OCEAN', skyTop: [0, 4, 24],  skyMid: [0, 32, 86],  skyHor: [0, 190, 255],  sunA: [210, 255, 255], sunB: [0, 110, 255],  grid: [0, 210, 255],  ground: [0, 6, 20],  accent: [255, 220, 60], block: [40, 140, 255], mtn: [0, 30, 72],  gem: [255, 90, 200] },
    { name: 'INFERNO',     skyTop: [16, 0, 4],  skyMid: [92, 8, 16],  skyHor: [255, 110, 20], sunA: [255, 250, 190], sunB: [255, 50, 0],   grid: [255, 90, 30],  ground: [16, 2, 2],  accent: [255, 240, 140], block: [255, 60, 40], mtn: [72, 10, 10], gem: [120, 255, 255] },
    { name: 'TOXIC',       skyTop: [2, 12, 6],  skyMid: [10, 52, 30], skyHor: [120, 255, 90], sunA: [240, 255, 180], sunB: [40, 220, 120], grid: [90, 255, 120], ground: [2, 12, 6],  accent: [255, 60, 220], block: [60, 255, 140], mtn: [10, 50, 30], gem: [255, 240, 90] },
    { name: 'ULTRAVIOLET', skyTop: [6, 0, 20],  skyMid: [42, 0, 84],  skyHor: [170, 80, 255], sunA: [255, 205, 255], sunB: [140, 40, 255], grid: [180, 90, 255], ground: [6, 0, 16],  accent: [80, 255, 230], block: [190, 70, 255], mtn: [30, 0, 62],  gem: [255, 230, 90] },
  ];
  const ZONE_LEN = 1600;
  const P = {};
  function updatePalette(dist) {
    const zf = dist / ZONE_LEN;
    const i = Math.floor(zf);
    const t = clamp((zf - i - 0.88) / 0.12, 0, 1);
    const s = t * t * (3 - 2 * t);
    const A = ZONES[i % ZONES.length], B = ZONES[(i + 1) % ZONES.length];
    for (const k in A) if (k !== 'name') P[k] = mixC(A[k], B[k], s);
    P.name = A.name;
  }
  updatePalette(0);

  // ================= Meshes =================
  function makeMesh(verts, faces) {
    const c = [0, 0, 0];
    for (const v of verts) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; }
    c[0] /= verts.length; c[1] /= verts.length; c[2] /= verts.length;
    const oriented = faces.map((f) => {
      const a = verts[f[0]], b = verts[f[1]], d = verts[f[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const m = [0, 0, 0];
      for (const i of f) { m[0] += verts[i][0]; m[1] += verts[i][1]; m[2] += verts[i][2]; }
      m[0] = m[0] / f.length - c[0]; m[1] = m[1] / f.length - c[1]; m[2] = m[2] / f.length - c[2];
      return n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0 ? f.slice().reverse() : f;
    });
    return { verts, faces: oriented, w: verts.map(() => [0, 0, 0]), c: verts.map(() => [0, 0, 0]) };
  }
  const CUBE = makeMesh(
    [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5], [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]],
    [[0, 1, 2, 3], [4, 5, 6, 7], [0, 4, 7, 3], [1, 5, 6, 2], [3, 2, 6, 7], [0, 1, 5, 4]]
  );
  const OCTA = makeMesh(
    [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 3, 4], [4, 3, 1], [1, 3, 5], [5, 3, 0]]
  );
  const SHIP = makeMesh(
    [[0, .05, 1.7], [-1.25, -.05, -.55], [1.25, -.05, -.55], [0, .5, -.15], [0, -.25, -.2], [0, .32, -.8], [-.45, .05, -.85], [.45, .05, -.85]],
    [[3, 0, 1], [3, 1, 6], [3, 6, 5], [3, 5, 7], [3, 7, 2], [3, 2, 0], [4, 0, 1], [4, 1, 6], [4, 6, 7], [4, 7, 2], [4, 2, 0], [6, 5, 7]]
  );

  // ================= Camera & projection =================
  const cam = { x: 0, y: 3.1, z: -7.5, pitch: 0.13, roll: 0, fovK: 1 };
  const cP = Math.cos(cam.pitch), sP = Math.sin(cam.pitch);
  const NEAR = 0.4, FAR = 230;
  let W = 0, H = 0, DPR = 1, F = 1, maxDPR = 1.75;
  const tmpA = [0, 0, 0], tmpB = [0, 0, 0];

  function toCam(x, y, z, out) {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    out[0] = dx; out[1] = dy * cP + dz * sP; out[2] = -dy * sP + dz * cP;
    return out;
  }
  function proj(x, y, z, out) {
    toCam(x, y, z, out);
    if (out[2] < NEAR) return false;
    const f = F * cam.fovK;
    out[0] = W / 2 + (out[0] * f) / out[2];
    out[1] = H / 2 - (out[1] * f) / out[2];
    return true;
  }

  // ================= Background data =================
  const stars = Array.from({ length: 190 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.8, 2.2), b: rand(0.3, 1), sp: rand(1, 4), ph: rand(0, TAU) }));
  let mountains = [];
  function buildMountains() {
    mountains = [0, 1].map((layer) => {
      const N = 90, pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        let h = Math.abs(Math.sin(u * Math.PI * 3.2 + layer * 2.1)) * 0.5 + Math.abs(Math.sin(u * Math.PI * 8.1 + layer)) * 0.3 + Math.random() * 0.2;
        const c = Math.abs(u - 0.5) * 2;
        h *= 0.25 + 0.75 * Math.min(1, c * 1.5);
        pts.push(h);
      }
      return pts;
    });
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, maxDPR);
    W = Math.max(1, Math.floor(window.innerWidth * DPR));
    H = Math.max(1, Math.floor(window.innerHeight * DPR));
    canvas.width = W; canvas.height = H;
    bloomA.width = Math.max(1, W >> 2); bloomA.height = Math.max(1, H >> 2);
    bloomB.width = Math.max(1, W >> 3); bloomB.height = Math.max(1, H >> 3);
    const fov = 66 * Math.PI / 180;
    F = (H / 2) / Math.tan(fov / 2);
    if (W / H < 0.85) F = (W / 2) / Math.tan(fov / 2) * 1.05; // portrait: keep all lanes visible
    buildMountains();
  }
  window.addEventListener('resize', resize);
  resize();

  // ================= Game state =================
  const LANES = [-2.2, 0, 2.2];
  const BASE_Y = 0.55, GRAV = 24, JUMP_V = 10.5, START_SPEED = 24, MAX_SPEED = 64;
  let state = 'menu';
  let time = 0, runTime = 0, distance = 0, speed = 18;
  let distScore = 0, bonus = 0, crystals = 0, streak = 0, mult = 1;
  let best = parseInt(storage.get('neonrush_best', '0'), 10) || 0;
  let shield = false, invuln = 0, shake = 0, deathTimer = 0, overGuard = 0;
  let nextSpawn = 0, lastRow = '', zoneIdx = 0, lastLaneChange = -10;
  const player = { lane: 0, x: 0, tx: 0, y: BASE_Y, vy: 0, vx: 0, grounded: true, drop: false, bob: 0 };
  const obstacles = [];
  const particles = [];
  const popups = [];
  const streaks = Array.from({ length: 46 }, () => newStreak(true));
  function newStreak(init) {
    const side = Math.random() < 0.5 ? -1 : 1;
    return { x: side * rand(4.5, 16), y: rand(0.3, 9), z: init ? rand(0, FAR) : rand(FAR * 0.5, FAR), len: rand(3, 9) };
  }

  // ================= Audio (WebAudio synth, no files) =================
  const Sound = {
    ac: null, master: null, music: null, sfx: null, delay: null, bassF: null, noiseBuf: null,
    muted: storage.get('neonrush_muted', '0') === '1', on: false, next: 0, step: 0, bpm: 112,
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = (this.ac = new AC());
      this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.55;
      const comp = ac.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(ac.destination);
      this.music = ac.createGain(); this.music.gain.value = 0.3; this.music.connect(this.master);
      this.sfx = ac.createGain(); this.sfx.gain.value = 0.7; this.sfx.connect(this.master);
      this.bassF = ac.createBiquadFilter(); this.bassF.type = 'lowpass'; this.bassF.frequency.value = 700; this.bassF.connect(this.music);
      this.delay = ac.createDelay(1); this.delay.delayTime.value = (60 / this.bpm) * 0.75;
      const fb = ac.createGain(); fb.gain.value = 0.38; this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.music);
      const len = ac.sampleRate;
      this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    },
    setMuted(m) {
      this.muted = m; storage.set('neonrush_muted', m ? '1' : '0');
      ui.mute.classList.toggle('off', m);
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ac.currentTime, 0.05);
    },
    osc(type, freq, t, dur, vol, dest, slide) {
      const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, type, freq, dest) {
      const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.05);
    },
    startMusic() { if (!this.ac) return; this.on = true; this.next = this.ac.currentTime + 0.06; this.step = 0; },
    stopMusic() { this.on = false; },
    tick() {
      if (!this.ac || !this.on) return;
      const spb = 60 / this.bpm / 4;
      if (this.next < this.ac.currentTime - 0.5) this.next = this.ac.currentTime + 0.02;
      while (this.next < this.ac.currentTime + 0.15) { this.playStep(this.step, this.next); this.next += spb; this.step++; }
    },
    playStep(s, t) {
      const bar = Math.floor(s / 16) % 4, st = s % 16;
      const roots = [45, 41, 48, 43];
      const chords = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]];
      const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
      if (st % 4 === 0) this.osc('sine', 150, t, 0.28, 0.9, this.music, 38);
      if (st % 4 === 2) this.noise(t, 0.05, 0.22, 'highpass', 7500, this.music);
      if (st === 4 || st === 12) { this.noise(t, 0.2, 0.32, 'bandpass', 1800, this.music); this.osc('triangle', 190, t, 0.1, 0.15, this.music, 120); }
      if (st % 2 === 0) this.osc('sawtooth', mf(roots[bar] + (st % 4 === 2 ? 12 : 0)), t, 0.2, 0.32, this.bassF);
      const order = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
      const n = chords[bar][order[st]] + 12;
      this.osc('square', mf(n), t, 0.11, 0.035, this.delay);
      this.osc('square', mf(n), t, 0.11, 0.045, this.music);
      if (st === 0) for (const m of chords[bar]) this.osc('triangle', mf(m), t, (60 / this.bpm) * 4, 0.035, this.music);
    },
    play(name) {
      if (!this.ac) return;
      const t = this.ac.currentTime, d = this.sfx;
      switch (name) {
        case 'gem': this.osc('sine', 1046 + streak * 18, t, 0.16, 0.35, d, 2093 + streak * 30); this.osc('triangle', 1568, t + 0.03, 0.12, 0.15, d); break;
        case 'jump': this.osc('sine', 260, t, 0.22, 0.3, d, 720); break;
        case 'lane': this.noise(t, 0.07, 0.15, 'highpass', 3000, d); break;
        case 'land': this.noise(t, 0.08, 0.2, 'lowpass', 600, d); break;
        case 'near': this.osc('sawtooth', 600, t, 0.18, 0.12, d, 1400); break;
        case 'shield': [523, 659, 784, 1046].forEach((f, i) => this.osc('triangle', f, t + i * 0.06, 0.2, 0.25, d)); break;
        case 'break': this.osc('square', 700, t, 0.4, 0.25, d, 120); this.noise(t, 0.35, 0.5, 'bandpass', 1200, d); break;
        case 'crash': this.noise(t, 1.1, 0.9, 'lowpass', 900, d); this.osc('sawtooth', 140, t, 0.8, 0.5, d, 28); break;
        case 'zone': [440, 554, 659, 880, 1108].forEach((f, i) => this.osc('square', f, t + i * 0.07, 0.25, 0.12, d)); break;
        default: break;
      }
    },
  };
  ui.mute.classList.toggle('off', Sound.muted);

  // ================= Particles & popups =================
  function emit(x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      const s = o.spread ?? 4;
      particles.push({
        x, y, z,
        vx: (o.vx ?? 0) + rand(-1, 1) * s, vy: (o.vy ?? 0) + rand(-1, 1) * s * (o.flatY ?? 1), vz: (o.vz ?? 0) + rand(-1, 1) * s,
        life: (o.life ?? 0.6) * rand(0.6, 1.2), max: o.life ?? 0.6, size: (o.size ?? 0.12) * rand(0.6, 1.4),
        color: o.color || WHITE, grav: o.grav ?? 0, world: o.world ?? true,
      });
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
  }
  function popup(text, color, big) {
    if (!proj(player.x, player.y + 1.4, 0, tmpA)) return;
    popups.push({ text, color, x: tmpA[0] + rand(-20, 20) * DPR, y: tmpA[1], life: 1, big: !!big });
  }
  function flash() { ui.flash.classList.remove('on'); void ui.flash.offsetWidth; ui.flash.classList.add('on'); }
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  // ================= Spawning =================
  function spawnRow(z) {
    const d = clamp(runTime / 150, 0, 1);
    if (lastRow !== 'bar' && Math.random() < 0.15 + d * 0.08) {
      obstacles.push({ kind: 'bar', x: 0, z, h: 0.95, ph: Math.random() * TAU });
      if (Math.random() < 0.75) {
        const lx = LANES[randInt(0, 2)];
        for (let i = -1; i <= 1; i++) obstacles.push({ kind: 'gem', x: lx, y: 3.0 - Math.abs(i) * 0.55, z: z + i * 2.6, rot: Math.random() * TAU });
      }
      lastRow = 'bar';
      return 6;
    }
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const count = Math.random() < 0.3 + d * 0.45 ? 2 : 1;
    for (let i = 0; i < count; i++) obstacles.push({ kind: 'block', x: LANES[lanes[i]], z, h: rand(3, 5.5), w: 1.7 });
    const free = lanes.slice(count);
    if (!shield && Math.random() < 0.035 + d * 0.025) {
      obstacles.push({ kind: 'shield', x: LANES[free[0]], y: 1.3, z, rot: 0 });
    } else if (Math.random() < 0.68) {
      const lx = LANES[free[randInt(0, free.length - 1)]];
      for (let i = 0; i < 3; i++) obstacles.push({ kind: 'gem', x: lx, y: 1.25, z: z - 1.5 - i * 2.4, rot: Math.random() * TAU });
    }
    lastRow = 'block';
    return 0;
  }

  // ================= Game flow =================
  function setScreen(name) {
    ui.menu.classList.toggle('hidden', name !== 'menu');
    ui.pause.classList.toggle('hidden', name !== 'pause');
    ui.over.classList.toggle('hidden', name !== 'over');
    ui.hud.classList.toggle('hidden', !(name === 'play' || name === 'pause'));
  }
  function startGame() {
    Sound.init(); Sound.startMusic();
    obstacles.length = 0; particles.length = 0; popups.length = 0;
    state = 'playing'; runTime = 0; distance = 0; speed = START_SPEED;
    distScore = 0; bonus = 0; crystals = 0; streak = 0; mult = 1;
    shield = false; invuln = 0; shake = 0;
    player.lane = 0; player.tx = 0; player.y = BASE_Y; player.vy = 0; player.grounded = true; player.drop = false;
    nextSpawn = 70; lastRow = ''; zoneIdx = 0;
    updatePalette(0);
    ui.zone.textContent = 'ЗОНА 1 · ' + ZONES[0].name;
    ui.shield.classList.add('hidden');
    ui.bestHud.textContent = 'РЕКОРД ' + best;
    ui.hint.classList.remove('hidden');
    ui.hint.style.animation = 'none'; void ui.hint.offsetWidth; ui.hint.style.animation = '';
    setScreen('play');
  }
  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused'; Sound.stopMusic(); setScreen('pause');
  }
  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing'; Sound.init(); Sound.startMusic(); setScreen('play');
  }
  function toMenu() { state = 'menu'; obstacles.length = 0; Sound.stopMusic(); ui.bestMenu.textContent = best; setScreen('menu'); }
  function die() {
    state = 'dying'; deathTimer = 1.4; shake = 1.3; flash();
    Sound.play('crash'); Sound.stopMusic();
    emit(player.x, player.y, 0, 140, { spread: 9, life: 1.4, size: 0.16, color: P.accent, grav: 6 });
    emit(player.x, player.y, 0, 90, { spread: 6, life: 1.1, size: 0.22, color: P.block, grav: 4 });
    emit(player.x, player.y, 0, 50, { spread: 3, life: 0.8, size: 0.35, color: WHITE });
  }
  function gameOver() {
    state = 'over'; overGuard = 0.6;
    const score = Math.floor(distScore + bonus);
    const record = score > best;
    if (record) { best = score; storage.set('neonrush_best', String(best)); }
    ui.finalScore.textContent = score.toLocaleString('ru-RU');
    ui.finalDist.textContent = Math.floor(distance).toLocaleString('ru-RU') + ' м';
    ui.finalCrystals.textContent = crystals;
    ui.finalBest.textContent = best.toLocaleString('ru-RU');
    ui.newRecord.classList.toggle('hidden', !record);
    setScreen('over');
  }
  function hit(o) {
    if (invuln > 0) return;
    if (shield) {
      shield = false; invuln = 1.3; o.dead = true; shake = 0.8; streak = 0; flash();
      ui.shield.classList.add('hidden');
      emit(o.x, (o.h || 1) * 0.5, o.z - distance, 90, { spread: 8, life: 1, size: 0.18, color: P.block, grav: 5 });
      popup('ЩИТ РАЗБИТ!', P.accent, true); Sound.play('break');
      return;
    }
    die();
  }

  // ================= Input =================
  function moveLane(dir) {
    if (state !== 'playing') return;
    const nl = clamp(player.lane + dir, -1, 1);
    if (nl === player.lane) return;
    player.lane = nl; player.tx = LANES[nl + 1]; lastLaneChange = time; Sound.play('lane');
  }
  function jump() {
    if (state !== 'playing' || !player.grounded) return;
    player.vy = JUMP_V; player.grounded = false; player.drop = false; Sound.play('jump');
    emit(player.x, 0.1, 0, 18, { spread: 2.5, flatY: 0.3, life: 0.5, size: 0.1, color: P.accent });
  }
  function drop() { if (state === 'playing' && !player.grounded) { player.drop = true; if (player.vy > 0) player.vy = 0; } }

  window.addEventListener('keydown', (e) => {
    const k = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
    if (e.repeat && k !== 'ArrowDown' && k !== 'KeyS') return;
    if (k === 'KeyM') { Sound.init(); Sound.setMuted(!Sound.muted); return; }
    if (state === 'menu' && (k === 'Enter' || k === 'Space')) { startGame(); return; }
    if (state === 'over' && overGuard <= 0 && (k === 'Enter' || k === 'Space')) { startGame(); return; }
    if (k === 'KeyP' || k === 'Escape') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); return; }
    if (state === 'paused' && (k === 'Enter' || k === 'Space')) { resumeGame(); return; }
    if (k === 'ArrowLeft' || k === 'KeyA') moveLane(-1);
    else if (k === 'ArrowRight' || k === 'KeyD') moveLane(1);
    else if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') jump();
    else if (k === 'ArrowDown' || k === 'KeyS') drop();
  });

  let touch = null;
  window.addEventListener('touchstart', (e) => {
    if (e.target.closest && e.target.closest('button')) return;
    const t = e.changedTouches[0]; touch = { x: t.clientX, y: t.clientY, t: performance.now(), used: false };
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!touch || touch.used) return;
    const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 28) {
      touch.used = true;
      if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else drop();
    }
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (touch && !touch.used && performance.now() - touch.t < 300) {
      if (state === 'playing') jump();
      else if (state === 'menu') startGame();
      else if (state === 'over' && overGuard <= 0) startGame();
    }
    touch = null;
  }, { passive: true });

  ui.play.addEventListener('click', startGame);
  ui.restart.addEventListener('click', startGame);
  ui.resume.addEventListener('click', resumeGame);
  ui.menuBtn.addEventListener('click', toMenu);
  ui.mute.addEventListener('click', (e) => { e.stopPropagation(); Sound.init(); Sound.setMuted(!Sound.muted); ui.mute.blur(); });
  window.addEventListener('blur', pauseGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  ui.bestMenu.textContent = best;

  // ================= Update =================
  function update(dt) {
    time += dt;
    const sdt = state === 'dying' ? dt * 0.35 : dt;
    if (state === 'playing') { runTime += dt; speed = lerp(START_SPEED, MAX_SPEED, 1 - Math.exp(-runTime / 80)); }
    else if (state === 'dying' || state === 'over') speed = Math.max(0, speed - speed * 2.5 * dt);
    else if (state === 'menu') speed = lerp(speed, 20, Math.min(1, dt * 2));
    distance += speed * sdt;
    updatePalette(distance);

    if (state === 'playing') {
      const zi = Math.floor(distance / ZONE_LEN);
      if (zi !== zoneIdx) {
        zoneIdx = zi;
        const name = ZONES[zi % ZONES.length].name;
        bonus += 500 * mult;
        ui.zone.textContent = 'ЗОНА ' + (zi + 1) + ' · ' + name;
        ui.banner.innerHTML = 'ЗОНА ' + (zi + 1) + '<small>' + name + ' · +' + 500 * mult + '</small>';
        ui.banner.classList.remove('show'); void ui.banner.offsetWidth; ui.banner.classList.add('show');
        Sound.play('zone');
      }
      while (nextSpawn < distance + FAR) nextSpawn += rand(13, 18) - clamp(runTime / 150, 0, 1) * 3 + spawnRow(nextSpawn);
    }

    // player
    if (state === 'menu') player.tx = Math.sin(time * 0.7) * 1.9;
    const px = player.x;
    if (state !== 'dying' && state !== 'over') player.x += (player.tx - player.x) * Math.min(1, sdt * 13);
    player.vx = sdt > 0 ? (player.x - px) / sdt : 0;
    if (!player.grounded) {
      player.vy -= GRAV * (player.drop ? 2.8 : 1) * sdt;
      player.y += player.vy * sdt;
      if (player.y <= BASE_Y) {
        player.y = BASE_Y; player.vy = 0; player.grounded = true; player.drop = false;
        Sound.play('land');
        emit(player.x, 0.1, 0.3, 22, { spread: 3, flatY: 0.25, life: 0.45, size: 0.1, color: P.grid });
      }
    }
    player.bob = Math.sin(time * 6) * 0.06;
    if (state === 'playing' || state === 'menu') {
      for (const s of [-0.32, 0.32]) {
        emit(player.x + s * 1.15, player.y + player.bob + 0.04, -0.8, 1, { spread: 0.2, vz: -14, world: false, life: 0.26, size: 0.11, color: mixC(P.accent, WHITE, 0.3) });
      }
    }

    // camera
    const k = Math.min(1, dt * 5);
    cam.x = lerp(cam.x, player.x * 0.55, k);
    cam.y = lerp(cam.y, 3.0 + (player.y - BASE_Y) * 0.45, k);
    cam.roll = lerp(cam.roll, clamp(-player.vx * 0.005, -0.12, 0.12), k);
    cam.fovK = lerp(cam.fovK, 1 - clamp((speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1) * 0.16, Math.min(1, dt * 2));

    // obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      const rel = o.z - distance;
      if (o.rot !== undefined) o.rot += sdt * 2.6;
      if (o.dead || rel < cam.z - 3) { obstacles.splice(i, 1); continue; }
      if (state !== 'playing') continue;
      const dx = Math.abs(o.x - player.x);
      if (o.kind === 'block') {
        if (Math.abs(rel) < 1.45 && dx < 1.4 && player.y - 0.3 < o.h) hit(o);
        else if (!o.passed && rel < -1.5) {
          o.passed = true;
          if (dx < 2.7 && time - lastLaneChange < 0.35) {
            bonus += 50 * mult; popup('ВПРИТЫК! +' + 50 * mult, P.accent); Sound.play('near');
          }
        }
      } else if (o.kind === 'bar') {
        if (Math.abs(rel) < 1.1 && player.y - 0.3 < o.h) hit(o);
        else if (!o.passed && rel < -1.2) { o.passed = true; bonus += 20 * mult; }
      } else if (o.kind === 'gem') {
        if (!o.taken && Math.abs(rel) < 1.4 && dx < 1.25 && Math.abs(o.y - player.y) < 1.5) {
          o.taken = true; o.dead = true; crystals++; streak++;
          const nm = Math.min(10, 1 + Math.floor(streak / 6));
          if (nm > mult) { popup('МНОЖИТЕЛЬ x' + nm, P.gem, true); bump(ui.mult); }
          mult = nm;
          bonus += 25 * mult;
          emit(o.x, o.y, rel, 26, { spread: 5, life: 0.6, size: 0.12, color: P.gem });
          Sound.play('gem');
        } else if (!o.passed && rel < -1.6) {
          o.passed = true;
          if (!o.taken) { streak = Math.max(0, streak - 3); mult = Math.min(10, 1 + Math.floor(streak / 6)); }
        }
      } else if (o.kind === 'shield') {
        if (Math.abs(rel) < 1.4 && dx < 1.3 && Math.abs(o.y - player.y) < 1.7) {
          o.dead = true; shield = true; ui.shield.classList.remove('hidden');
          popup('ЩИТ!', [120, 255, 180], true); Sound.play('shield');
          emit(o.x, o.y, rel, 40, { spread: 6, life: 0.7, size: 0.14, color: [120, 255, 180] });
        }
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= sdt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy -= p.grav * sdt;
      p.x += p.vx * sdt; p.y += p.vy * sdt; p.z += (p.vz - (p.world ? speed : 0)) * sdt;
      if (p.y < 0.02 && p.grav > 0) { p.y = 0.02; p.vy *= -0.4; }
      const damp = Math.pow(0.12, sdt); p.vx *= damp; p.vz *= damp;
    }
    for (const s of streaks) {
      s.z -= speed * sdt * 1.15;
      if (s.z < cam.z + 1) Object.assign(s, newStreak(false));
    }

    // score & HUD
    if (state === 'playing') {
      distScore += speed * sdt * 0.25 * mult;
      const sc = Math.floor(distScore + bonus);
      ui.score.textContent = sc.toLocaleString('ru-RU');
      ui.mult.textContent = 'x' + mult;
      ui.speed.textContent = Math.round(speed * 12);
    }
    shake = Math.max(0, shake - dt * 2.2);
    invuln = Math.max(0, invuln - dt);
    overGuard = Math.max(0, overGuard - dt);
    if (state === 'dying') { deathTimer -= dt; if (deathTimer <= 0) gameOver(); }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i]; p.life -= dt * 0.9; p.y -= 70 * DPR * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
  }

  // ================= 3D mesh rendering =================
  const polys = [];
  const LIGHT = (() => { const v = [-0.45, 0.85, -0.35]; const l = Math.hypot(...v); return v.map((x) => x / l); })();

  function pushMesh(mesh, px, py, pz, rx, ry, rz, sx, sy, sz, st) {
    const vs = mesh.verts, Wv = mesh.w, Cv = mesh.c, n = vs.length;
    const cx = Math.cos(rx), snx = Math.sin(rx), cy = Math.cos(ry), sny = Math.sin(ry), cz = Math.cos(rz), snz = Math.sin(rz);
    const f = F * cam.fovK;
    for (let i = 0; i < n; i++) {
      const v = vs[i];
      const x = v[0] * sx, y = v[1] * sy, z = v[2] * sz;
      const x1 = x * cz - y * snz, y1 = x * snz + y * cz;
      const y2 = y1 * cx - z * snx, z2 = y1 * snx + z * cx;
      const x3 = x1 * cy + z2 * sny, z3 = -x1 * sny + z2 * cy;
      const w = Wv[i]; w[0] = x3 + px; w[1] = y2 + py; w[2] = z3 + pz;
      toCam(w[0], w[1], w[2], Cv[i]);
    }
    for (const face of mesh.faces) {
      let depth = 0, ok = true;
      for (const idx of face) { const z = Cv[idx][2]; if (z < NEAR) { ok = false; break; } depth += z; }
      if (!ok) continue;
      depth /= face.length;
      if (depth > FAR) continue;
      const a = Cv[face[0]], b = Cv[face[1]], c = Cv[face[2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * a[0] + ny * a[1] + nz * a[2] >= 0) continue; // back-face
      const A = Wv[face[0]], B = Wv[face[1]], C = Wv[face[2]];
      const wux = B[0] - A[0], wuy = B[1] - A[1], wuz = B[2] - A[2], wvx = C[0] - A[0], wvy = C[1] - A[1], wvz = C[2] - A[2];
      let wx = wuy * wvz - wuz * wvy, wy = wuz * wvx - wux * wvz, wz = wux * wvy - wuy * wvx;
      const wl = Math.hypot(wx, wy, wz) || 1; wx /= wl; wy /= wl; wz /= wl;
      const diff = Math.max(0, wx * LIGHT[0] + wy * LIGHT[1] + wz * LIGHT[2]);
      const light = st.amb + st.dif * diff;
      const pts = new Array(face.length * 2);
      for (let j = 0; j < face.length; j++) { const q = Cv[face[j]]; pts[j * 2] = W / 2 + (q[0] * f) / q[2]; pts[j * 2 + 1] = H / 2 - (q[1] * f) / q[2]; }
      polys.push({
        pts, depth,
        fill: rgba(mulC(st.color, light), st.fillA ?? 0.94),
        stroke: st.edge ? rgba(st.edge, st.edgeA ?? 1) : null,
        lw: (st.lw || 1.5) * DPR,
        fade: clamp((FAR - depth) / 70, 0, 1) * (st.alpha ?? 1),
      });
    }
  }
  function flushPolys() {
    polys.sort((p, q) => q.depth - p.depth);
    ctx.lineJoin = 'round';
    for (const p of polys) {
      if (p.fade <= 0.01) continue;
      ctx.globalAlpha = p.fade;
      const s = p.pts;
      ctx.beginPath(); ctx.moveTo(s[0], s[1]);
      for (let i = 2; i < s.length; i += 2) ctx.lineTo(s[i], s[i + 1]);
      ctx.closePath();
      ctx.fillStyle = p.fill; ctx.fill();
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.lw; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    polys.length = 0;
  }

  // ================= Scene drawing =================
  function drawSky(hy, M) {
    const g = ctx.createLinearGradient(0, -M * 0.5, 0, hy);
    g.addColorStop(0, rgba(P.skyTop)); g.addColorStop(0.6, rgba(P.skyMid)); g.addColorStop(1, rgba(P.skyHor));
    ctx.fillStyle = g; ctx.fillRect(-M, -M, W + 2 * M, hy + M + 2);
    const par = -cam.x * 4 * DPR;
    for (const s of stars) {
      const a = s.b * (0.55 + 0.45 * Math.sin(time * s.sp + s.ph)) * (1 - s.y);
      if (a < 0.03) continue;
      const x = -M + s.x * (W + 2 * M) + par, y = -M * 0.5 + s.y * (hy + M * 0.5) * 0.92;
      const r = s.r * DPR;
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    return g;
  }
  function drawSun(hy, skyG) {
    const R = Math.min(W, H) * 0.24;
    const sx = W / 2 - cam.x * 2 * DPR, sy = hy - R * 0.42;
    const glow = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 2.7);
    glow.addColorStop(0, rgba(P.sunB, 0.45)); glow.addColorStop(1, rgba(P.sunB, 0));
    ctx.fillStyle = glow; ctx.fillRect(sx - R * 2.7, sy - R * 2.7, R * 5.4, R * 5.4);
    const sg = ctx.createLinearGradient(0, sy - R, 0, sy + R * 0.6);
    sg.addColorStop(0, rgba(P.sunA)); sg.addColorStop(1, rgba(P.sunB));
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, R + 1, 0, TAU); ctx.clip();
    ctx.fillStyle = skyG;
    const step = R * 0.14, phase = (time * 0.35) % 1, y0 = sy - R * 0.05;
    for (let i = 0; i < 9; i++) {
      const y = y0 + (i + phase) * step;
      const th = step * (0.06 + ((y - y0) / R) * 0.8);
      ctx.fillRect(sx - R - 2, y, R * 2 + 4, th);
    }
    ctx.restore();
  }
  function drawMountains(hy, M) {
    const span = W + 2 * M;
    mountains.forEach((pts, layer) => {
      const hmax = H * (layer === 0 ? 0.15 : 0.085);
      const par = -cam.x * F * 0.006 * (layer + 1);
      const N = pts.length - 1;
      ctx.beginPath(); ctx.moveTo(-M + par - 60, hy + 1);
      for (let i = 0; i <= N; i++) ctx.lineTo(-M + par + (i / N) * span, hy + 1 - pts[i] * hmax);
      ctx.lineTo(W + M + par + 60, hy + 1); ctx.closePath();
      const g = ctx.createLinearGradient(0, hy - hmax, 0, hy);
      const top = layer === 0 ? mixC(P.mtn, P.skyHor, 0.3) : mixC(P.mtn, P.ground, 0.4);
      g.addColorStop(0, rgba(top)); g.addColorStop(1, rgba(layer === 0 ? P.mtn : P.ground));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = rgba(P.grid, layer === 0 ? 0.35 : 0.6); ctx.lineWidth = 1.5 * DPR; ctx.stroke();
    });
  }
  function drawGround(hy, M) {
    const g = ctx.createLinearGradient(0, hy, 0, H + M);
    g.addColorStop(0, rgba(mixC(P.ground, P.skyHor, 0.5)));
    g.addColorStop(0.06, rgba(mixC(P.ground, P.skyHor, 0.12)));
    g.addColorStop(1, rgba(P.ground));
    ctx.fillStyle = g; ctx.fillRect(-M, hy, W + 2 * M, H + 2 * M);
    ctx.fillStyle = rgba(mixC(P.skyHor, WHITE, 0.4), 0.9);
    ctx.fillRect(-M, hy - 1 * DPR, W + 2 * M, 2 * DPR);
  }
  function drawGrid() {
    const hy = H / 2 - F * cam.fovK * Math.tan(cam.pitch);
    const zn = cam.z + 0.8;
    // road surface
    if (proj(-3.3, 0, zn, tmpA)) {
      const ax = tmpA[0], ay = tmpA[1];
      proj(3.3, 0, zn, tmpA); const bx = tmpA[0], by = tmpA[1];
      proj(3.3, 0, FAR, tmpA); const cx2 = tmpA[0], cy2 = tmpA[1];
      proj(-3.3, 0, FAR, tmpA);
      const rg = ctx.createLinearGradient(0, H, 0, hy);
      rg.addColorStop(0, rgba(P.grid, 0.16)); rg.addColorStop(1, rgba(P.grid, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx2, cy2); ctx.lineTo(tmpA[0], tmpA[1]); ctx.closePath(); ctx.fill();
    }
    // longitudinal lines
    const gL = ctx.createLinearGradient(0, H, 0, hy);
    gL.addColorStop(0, rgba(P.grid, 0.95)); gL.addColorStop(0.75, rgba(P.grid, 0.25)); gL.addColorStop(1, rgba(P.grid, 0));
    ctx.strokeStyle = gL; ctx.lineWidth = 1.4 * DPR;
    ctx.beginPath();
    for (let k = -9; k <= 8; k++) {
      const x = 1.1 + k * 2.2;
      if (proj(x, 0, zn, tmpA) && proj(x, 0, FAR, tmpB)) { ctx.moveTo(tmpA[0], tmpA[1]); ctx.lineTo(tmpB[0], tmpB[1]); }
    }
    ctx.stroke();
    // road edges (thick)
    ctx.lineWidth = 4 * DPR;
    ctx.beginPath();
    for (const x of [-3.3, 3.3]) if (proj(x, 0.01, zn, tmpA) && proj(x, 0.01, FAR, tmpB)) { ctx.moveTo(tmpA[0], tmpA[1]); ctx.lineTo(tmpB[0], tmpB[1]); }
    ctx.stroke();
    // transversal lines
    ctx.lineWidth = 1.4 * DPR;
    const sp = 5, maxZ = 170;
    for (let n = Math.ceil((distance + zn) / sp); n * sp - distance < maxZ; n++) {
      const rz = n * sp - distance;
      if (!proj(-40, 0, rz, tmpA) || !proj(40, 0, rz, tmpB)) continue;
      const a = Math.pow(1 - rz / maxZ, 1.6) * 0.85;
      ctx.strokeStyle = rgba(P.grid, a.toFixed(3));
      ctx.beginPath(); ctx.moveTo(tmpA[0], tmpA[1]); ctx.lineTo(tmpB[0], tmpB[1]); ctx.stroke();
    }
  }
  function drawStreaks() {
    const a = clamp((speed - 26) / 34, 0, 1) * 0.55 + 0.08;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(mixC(P.grid, WHITE, 0.5), a.toFixed(3));
    ctx.lineWidth = 1.5 * DPR;
    ctx.beginPath();
    const stretch = 0.4 + speed / 30;
    for (const s of streaks) {
      if (proj(s.x, s.y, s.z, tmpA) && proj(s.x, s.y, s.z + s.len * stretch, tmpB)) { ctx.moveTo(tmpA[0], tmpA[1]); ctx.lineTo(tmpB[0], tmpB[1]); }
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawShadow() {
    if (state === 'dying' || state === 'over') return;
    if (!proj(player.x, 0.02, 0, tmpA)) return;
    const f = F * cam.fovK, r = (1.25 * f) / tmpA[2];
    const hgt = clamp(1 - (player.y - BASE_Y) / 3, 0.2, 1);
    ctx.save(); ctx.translate(tmpA[0], tmpA[1]); ctx.scale(1, 0.32);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
    g.addColorStop(0, rgba(P.accent, 0.55 * hgt)); g.addColorStop(0.45, rgba(P.accent, 0.15 * hgt)); g.addColorStop(1, rgba(P.accent, 0));
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawDecor() {
    const pylon = { color: mixC(P.mtn, P.ground, 0.3), edge: P.grid, edgeA: 0.75, amb: 0.5, dif: 0.8, lw: 1.4, fillA: 0.95 };
    const cap = { color: P.accent, edge: mixC(P.accent, WHITE, 0.6), amb: 0.8, dif: 0.6, lw: 1.2, fillA: 0.9 };
    const arch = { color: mixC(P.mtn, P.ground, 0.2), edge: P.accent, amb: 0.5, dif: 0.8, lw: 2, fillA: 0.95 };
    const spacing = 24;
    for (let n = Math.ceil((distance + cam.z + 2) / spacing); n * spacing - distance < FAR; n++) {
      const z = n * spacing - distance;
      if (n % 8 === 0) {
        for (const sx of [-5.2, 5.2]) pushMesh(CUBE, sx, 3.6, z, 0, 0, 0, 0.7, 7.2, 0.7, arch);
        pushMesh(CUBE, 0, 7.4, z, 0, 0, 0, 11.1, 0.5, 0.7, arch);
        continue;
      }
      for (const side of [-1, 1]) {
        const hseed = hash(n * 2 + (side > 0 ? 1 : 0));
        const h = 1.8 + hseed * 6.5, x = side * (6.4 + hash(n * 7 + side) * 2.2);
        pushMesh(CUBE, x, h / 2, z, 0, 0, 0, 0.75, h, 0.75, pylon);
        pushMesh(OCTA, x, h + 0.9 + Math.sin(time * 2 + n) * 0.15, z, 0, time * 1.5 + n, 0, 0.35, 0.5, 0.35, cap);
      }
    }
  }
  function drawObjects() {
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);
    const block = { color: mixC(P.block, P.ground, 0.62), edge: mixC(P.block, WHITE, 0.25), amb: 0.45, dif: 0.95, lw: 2, fillA: 0.93 };
    const bar = { color: P.accent, edge: mixC(P.accent, WHITE, 0.5), amb: 0.6, dif: 0.6, lw: 2, fillA: 0.35 + pulse * 0.2 };
    const gem = { color: P.gem, edge: mixC(P.gem, WHITE, 0.6), amb: 0.55, dif: 0.8, lw: 1.4, fillA: 0.95 };
    const shieldSt = { color: [60, 255, 160], edge: [210, 255, 230], amb: 0.6, dif: 0.7, lw: 1.8, fillA: 0.75 };
    for (const o of obstacles) {
      const z = o.z - distance;
      if (z > FAR || z < cam.z) continue;
      if (o.kind === 'block') {
        pushMesh(CUBE, o.x, o.h / 2, z, 0, 0, 0, o.w, o.h, 1.7, block);
        pushMesh(CUBE, o.x, o.h + 0.06, z, 0, 0, 0, o.w * 0.86, 0.12, 1.5, { ...bar, fillA: 0.8, color: P.block, edge: mixC(P.block, WHITE, 0.6) });
      } else if (o.kind === 'bar') {
        pushMesh(CUBE, 0, o.h / 2, z, 0, 0, 0, 6.8, o.h, 0.5, bar);
      } else if (o.kind === 'gem') {
        pushMesh(OCTA, o.x, o.y + Math.sin(time * 3 + o.z) * 0.12, z, 0, o.rot, 0, 0.42, 0.62, 0.42, gem);
      } else if (o.kind === 'shield') {
        pushMesh(CUBE, o.x, o.y + Math.sin(time * 3) * 0.15, z, o.rot * 0.7, o.rot, 0, 0.8, 0.8, 0.8, shieldSt);
      }
    }
  }
  function drawShip() {
    if (state === 'dying' || state === 'over') return;
    if (invuln > 0 && Math.floor(time * 18) % 2 === 0) return;
    const st = { color: mixC([28, 26, 60], P.accent, 0.22), edge: mixC(P.accent, WHITE, 0.35), amb: 0.45, dif: 0.95, lw: 2.2, fillA: 1 };
    pushMesh(SHIP, player.x, player.y + player.bob, 0,
      clamp(-player.vy * 0.035, -0.35, 0.35), clamp(player.vx * 0.012, -0.3, 0.3), clamp(-player.vx * 0.03, -0.7, 0.7),
      1.05, 1.05, 1.05, st);
  }
  function drawFX() {
    const f = F * cam.fovK;
    ctx.globalCompositeOperation = 'lighter';
    // engine glow
    if ((state === 'playing' || state === 'menu') && proj(player.x, player.y + player.bob + 0.05, -0.9, tmpA)) {
      const r = (0.9 * f) / tmpA[2];
      const g = ctx.createRadialGradient(tmpA[0], tmpA[1], 0, tmpA[0], tmpA[1], r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.25, rgba(P.accent, 0.6)); g.addColorStop(1, rgba(P.accent, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tmpA[0], tmpA[1], r, 0, TAU); ctx.fill();
    }
    // particles
    for (const p of particles) {
      if (!proj(p.x, p.y, p.z, tmpA)) continue;
      const r = Math.min(H * 0.03, Math.max(0.7 * DPR, (p.size * f) / tmpA[2]));
      ctx.fillStyle = rgba(p.color, clamp(p.life / p.max, 0, 1).toFixed(3));
      ctx.beginPath(); ctx.arc(tmpA[0], tmpA[1], r, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // shield bubble
    if (shield && state === 'playing' && proj(player.x, player.y + player.bob, 0, tmpA)) {
      const r = (1.7 * f) / tmpA[2];
      const pul = 0.5 + 0.5 * Math.sin(time * 6);
      const g = ctx.createRadialGradient(tmpA[0], tmpA[1], r * 0.6, tmpA[0], tmpA[1], r);
      g.addColorStop(0, 'rgba(80,255,170,0)'); g.addColorStop(1, `rgba(80,255,170,${0.18 + pul * 0.12})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tmpA[0], tmpA[1], r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(160,255,210,${0.5 + pul * 0.4})`; ctx.lineWidth = 2 * DPR; ctx.stroke();
    }
  }
  function drawPopups() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of popups) {
      const a = clamp(p.life * 1.5, 0, 1);
      const size = (p.big ? 30 : 20) * DPR * (1 + (1 - p.life) * 0.15);
      ctx.font = `italic 900 ${size}px "Segoe UI", system-ui, sans-serif`;
      ctx.lineWidth = 4 * DPR; ctx.strokeStyle = `rgba(0,0,0,${a * 0.6})`;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = rgba(mixC(p.color, WHITE, 0.35), a);
      ctx.fillText(p.text, p.x, p.y);
    }
  }

  // ================= Bloom (cheap downsample glow) =================
  const hasFilter = typeof bA.filter === 'string';
  if (hasFilter) bA.filter = 'brightness(0.6) contrast(2.1) saturate(1.5)';
  let bloomOn = true;
  function applyBloom() {
    if (!bloomOn) return;
    bA.globalCompositeOperation = 'copy'; bA.drawImage(canvas, 0, 0, bloomA.width, bloomA.height);
    bB.globalCompositeOperation = 'copy'; bB.drawImage(bloomA, 0, 0, bloomB.width, bloomB.height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = hasFilter ? 0.55 : 0.22; ctx.drawImage(bloomA, 0, 0, W, H);
    ctx.globalAlpha = hasFilter ? 0.75 : 0.3; ctx.drawImage(bloomB, 0, 0, W, H);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const hy = H / 2 - F * cam.fovK * Math.tan(cam.pitch);
    const M = Math.max(W, H) * 0.4;
    ctx.save();
    const sk = shake * shake * 36 * DPR;
    ctx.translate(W / 2 + (Math.random() - 0.5) * sk, H / 2 + (Math.random() - 0.5) * sk);
    ctx.rotate(cam.roll);
    ctx.translate(-W / 2, -H / 2);
    const skyG = drawSky(hy, M);
    drawSun(hy, skyG);
    drawMountains(hy, M);
    drawGround(hy, M);
    drawGrid();
    drawStreaks();
    drawShadow();
    drawDecor();
    drawObjects();
    drawShip();
    flushPolys();
    drawFX();
    ctx.restore();
    drawPopups();
    applyBloom();
  }

  // ================= Adaptive quality =================
  let perfAcc = 0, perfN = 0, perfChecks = 0;
  function perf(dtMs) {
    perfAcc += dtMs; perfN++;
    if (perfN < 90) return;
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0; perfChecks++;
    if (perfChecks < 2) return; // ignore warm-up
    if (avg > 26) {
      if (maxDPR > 1) { maxDPR = Math.max(1, maxDPR - 0.5); resize(); }
      else if (bloomOn) bloomOn = false;
    }
  }

  // ================= Main loop =================
  let last = performance.now();
  function frame(now) {
    const raw = now - last; last = now;
    const dt = Math.min(0.033, Math.max(0, raw / 1000));
    if (state !== 'paused') update(dt);
    render();
    Sound.tick();
    if (state === 'playing') perf(raw);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug/test hook
  window.__NEON = { get state() { return state; }, get score() { return Math.floor(distScore + bonus); }, get distance() { return distance; }, get obstacles() { return obstacles.length; }, startGame };
})();
