// ========================================
// runner.js — «Люцик и Обратная сторона»
// Max upgrade: intro, well, hunt, Mind Flayer, rainbow, photo
// ========================================

import { appState, showGamesMenu } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';

const FEARS = [
  { id: 'darkness', name: 'Темнота', emoji: '🌑', color: '#111', eye: '#ff0033', shape: 'cloud' },
  { id: 'height', name: 'Высота', emoji: '🏔️', color: '#8899aa', eye: '#ff6666', shape: 'vortex' },
  { id: 'lonely', name: 'Одиночество', emoji: '😔', color: '#2244aa', eye: '#66aaff', shape: 'shadow' },
  { id: 'monsters', name: 'Монстры', emoji: '👾', color: '#5a1a8a', eye: '#ff44aa', shape: 'demo' },
  { id: 'mindflayer', name: 'Главный Страх', emoji: '🧠', color: '#050508', eye: '#ff0000', shape: 'flayer' }
];

const PHASE = {
  INTRO: 'intro',
  RUN: 'run',
  WELL_FALL: 'well_fall',
  WELL_INSIDE: 'well_inside',
  WELL_EXIT: 'well_exit',
  HUNT: 'hunt',
  WIN_SLOWMO: 'win_slowmo',
  WON: 'won',
  LOST: 'lost'
};

const RAINBOW = ['#ff0040', '#ff8000', '#ffd700', '#00e676', '#00e5ff', '#a040ff'];

function nextRunCount() {
  const n = (parseInt(localStorage.getItem('runner-run-count') || '0', 10) || 0) + 1;
  localStorage.setItem('runner-run-count', String(n));
  return n;
}

export function startRunnerGame(level = 1) {
  document.querySelectorAll('.game-fullscreen, .game-screen, .runner-result, .runner-share-sheet').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = true;
  level = Math.max(1, Math.min(5, level || 1));

  const runCount = nextRunCount();
  const isMindFlayer = runCount % 5 === 0 || level >= 5;
  const fear = isMindFlayer
    ? FEARS[4]
    : FEARS[Math.min(level - 1, 3)];

  const overlay = document.createElement('div');
  overlay.className = `game-fullscreen runner-game${isMindFlayer ? ' runner-mindflayer' : ''}`;
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.className = 'runner-header';
  header.innerHTML = `
    <span>🐱 Обратная сторона</span>
    <span>🏃 <b id="runnerDistance">0</b>м · ⭐ <b id="runnerScore">0</b></span>
    <span id="runnerFearLabel">${fear.emoji} ${fear.name}</span>
    <button type="button" id="runnerPhoto" aria-label="Фото">📸</button>
    <button type="button" id="runnerMusic" aria-label="Музыка">🔊</button>
    <button type="button" id="runnerClose" aria-label="Закрыть">✕</button>
  `;

  const canvas = document.createElement('canvas');
  overlay.appendChild(header);
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');

  const groundY = () => canvas.height - 58;
  const lucikHomeX = () => canvas.width * 0.28;
  const lucik = {
    x: 0, y: 0, w: 68, h: 68, vy: 0,
    jumping: false, scale: 1, glow: 0, peek: 0,
    facing: 1, lookBack: false, lookBackT: 0,
    breath: 0, breathCycles: 0, targetX: 0
  };

  const GRAVITY = 0.58;
  const JUMP_V0 = -14.2;
  const JUMP_V1 = -9.5;

  let phase = PHASE.INTRO;
  let introT = 0;
  let wellT = 0;
  let huntT = 0;
  let winSlowT = 0;
  let obstacles = [];
  let trackStars = [];
  let trailStars = [];
  let particles = [];
  let dirtParticles = [];
  let comboFloats = [];
  let speedLines = [];
  let fireworks = [];
  let bgStars = [];
  let fireflies = [];
  let leaves = [];
  let fogLayers = [];
  let trees = [];
  let cracks = [];
  let wellShadows = [];
  let score = 0;
  let distance = 0;
  let speed = isMindFlayer ? 3.8 : 3.2;
  let baseSpeed = speed;
  let frame = 0;
  let jumpCount = 0;
  let finished = false;
  let groundOffset = 0;
  let shakeIntensity = 0;
  let camShakeX = 0;
  let camShakeY = 0;
  let wasAirborne = false;
  let well = null;
  let wellStarTaken = false;
  let wellEyeT = -1;
  let wellParallax = 0;
  let invuln = 0;
  let chaseFear = null;
  let won = false;
  let closedPortal = false;
  let musicMode = 'flee';
  let timeScale = 1;
  let slowMoT = 0;
  let combo = 0;
  let comboTimer = 0;
  let starStreak = 0;
  let rainbowT = 0;
  let clockMinute = 0;
  let lastSmash = null;
  let masterGain = null;
  let musicVol = 0.04;
  let vhsGlitchT = 0;
  let nextVhsAt = 250 + Math.random() * 250;
  let grainCanvas = null;
  let grainCtx = null;

  const lucikImg = new Image();
  lucikImg.src = 'assets/images/avatar.png';
  lucikImg.onerror = () => { lucikImg.src = 'assets/images/avatar.svg'; };

  const lucikFrames = [];
  for (let i = 1; i <= 4; i++) {
    const img = new Image();
    img.src = `assets/images/lucik-run-${i}.png`;
    lucikFrames.push(img);
  }
  let currentFrame = 0;
  let frameCounter = 0;
  let animState = 'idle';

  // —— Web Audio synthwave ——
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let musicOn = true;
  let musicInterval = null;
  let droneNodes = [];
  let echoDelay = null;
  let echoGain = null;

  function resumeAudio() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function ensureMaster() {
    if (masterGain) return masterGain;
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(audioCtx.destination);
    echoDelay = audioCtx.createDelay(1.0);
    echoDelay.delayTime.value = 0.28;
    echoGain = audioCtx.createGain();
    echoGain.gain.value = 0;
    echoDelay.connect(echoGain);
    echoGain.connect(masterGain);
    return masterGain;
  }

  function setWellEcho(on) {
    if (!echoGain) ensureMaster();
    echoGain.gain.setTargetAtTime(on ? 0.45 : 0, audioCtx.currentTime, 0.05);
  }

  function setMusicVolume(v) {
    musicVol = v;
    if (masterGain) masterGain.gain.setTargetAtTime(musicOn ? Math.min(1.4, 0.7 + v * 8) : 0, audioCtx.currentTime, 0.1);
  }

  function beep(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
    if (!musicOn) return;
    resumeAudio();
    ensureMaster();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);
    if (echoGain?.gain.value > 0.01) gain.connect(echoDelay);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideTo != null) osc.frequency.linearRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
    const v = vol * (0.6 + musicVol * 6);
    gain.gain.setValueAtTime(v, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }

  function playHeartbeat() {
    beep(55, 0.12, 'sine', 0.22);
    setTimeout(() => beep(42, 0.2, 'sine', 0.2), 180);
  }

  function playJumpSound() { beep(280, 0.18, 'square', 0.08, 520); }
  function playStarSound() {
    beep(880, 0.12, 'sine', 0.14, 1320);
    setTimeout(() => beep(1320, 0.2, 'triangle', 0.1), 80);
  }
  function playHuntSound() {
    beep(220, 0.4, 'sawtooth', 0.08, 660);
    setTimeout(() => beep(440, 0.5, 'triangle', 0.1, 880), 120);
  }
  function playShatter() {
    beep(180, 0.15, 'sawtooth', 0.12, 40);
    beep(600, 0.2, 'square', 0.06, 1200);
  }
  function playRainbow() {
    [523, 659, 784, 988, 1175].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle', 0.09), i * 70));
  }
  function playWinChime() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.35, 'sine', 0.1), i * 120));
  }

  function stopDrone() {
    droneNodes.forEach((n) => { try { n.stop(); } catch { /* */ } });
    droneNodes = [];
  }

  function startDrone(freq = 48, vol = 0.04) {
    stopDrone();
    if (!musicOn) return;
    resumeAudio();
    ensureMaster();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    lfo.frequency.value = isMindFlayer ? 1.8 : 3.5;
    lfoGain.gain.value = freq * 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.value = vol * (isMindFlayer ? 1.6 : 1);
    osc.connect(gain);
    gain.connect(masterGain);
    if (echoGain?.gain.value > 0.01) gain.connect(echoDelay);
    osc.start();
    lfo.start();
    droneNodes.push(osc, lfo);
  }

  function startMusic(mode = 'flee') {
    musicMode = mode;
    if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
    stopDrone();
    if (!musicOn) return;
    setWellEcho(mode === 'well');

    if (mode === 'well') {
      startDrone(32, 0.02);
      setMusicVolume(0.02);
      return;
    }
    if (mode === 'win') {
      setWellEcho(false);
      playWinChime();
      setMusicVolume(0.06);
      return;
    }

    const fleeBass = isMindFlayer
      ? [55, 55, 65, 49, 55, 73, 65, 49]
      : [110, 130, 146, 110, 98, 130, 164, 146];
    const huntLead = [220, 277, 330, 370, 440, 370, 330, 277];
    const notes = mode === 'hunt' ? huntLead : fleeBass;
    let i = 0;
    startDrone(mode === 'hunt' ? 55 : (isMindFlayer ? 28 : 42), mode === 'hunt' ? 0.03 : (isMindFlayer ? 0.07 : 0.04));

    musicInterval = setInterval(() => {
      if (!musicOn || phase === PHASE.LOST || phase === PHASE.WON) {
        clearInterval(musicInterval);
        musicInterval = null;
        return;
      }
      const f = notes[i % notes.length];
      const type = mode === 'hunt' ? 'square' : (isMindFlayer ? 'sawtooth' : 'sawtooth');
      beep(f, mode === 'hunt' ? 0.2 : 0.28, type, mode === 'hunt' ? 0.045 : 0.038);
      if (mode === 'hunt' && i % 4 === 0) beep(f * 2, 0.1, 'triangle', 0.028);
      if (isMindFlayer && mode === 'flee' && i % 2 === 0) beep(f / 2, 0.35, 'sine', 0.05);
      i++;
    }, mode === 'hunt' ? 200 : (isMindFlayer ? 280 : 320));
  }

  function toggleMusic() {
    musicOn = !musicOn;
    if (!musicOn) {
      if (musicInterval) clearInterval(musicInterval);
      musicInterval = null;
      stopDrone();
      if (masterGain) masterGain.gain.value = 0;
    } else if (phase !== PHASE.LOST && phase !== PHASE.WON && phase !== PHASE.INTRO) {
      if (masterGain) masterGain.gain.value = 1;
      startMusic(musicMode);
    }
    return musicOn;
  }

  function cleanupAudio() {
    if (musicInterval) clearInterval(musicInterval);
    musicInterval = null;
    stopDrone();
    try { audioCtx.close(); } catch { /* */ }
  }

  function initDecor() {
    const w = Math.max(100, canvas.width);
    const h = Math.max(80, canvas.height);
    bgStars = Array.from({ length: isMindFlayer ? 30 : 52 }, () => ({
      x: Math.random(), y: Math.random() * 0.55,
      r: 0.5 + Math.random() * 1.8,
      tw: Math.random() * Math.PI * 2,
      sp: 0.02 + Math.random() * 0.04
    }));
    fireflies = Array.from({ length: 28 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.72,
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.35,
      hue: Math.random() < 0.55 ? 'gold' : 'red',
      ph: Math.random() * Math.PI * 2,
      homeX: 0,
      homeY: 0
    }));
    fireflies.forEach((f) => { f.homeX = f.x; f.homeY = f.y; });
    leaves = Array.from({ length: 8 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.6,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.06,
      vx: -0.4 - Math.random() * 0.6,
      vy: 0.15 + Math.random() * 0.35,
      size: 5 + Math.random() * 7,
      color: Math.random() < 0.5 ? '#6a3a2a' : '#8a5020'
    }));
    fogLayers = [
      { y: 0.25, h: 0.2, speed: 0.15, alpha: 0.08, offset: 0 },
      { y: 0.45, h: 0.22, speed: 0.35, alpha: 0.12, offset: 40 },
      { y: 0.65, h: 0.18, speed: 0.7, alpha: 0.1, offset: 90 }
    ];
    trees = Array.from({ length: 8 }, (_, i) => ({
      base: i * 160 + Math.random() * 40,
      h: 70 + (i % 3) * 25,
      w: 34 + (i % 2) * 6
    }));
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = 64;
    grainCanvas.height = 64;
    grainCtx = grainCanvas.getContext('2d');
  }

  function resize() {
    canvas.width = overlay.clientWidth;
    canvas.height = Math.max(200, overlay.clientHeight - header.offsetHeight);
    if (phase === PHASE.INTRO) lucik.x = lucikHomeX();
    else if (phase === PHASE.RUN || phase === PHASE.HUNT) {
      lucik.x = lucik.x || lucikHomeX();
      lucik.y = Math.min(lucik.y, groundY() - lucik.h);
    }
    if (!bgStars.length) initDecor();
  }
  resize();
  window.addEventListener('resize', resize);

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4.5;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2,
        life: 22 + Math.random() * 22, color, r: 2 + Math.random() * 3.5
      });
    }
  }

  function spawnDirt(x, y, n = 10) {
    for (let i = 0; i < n; i++) {
      dirtParticles.push({
        x: x + (Math.random() - 0.5) * 30,
        y,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -1 - Math.random() * 3,
        life: 25 + Math.random() * 20,
        r: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#5a4020' : '#3a2810'
      });
    }
  }

  function showComboText(pts) {
    const el = document.createElement('div');
    el.className = 'runner-combo-float';
    el.textContent = `+${pts}`;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function spawnFearObstacle() {
    if (canvas.width <= 0) return;
    const scale = 1 + Math.min(0.55, distance * 0.0003);
    const variants = [
      { fearId: 'darkness', w: 50 * scale, h: 44 * scale },
      { fearId: 'height', w: 42 * scale, h: 52 * scale },
      { fearId: 'lonely', w: 46 * scale, h: 48 * scale },
      { fearId: 'monsters', w: 54 * scale, h: 56 * scale }
    ];
    const v = variants[Math.floor(Math.random() * variants.length)];
    const meta = FEARS.find((f) => f.id === v.fearId) || fear;
    const hunting = phase === PHASE.HUNT || rainbowT > 0;
    obstacles.push({
      type: 'fear',
      fearId: v.fearId,
      name: meta.name,
      color: meta.color,
      eye: meta.eye,
      shape: meta.shape,
      x: canvas.width + 20,
      y: groundY() - v.h,
      w: v.w,
      h: v.h,
      fleeing: hunting,
      panicDir: Math.random() < 0.5 ? -1 : 1,
      panicT: Math.random() * 40,
      hit: false
    });
  }

  function spawnTrackStar() {
    if (canvas.width <= 0) return;
    trackStars.push({
      x: canvas.width + 10,
      y: groundY() - 70 - Math.random() * 50,
      r: 11,
      taken: false
    });
  }

  function spawnWell() {
    if (well || canvas.width <= 0) return;
    well = { x: canvas.width + 40, y: groundY() - 8, w: 72, h: 52, used: false };
  }

  function collectStar(bonus = 10) {
    score += bonus;
    starStreak++;
    const el = document.getElementById('runnerScore');
    if (el) el.textContent = score;
    playStarSound();
    if (starStreak >= 3 && rainbowT <= 0) {
      rainbowT = 500; // ~10s
      overlay.classList.add('runner-rainbow');
      playRainbow();
      speak('Радужный Люцик!');
      obstacles.forEach((o) => { if (o.type === 'fear') o.fleeing = true; });
    }
  }

  function smashFear(o) {
    o.hit = true;
    comboTimer = 90;
    combo++;
    const pts = Math.min(50, 10 * combo);
    score += pts;
    const el = document.getElementById('runnerScore');
    if (el) el.textContent = score;
    showComboText(pts);
    burst(o.x + o.w / 2, o.y + o.h / 2, o.eye || '#ff4466', 22);
    burst(o.x + o.w / 2, o.y + o.h / 2, '#FFD700', 10);
    shakeIntensity = 8 + Math.random() * 4; // 8–12px
    playShatter();
    lastSmash = { x: o.x + o.w / 2, y: o.y + o.h / 2, color: o.eye, name: o.name };
  }

  function enterWell() {
    if (!well || well.used) return;
    well.used = true;
    phase = PHASE.WELL_FALL;
    wellT = 0;
    lucik.scale = 1;
    lucik.vy = 0;
    lucik.jumping = false;
    jumpCount = 0;
    overlay.classList.add('runner-well');
    startMusic('well');
    shakeIntensity = 6;
    wellShadows = [
      { name: 'Темнота', x: -80, speed: 4.2, y: 0.22 },
      { name: 'Высота', x: -220, speed: 3.6, y: 0.4 },
      { name: 'Одиночество', x: -380, speed: 5.0, y: 0.3 }
    ];
    wellEyeT = -1;
    wellStarTaken = false;
    wellParallax = 0;
  }

  function startHunt() {
    phase = PHASE.HUNT;
    huntT = 0;
    invuln = 250;
    lucik.glow = 1;
    lucik.scale = 1;
    lucik.peek = 0;
    lucik.y = groundY() - lucik.h;
    lucik.targetX = lucikHomeX();
    lucik.x = lucik.targetX;
    lucik.breath = 0;
    lucik.breathCycles = 3;
    well = null;
    overlay.classList.remove('runner-well');
    overlay.classList.add('runner-hunt');
    baseSpeed = speed;
    speed = baseSpeed * 1.5;
    setMusicVolume(0.07);
    obstacles.forEach((o) => { if (o.type === 'fear') o.fleeing = true; });
    startMusic('hunt');
    playHuntSound();
    burst(lucik.x + lucik.w / 2, lucik.y + lucik.h / 2, '#FFD700', 28);
    timeScale = 0.5;
    slowMoT = 25;
  }

  function triggerWin() {
    if (phase === PHASE.WON || phase === PHASE.WIN_SLOWMO) return;
    won = true;
    closedPortal = isMindFlayer;
    clockMinute = 1;
    if (lastSmash) {
      phase = PHASE.WIN_SLOWMO;
      winSlowT = 0;
      timeScale = 0.35;
      for (let i = 0; i < 40; i++) {
        fireworks.push({
          x: canvas.width * (0.2 + Math.random() * 0.6),
          y: canvas.height * (0.15 + Math.random() * 0.35),
          vx: (Math.random() - 0.5) * 3,
          vy: -2 - Math.random() * 3,
          life: 40 + Math.random() * 40,
          color: Math.random() < 0.5 ? '#FFD700' : '#ff2244',
          r: 2 + Math.random() * 3
        });
      }
    } else {
      phase = PHASE.WON;
      startMusic('win');
      spawnVictoryFireworks();
    }
  }

  function spawnVictoryFireworks() {
    for (let i = 0; i < 60; i++) {
      const cx = canvas.width * (0.25 + Math.random() * 0.5);
      const cy = canvas.height * (0.2 + Math.random() * 0.3);
      burst(cx, cy, Math.random() < 0.5 ? '#FFD700' : '#ff2244', 8);
    }
  }

  function jump() {
    if (phase === PHASE.INTRO || phase === PHASE.WELL_FALL || phase === PHASE.WELL_INSIDE ||
        phase === PHASE.WELL_EXIT || phase === PHASE.LOST || phase === PHASE.WON ||
        phase === PHASE.WIN_SLOWMO) return;
    if (jumpCount >= 2) return;
    // парабола: v0 + g*t → естественная дуга
    lucik.vy = jumpCount === 0 ? JUMP_V0 : JUMP_V1;
    lucik.jumping = true;
    wasAirborne = true;
    jumpCount++;
    playJumpSound();
  }

  // —— intro: crawl from ground ——
  function updateIntro() {
    introT++;
    const gy = groundY();

    if (introT === 1) {
      resumeAudio();
      startDrone(isMindFlayer ? 28 : 40, isMindFlayer ? 0.06 : 0.03);
      lucik.x = lucikHomeX();
      lucik.y = gy - lucik.h;
    }

    // fear crawls up from underground
    if (introT === 40) {
      chaseFear = {
        x: canvas.width * 0.7,
        y: gy,
        h: 0,
        maxH: 110,
        crawl: true
      };
      spawnDirt(canvas.width * 0.7, gy, 16);
    }

    if (chaseFear && chaseFear.h < chaseFear.maxH) {
      chaseFear.h += 1.8;
      if (introT % 4 === 0) spawnDirt(chaseFear.x, gy, 3);
    }

    if (introT === 55) {
      shakeIntensity = 12;
      playHeartbeat();
    }
    if (introT === 75) playHeartbeat();

    // Lucik jumps back in fright
    if (introT === 80) {
      lucik.vy = -10;
      lucik.jumping = true;
      lucik.facing = -1;
      lucik.lookBack = true;
      playJumpSound();
    }
    if (introT >= 80 && introT < 110) {
      lucik.x = Math.max(20, lucikHomeX() - (introT - 80) * 1.8);
      lucik.vy += 0.55;
      lucik.y += lucik.vy;
      if (lucik.y >= gy - lucik.h) {
        lucik.y = gy - lucik.h;
        lucik.vy = 0;
        lucik.jumping = false;
      }
    }

    if (introT === 125) {
      lucik.facing = 1;
      lucik.lookBack = false;
      lucik.x = lucikHomeX();
      animState = 'run';
      phase = PHASE.RUN;
      stopDrone();
      startMusic('flee');
      setMusicVolume(0.04);
      speak(isMindFlayer ? 'Mind Flayer рядом! Беги!' : `Беги от ${fear.name}!`);
    }
  }

  function updateWellFall() {
    wellT++;
    lucik.scale = Math.max(0.12, 1 - wellT / 32);
    lucik.y += 2.8;
    animState = 'fall';
    wellParallax += 2;
    if (wellT >= 32) {
      phase = PHASE.WELL_INSIDE;
      wellT = 0;
      lucik.scale = 1;
      lucik.peek = 0;
      wellEyeT = 35; // eye peeks mid-scene
    }
  }

  function updateWellInside() {
    wellT++;
    lucik.peek = Math.min(1, wellT / 22);
    animState = 'peek';
    wellParallax += 0.8;
    wellShadows.forEach((s) => { s.x += s.speed; });
    if (wellEyeT > 0) wellEyeT--;

    if (wellT === 50 && !wellStarTaken) {
      wellStarTaken = true;
      collectStar(25);
      burst(canvas.width / 2, canvas.height * 0.55, '#FFD700', 32);
    }
    if (wellT >= 95) {
      phase = PHASE.WELL_EXIT;
      wellT = 0;
      lucik.peek = 0;
    }
  }

  function updateWellExit() {
    wellT++;
    animState = 'jump_up';
    lucik.glow = Math.min(1, wellT / 12);
    if (wellT >= 18) startHunt();
  }

  function updateHunt() {
    huntT++;
    invuln = Math.max(0, invuln - 1);
    lucik.glow = 0.65 + Math.sin(frame * 0.22) * 0.35;

    if (frame % 2 === 0) {
      speedLines.push({
        x: Math.random() < 0.5 ? 8 + Math.random() * 28 : canvas.width - 36 - Math.random() * 28,
        y: Math.random() * canvas.height,
        len: 20 + Math.random() * 40,
        life: 10 + Math.random() * 8
      });
    }
    if (frame % 3 === 0) {
      trailStars.push({
        x: lucik.x + lucik.w * 0.25,
        y: lucik.y + lucik.h * 0.45 + (Math.random() - 0.5) * 22,
        life: 16
      });
    }

    // panic fears
    obstacles.forEach((o) => {
      if (o.type !== 'fear' || o.hit) return;
      o.panicT++;
      if (o.panicT % 18 === 0) o.panicDir *= -1;
      o.x += o.panicDir * 1.8;
      // collide with each other
      for (const b of obstacles) {
        if (b === o || b.hit || b.type !== 'fear') continue;
        if (Math.abs(o.x - b.x) < (o.w + b.w) * 0.4) {
          o.panicDir *= -1;
          b.panicDir *= -1;
          burst((o.x + b.x) / 2, o.y + o.h / 2, '#ffffff', 4);
        }
      }
    });

    if (huntT >= 250) triggerWin();
  }

  function update() {
    if (phase === PHASE.LOST || phase === PHASE.WON) return;

    // slow-mo
    if (slowMoT > 0) {
      slowMoT--;
      if (slowMoT <= 0) timeScale = 1;
    }
    // accumulate frames with timeScale (skip some updates when slow)
    if (timeScale < 1 && frame % Math.round(1 / timeScale) !== 0 && phase !== PHASE.WIN_SLOWMO) {
      // still draw, lighter update
    }

    frame++;

    if (phase === PHASE.WIN_SLOWMO) {
      winSlowT++;
      fireworks.forEach((f) => {
        f.x += f.vx * 0.5;
        f.y += f.vy * 0.5;
        f.vy += 0.05;
        f.life--;
      });
      fireworks = fireworks.filter((f) => f.life > 0);
      updateParticles();
      if (winSlowT >= 45) {
        phase = PHASE.WON;
        timeScale = 1;
        startMusic('win');
        spawnVictoryFireworks();
      }
      return;
    }

    if (phase === PHASE.INTRO) {
      updateIntro();
      updateParticles();
      return;
    }
    if (phase === PHASE.WELL_FALL) { updateWellFall(); updateParticles(); return; }
    if (phase === PHASE.WELL_INSIDE) { updateWellInside(); updateParticles(); return; }
    if (phase === PHASE.WELL_EXIT) { updateWellExit(); updateParticles(); return; }

    const hunting = phase === PHASE.HUNT;
    const rainbow = rainbowT > 0;
    if (hunting) updateHunt();
    if (rainbow) {
      rainbowT--;
      if (rainbowT <= 0) overlay.classList.remove('runner-rainbow');
    }
    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer <= 0) combo = 0;
    }

    // look back every ~3s while running
    if (phase === PHASE.RUN) {
      lucik.lookBackT++;
      if (lucik.lookBackT >= 150) {
        lucik.lookBackT = 0;
        lucik.lookBack = true;
        lucik.facing = -1;
        setTimeout(() => {
          if (phase === PHASE.RUN) {
            lucik.lookBack = false;
            lucik.facing = 1;
          }
        }, 450);
      }
    }

    distance += speed * 0.12 * (timeScale < 1 ? timeScale : 1);
    const distEl = document.getElementById('runnerDistance');
    if (distEl) distEl.textContent = Math.floor(distance);

    // dynamic music volume from speed
    if (phase === PHASE.RUN || phase === PHASE.HUNT) {
      setMusicVolume(0.03 + (speed / 14) * 0.08);
    }

    // инерция X — плавно к «дорожке»
    lucik.targetX = lucikHomeX();
    lucik.x += (lucik.targetX - lucik.x) * 0.12;

    // дыхание после колодца (3 цикла пульсации)
    if (lucik.breathCycles > 0) {
      lucik.breath += 0.18;
      if (lucik.breath >= Math.PI * 2) {
        lucik.breath = 0;
        lucik.breathCycles--;
      }
    }

    // параболический прыжок
    lucik.vy += GRAVITY;
    lucik.y += lucik.vy;
    const gy = groundY();
    if (lucik.y >= gy - lucik.h) {
      if (wasAirborne && lucik.jumping) {
        shakeIntensity = Math.max(shakeIntensity, 3 + Math.random() * 2); // 3–5px
      }
      lucik.y = gy - lucik.h;
      lucik.vy = 0;
      lucik.jumping = false;
      jumpCount = 0;
      wasAirborne = false;
    }

    const move = speed * (timeScale < 1 ? timeScale : 1);
    obstacles.forEach((o) => {
      o.x -= o.fleeing ? move * 1.4 : move;
    });
    trackStars.forEach((s) => { s.x -= move; });
    if (well && !well.used) well.x -= move;
    cracks.forEach((c) => { c.x -= move; c.life--; });
    cracks = cracks.filter((c) => c.life > 0 && c.x > -40);
    trailStars.forEach((t) => { t.x -= move * 0.35; t.life--; });
    trailStars = trailStars.filter((t) => t.life > 0);
    speedLines.forEach((l) => { l.y += 8; l.life--; });
    speedLines = speedLines.filter((l) => l.life > 0);

    // missed star breaks rainbow streak
    for (const s of [...trackStars]) {
      if (!s.taken && s.x + 20 < lucik.x) {
        starStreak = 0;
        s.taken = true; // mark so we don't double-count
      }
    }

    obstacles = obstacles.filter((o) => o.x > -90 && !o.hit);
    trackStars = trackStars.filter((s) => s.x > -20 && !s.taken);

    if (well && !well.used && phase === PHASE.RUN) {
      const near = lucik.x + lucik.w > well.x + 8 && lucik.x < well.x + well.w - 8;
      const vertically = lucik.y + lucik.h > well.y - 40;
      if (near && vertically) enterWell();
    }

    // star pickup
    for (const s of trackStars) {
      if (s.taken) continue;
      if (Math.abs(lucik.x + lucik.w / 2 - s.x) < 28 && Math.abs(lucik.y + lucik.h / 2 - s.y) < 28) {
        s.taken = true;
        collectStar(10);
        burst(s.x, s.y, '#FFD700', 12);
      }
    }

    const margin = 10;
    const lx = lucik.x + margin;
    const ly = lucik.y + margin + 4;
    const lw = lucik.w - margin * 2;
    const lh = lucik.h - margin * 2 - 4;

    for (const o of obstacles) {
      if (o.type !== 'fear' || o.hit) continue;
      const ox = o.x + 6;
      const oy = o.y + 6;
      const ow = o.w - 12;
      const oh = o.h - 10;
      if (lx < ox + ow && lx + lw > ox && ly < oy + oh && ly + lh > oy) {
        if (hunting || rainbow || invuln > 0) {
          smashFear(o);
        } else {
          starStreak = 0;
          phase = PHASE.LOST;
          shakeIntensity = 14;
          beep(80, 0.4, 'sawtooth', 0.12, 30);
        }
      }
    }

    if (phase === PHASE.RUN || phase === PHASE.HUNT) {
      const minGap = Math.max(isMindFlayer ? 120 : 160, (isMindFlayer ? 280 : 380) - distance * 0.12);
      const last = obstacles[obstacles.length - 1];
      const spawnRate = hunting
        ? 0.04
        : (isMindFlayer ? 0.022 : 0.012) + distance * 0.00004;
      if ((!last || last.x < canvas.width - minGap) && Math.random() < spawnRate) {
        spawnFearObstacle();
      }
      if (phase === PHASE.RUN && !well && distance > 55 && distance < 70) spawnWell();
      if (phase === PHASE.RUN && Math.random() < 0.018) spawnTrackStar();
      if (Math.random() < (isMindFlayer ? 0.02 : 0.012)) {
        cracks.push({ x: canvas.width, life: 40 + Math.random() * 30 });
      }
      if (!hunting) speed = Math.min(isMindFlayer ? 13 : 11, baseSpeed + distance * 0.003);
      else speed = Math.min(15, baseSpeed * 1.5);
    }

    // miss star → break streak if it goes off screen past lucik without collect
    // (handled: only increment on collect)

    groundOffset = (groundOffset + speed) % 48;

    // светлячки разлетаются от Люцика
    const lxMid = lucik.x + lucik.w / 2;
    const lyMid = lucik.y + lucik.h / 2;
    fireflies.forEach((f) => {
      const dx = f.x - lxMid;
      const dy = f.y - lyMid;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 70) {
        const force = (70 - dist) / 70;
        f.vx += (dx / dist) * force * 0.9;
        f.vy += (dy / dist) * force * 0.9;
      } else {
        f.vx += (f.homeX - f.x) * 0.002;
        f.vy += (f.homeY - f.y) * 0.002;
      }
      f.vx *= 0.96;
      f.vy *= 0.96;
      f.x += f.vx + (Math.random() - 0.5) * 0.15;
      f.y += f.vy;
      f.ph += 0.06;
      f.homeX -= speed * 0.15;
      if (f.homeX < -20) f.homeX = canvas.width + 20;
      if (f.x < -30) f.x = canvas.width + 10;
      if (f.x > canvas.width + 30) f.x = -10;
      if (f.y < 10) f.y = 10;
      if (f.y > gy - 10) f.y = gy - 10;
    });

    // падающие листья
    leaves.forEach((lf) => {
      lf.x += lf.vx - speed * 0.2;
      lf.y += lf.vy + Math.sin(frame * 0.04 + lf.rot) * 0.3;
      lf.rot += lf.spin;
      if (lf.x < -20) {
        lf.x = canvas.width + 10;
        lf.y = Math.random() * gy * 0.55;
      }
      if (lf.y > gy - 5) {
        lf.y = 10 + Math.random() * 40;
        lf.x = Math.random() * canvas.width;
      }
    });

    fogLayers.forEach((fog) => {
      fog.offset = (fog.offset + fog.speed * speed) % (canvas.width + 200);
    });

    // VHS-помехи раз в 5–10 сек
    if (frame >= nextVhsAt) {
      vhsGlitchT = 8 + Math.floor(Math.random() * 10);
      nextVhsAt = frame + 250 + Math.random() * 250;
    }
    if (vhsGlitchT > 0) vhsGlitchT--;

    if (lucik.jumping && lucik.vy < -3) animState = 'jump_up';
    else if (lucik.jumping && lucik.vy > 3) animState = 'land';
    else if (lucik.jumping) animState = 'fly';
    else animState = (hunting || rainbow) ? 'glow' : 'run';

    frameCounter++;
    if (frameCounter >= (hunting ? 4 : 6)) {
      frameCounter = 0;
      if (animState === 'run' || animState === 'glow') currentFrame = currentFrame === 0 ? 1 : 0;
      else if (animState === 'jump_up' || animState === 'land') currentFrame = 2;
      else if (animState === 'fly') currentFrame = 3;
    }

    if (shakeIntensity > 0) {
      camShakeX = (Math.random() - 0.5) * shakeIntensity;
      camShakeY = (Math.random() - 0.5) * shakeIntensity;
      overlay.style.transform = `translate(${camShakeX}px, ${camShakeY}px)`;
      shakeIntensity *= 0.88;
      if (shakeIntensity < 0.35) {
        shakeIntensity = 0;
        camShakeX = 0;
        camShakeY = 0;
        overlay.style.transform = '';
      }
    }

    updateParticles();

    if (phase === PHASE.RUN && distance >= (isMindFlayer ? 380 : 320)) triggerWin();
  }

  function updateParticles() {
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    });
    particles = particles.filter((p) => p.life > 0);
    dirtParticles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
    });
    dirtParticles = dirtParticles.filter((p) => p.life > 0);
  }

  // —— draw ——
  function drawStarPath(x, y, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(x, y - outer);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
      rot += step;
      ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
      rot += step;
    }
    ctx.closePath();
  }

  function drawFearShape(o) {
    const { x, y, w, h, color, eye, shape, fleeing } = o;
    ctx.save();
    if (fleeing) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    ctx.globalAlpha = 0.92;
    if (shape === 'vortex') {
      for (let i = 4; i >= 0; i--) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w * 0.2 * (i + 1), h * 0.15 * (i + 1), frame * 0.05 + i, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (shape === 'demo') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y);
      ctx.lineTo(x + w, y + h * 0.35);
      ctx.lineTo(x + w * 0.85, y + h);
      ctx.lineTo(x + w * 0.15, y + h);
      ctx.lineTo(x, y + h * 0.35);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'flayer') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.4, w * 0.45, h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h * 0.55);
        ctx.quadraticCurveTo(x + w * (0.1 + i * 0.2), y + h * 0.8, x + w * (0.05 + i * 0.22), y + h);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + h * 0.55, w * 0.28, 0, Math.PI * 2);
      ctx.arc(x + w * 0.55, y + h * 0.4, w * 0.32, 0, Math.PI * 2);
      ctx.arc(x + w * 0.75, y + h * 0.55, w * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = eye;
    ctx.shadowColor = eye;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x + w * 0.35, y + h * 0.42, 4, 0, Math.PI * 2);
    ctx.arc(x + w * 0.62, y + h * 0.42, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.fillStyle = 'rgba(0,229,255,0.85)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(o.name || '', x + w / 2, y - 4);
    ctx.textAlign = 'left';
  }

  function drawWell(wObj, showHint) {
    const { x, y, w, h } = wObj;
    // 3D walls going down
    ctx.fillStyle = '#2a2a32';
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + w * 0.35, y + 40);
    ctx.lineTo(x + w * 0.65, y + 40);
    ctx.lineTo(x + w - 8, y);
    ctx.closePath();
    ctx.fill();
    const deep = ctx.createLinearGradient(x, y, x, y + 50);
    deep.addColorStop(0, 'rgba(255,40,40,0.55)');
    deep.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = deep;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 8, w * 0.32, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a4a55';
    ctx.fillRect(x + 4, y - h + 6, w - 8, h - 6);
    ctx.fillStyle = '#2d5a2d';
    ctx.fillRect(x + 6, y - 16, 8, 14);
    ctx.fillRect(x + w - 16, y - 12, 10, 10);

    const rim = ctx.createLinearGradient(x, y - 4, x, y + 8);
    rim.addColorStop(0, '#777');
    rim.addColorStop(1, '#333');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y, w * 0.52, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    if (showHint) {
      const pulse = 0.55 + Math.sin(frame * 0.15) * 0.4;
      ctx.fillStyle = `rgba(0,229,255,${pulse})`;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('В колодец!', x + w / 2, y - h - 8);
      ctx.textAlign = 'left';
    }
  }

  function drawLucik() {
    const breathScale = lucik.breathCycles > 0
      ? 1 + Math.sin(lucik.breath) * 0.045
      : 1;
    const sw = lucik.w * lucik.scale * breathScale;
    const sh = lucik.h * lucik.scale * breathScale;
    const sx = lucik.x + (lucik.w - sw) / 2;
    const sy = lucik.y + (lucik.h - sh);
    const gy = groundY();
    const hunting = phase === PHASE.HUNT;

    // динамический свет от «Звезды» / охоты — круг на земле
    const lightR = hunting || lucik.glow > 0.3 ? 95 + lucik.glow * 40 : 55;
    const lightA = hunting ? 0.32 : (lucik.glow > 0 ? 0.22 : 0.1);
    const lx = lucik.x + lucik.w / 2;
    const light = ctx.createRadialGradient(lx, gy - 4, 4, lx, gy - 4, lightR);
    light.addColorStop(0, `rgba(255, 220, 120, ${lightA})`);
    light.addColorStop(0.45, `rgba(255, 180, 60, ${lightA * 0.35})`);
    light.addColorStop(1, 'rgba(255, 180, 60, 0)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(lx, gy - 2, lightR, lightR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // тень на земле (эллипс, зависит от высоты прыжка)
    if (phase !== PHASE.WELL_INSIDE && phase !== PHASE.WELL_FALL) {
      const air = Math.max(0, (gy - lucik.h - lucik.y) / 80);
      const shadowW = 28 * lucik.scale * (1 - air * 0.4);
      const shadowA = 0.4 * (1 - air * 0.6);
      ctx.fillStyle = `rgba(0,0,0,${shadowA})`;
      ctx.beginPath();
      ctx.ellipse(lx, gy - 1, shadowW, 6 * (1 - air * 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    if (lucik.facing < 0) {
      ctx.translate(sx + sw / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(sx + sw / 2), 0);
    }

    // хвост / шерсть — слой, развевается на бегу
    if (animState === 'run' || animState === 'glow' || animState === 'fly') {
      const wag = Math.sin(frame * 0.35) * 10;
      const tailX = sx + sw * 0.12;
      const tailY = sy + sh * 0.55;
      ctx.strokeStyle = rainbowT > 0
        ? RAINBOW[frame % RAINBOW.length]
        : (lucik.glow > 0 ? '#e8b840' : '#c87820');
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.quadraticCurveTo(
        tailX - 18 + wag * 0.3,
        tailY + 8 + Math.cos(frame * 0.3) * 4,
        tailX - 28,
        tailY - 4 + wag
      );
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,200,100,0.45)';
      ctx.beginPath();
      ctx.moveTo(tailX + 2, tailY - 6);
      ctx.quadraticCurveTo(tailX - 8, tailY - 14 + wag * 0.2, tailX - 16, tailY - 8);
      ctx.stroke();
    }

    if (rainbowT > 0) {
      const c = RAINBOW[Math.floor(frame / 4) % RAINBOW.length];
      ctx.shadowColor = c;
      ctx.shadowBlur = 28;
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, sw * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (lucik.glow > 0) {
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 18 + lucik.glow * 24;
      ctx.fillStyle = `rgba(255,215,0,${0.18 * lucik.glow})`;
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, sw * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    const frameImg = lucikFrames[currentFrame];
    const img = (frameImg?.complete && frameImg.naturalWidth > 0) ? frameImg
      : (lucikImg.complete && lucikImg.naturalWidth > 0 ? lucikImg : null);

    if (img) {
      if (rainbowT > 0) {
        ctx.filter = `hue-rotate(${(frame * 8) % 360}deg) saturate(1.6)`;
      }
      ctx.drawImage(img, sx, sy, sw, sh);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = rainbowT > 0 ? RAINBOW[frame % RAINBOW.length] : (lucik.glow > 0 ? '#FFD700' : '#FF8C00');
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, sw / 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMindFlayerSky(gy) {
    // huge tentacle silhouette
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(canvas.width * 0.5, gy * 0.15, canvas.width * 0.55, gy * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const tx = canvas.width * (0.15 + i * 0.12);
      ctx.strokeStyle = 'rgba(20,0,10,0.7)';
      ctx.lineWidth = 8 + (i % 3) * 3;
      ctx.beginPath();
      ctx.moveTo(tx, gy * 0.25);
      ctx.quadraticCurveTo(
        tx + Math.sin(frame * 0.03 + i) * 40,
        gy * 0.5,
        tx + Math.sin(frame * 0.02 + i * 1.3) * 30,
        gy * 0.85
      );
      ctx.stroke();
    }
    // red lightning
    if (frame % 35 < 5) {
      ctx.strokeStyle = 'rgba(255,30,50,0.85)';
      ctx.lineWidth = 2;
      let lx = canvas.width * (0.3 + Math.random() * 0.4);
      let ly = 10;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      for (let k = 0; k < 6; k++) {
        lx += (Math.random() - 0.5) * 40;
        ly += gy * 0.12;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
  }

  function drawNightSky() {
    const gy = groundY();
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    if (isMindFlayer) {
      sky.addColorStop(0, '#000005');
      sky.addColorStop(0.4, '#0a0208');
      sky.addColorStop(1, '#1a0508');
    } else {
      sky.addColorStop(0, '#050814');
      sky.addColorStop(0.35, '#0a0e27');
      sky.addColorStop(0.7, '#1a0533');
      sky.addColorStop(1, '#2d0a1a');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, gy);

    bgStars.forEach((s) => {
      const a = 0.3 + Math.sin(frame * s.sp + s.tw) * 0.4;
      ctx.fillStyle = `rgba(220,240,255,${a * (isMindFlayer ? 0.5 : 1)})`;
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * gy, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (isMindFlayer) drawMindFlayerSky(gy);

    // clock 3:00 / 3:01
    const cx = canvas.width * 0.82;
    const cy = gy * 0.28;
    const cr = Math.min(55, canvas.width * 0.08);
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#cc0033';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.stroke();
    const minuteAngle = clockMinute === 0 ? -Math.PI / 2 : (-Math.PI / 2 + Math.PI / 30);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minuteAngle) * cr * 0.55, cy + Math.sin(minuteAngle) * cr * 0.55);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(0) * cr * 0.38, cy + Math.sin(0) * cr * 0.38);
    ctx.stroke();
    ctx.fillStyle = '#cc0033';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(clockMinute === 0 ? '3:00' : '3:01', cx, cy + cr + 12);
    ctx.restore();

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const tx = ((t.base - groundOffset * 0.35) % (canvas.width + 160)) - 40;
      const th = t.h;
      // дерево
      ctx.fillStyle = '#0a120a';
      ctx.beginPath();
      ctx.moveTo(tx, gy);
      ctx.lineTo(tx + t.w * 0.5, gy - th);
      ctx.lineTo(tx + t.w, gy);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 30, 50, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // тень от дерева на дорожке (двигается)
      const shadowLen = 40 + th * 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.moveTo(tx + 4, gy);
      ctx.lineTo(tx + t.w - 4, gy);
      ctx.lineTo(tx + t.w * 0.5 + shadowLen * 0.6, gy + 14);
      ctx.lineTo(tx + t.w * 0.2 + shadowLen * 0.3, gy + 16);
      ctx.closePath();
      ctx.fill();
    }

    // светлячки рисуются в drawAtmosphere
  }

  function drawGround() {
    const gy = groundY();
    const g = ctx.createLinearGradient(0, gy, 0, canvas.height);
    g.addColorStop(0, '#1a1028');
    g.addColorStop(0.4, '#2a1840');
    g.addColorStop(1, '#120818');
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, canvas.width, canvas.height - gy);
    for (let x = -groundOffset; x < canvas.width; x += 48) {
      ctx.fillStyle = 'rgba(120,80,180,0.2)';
      ctx.fillRect(x, gy + 8, 24, 2);
    }
    // трава колышется (sin-волна)
    ctx.strokeStyle = '#5a3a7a';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < canvas.width; x += 11) {
      const sway = Math.sin(x * 0.22 + frame * 0.09) * 4;
      const h = 7 + Math.sin(x * 0.31 + frame * 0.07) * 5;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.quadraticCurveTo(x + sway * 0.5, gy - h * 0.5, x + sway, gy - h);
      ctx.stroke();
    }
    cracks.forEach((c) => {
      ctx.strokeStyle = `rgba(255,40,40,${Math.min(1, c.life / 20)})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(c.x, gy);
      ctx.lineTo(c.x + 8, gy + 10);
      ctx.lineTo(c.x - 4, gy + 18);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  function drawAtmosphere() {
    const gy = groundY();
    // три слоя тумана
    fogLayers.forEach((fog, i) => {
      const fy = gy * fog.y;
      const fh = gy * fog.h;
      for (let k = -1; k <= 2; k++) {
        const fx = -fog.offset + k * (canvas.width * 0.7) + i * 50;
        const grd = ctx.createRadialGradient(fx + 120, fy + fh / 2, 10, fx + 120, fy + fh / 2, 160);
        grd.addColorStop(0, `rgba(80, 60, 120, ${fog.alpha})`);
        grd.addColorStop(1, 'rgba(80, 60, 120, 0)');
        ctx.fillStyle = grd;
        ctx.fillRect(fx, fy, 280, fh);
      }
    });

    // светлячки
    fireflies.forEach((f) => {
      const a = 0.35 + Math.sin(f.ph) * 0.45;
      ctx.fillStyle = f.hue === 'gold' ? `rgba(255,220,100,${a})` : `rgba(255,60,60,${a * 0.85})`;
      ctx.shadowColor = f.hue === 'gold' ? '#ffcc66' : '#ff3344';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.hue === 'gold' ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // листья
    leaves.forEach((lf) => {
      ctx.save();
      ctx.translate(lf.x, lf.y);
      ctx.rotate(lf.rot);
      ctx.fillStyle = lf.color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(0, 0, lf.size, lf.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    });
  }

  function drawPostProcess() {
    const w = canvas.width;
    const h = canvas.height;

    // виньетка
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.65, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // зернистость (шум каждый кадр)
    if (grainCtx) {
      const img = grainCtx.createImageData(64, 64);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 28;
      }
      grainCtx.putImageData(img, 0, 0);
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < h; y += 64) {
        for (let x = 0; x < w; x += 64) {
          ctx.drawImage(grainCanvas, 0, 0, 64, 64, x, y, 64, 64);
        }
      }
      ctx.restore();
    }

    // хроматические аберрации по краям (1–2px)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ff0040';
    ctx.fillRect(0, 0, 3, h);
    ctx.fillRect(w - 3, 0, 3, h);
    ctx.fillStyle = '#0040ff';
    ctx.fillRect(1, 0, 2, h);
    ctx.fillRect(w - 4, 0, 2, h);
    ctx.restore();

    // VHS-полосы
    if (vhsGlitchT > 0) {
      const bands = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < bands; i++) {
        const by = Math.random() * h;
        const bh = 2 + Math.random() * 8;
        ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.12})`;
        ctx.fillRect(0, by, w, bh);
        ctx.fillStyle = `rgba(255,0,60,${0.05 + Math.random() * 0.08})`;
        ctx.fillRect(0, by + 1, w, 1);
        ctx.fillStyle = `rgba(0,100,255,${0.05})`;
        ctx.fillRect(2, by, w, bh);
      }
      // горизонтальный сдвиг куска
      if (Math.random() < 0.4) {
        const sy = Math.random() * h;
        const sh = 10 + Math.random() * 30;
        try {
          const slice = ctx.getImageData(0, sy, w, Math.min(sh, h - sy));
          ctx.putImageData(slice, (Math.random() - 0.5) * 12, sy);
        } catch { /* tainted canvas unlikely */ }
      }
    }
  }

  function drawWellInside() {
    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height * 0.42;
    const R = Math.min(canvas.width, canvas.height) * 0.38;
    const par = wellParallax * 0.15;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // 3D tunnel walls
    for (let i = 8; i >= 0; i--) {
      const t = i / 8;
      const rr = R * (0.35 + t * 0.65);
      const yy = cy + (1 - t) * 30 - par * (1 - t);
      ctx.strokeStyle = `rgba(${40 + i * 8},${20},${30},0.5)`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(cx, yy, rr, rr * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // light from above
    const light = ctx.createRadialGradient(cx, cy - R * 0.6, 4, cx, cy, R);
    light.addColorStop(0, 'rgba(255,80,60,0.35)');
    light.addColorStop(0.5, 'rgba(40,0,20,0.3)');
    light.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = light;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    if (frame % 38 < 5) {
      ctx.strokeStyle = 'rgba(255,40,60,0.9)';
      ctx.lineWidth = 2;
      let lx = cx - 30 + Math.random() * 60;
      let ly = cy - R + 8;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      for (let i = 0; i < 5; i++) {
        lx += (Math.random() - 0.5) * 28;
        ly += R * 0.14;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }

    wellShadows.forEach((s) => {
      const sy = cy - R * 0.5 + s.y * R;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath();
      ctx.ellipse(s.x, sy, 36, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff2244';
      ctx.beginPath();
      ctx.arc(s.x - 10, sy - 2, 3, 0, Math.PI * 2);
      ctx.arc(s.x + 8, sy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,229,255,0.8)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name, s.x, sy - 22);
    });

    // fear eye peeking into well (tension)
    if (wellEyeT >= 0 && wellEyeT < 45) {
      const eyeA = wellEyeT > 30 ? (45 - wellEyeT) / 15 : wellEyeT < 15 ? wellEyeT / 15 : 1;
      ctx.globalAlpha = eyeA;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, cy - R + 8, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fear.eye;
      ctx.shadowColor = fear.eye;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, cy - R + 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + 2, cy - R + 8, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // pulsing floating star
    if (!wellStarTaken) {
      const pulse = 1 + Math.sin(frame * 0.18) * 0.22;
      const floatY = Math.sin(frame * 0.08) * 10;
      ctx.save();
      ctx.translate(cx, cy + R * 0.2 + floatY);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 24;
      drawStarPath(0, 0, 5, 16, 7);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,215,0,0.55)';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ Звезда!', cx, cy + R * 0.28);
    }

    ctx.restore();

    // stone rim
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Lucik peeking
    const peekH = 28 + lucik.peek * 36;
    const px = cx - 30;
    const py = cy + R - peekH * 0.35;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, cy + R - peekH, canvas.width, peekH + 20);
    ctx.clip();
    const img = lucikImg.complete && lucikImg.naturalWidth > 0 ? lucikImg : null;
    if (img) ctx.drawImage(img, px, py, 60, 60);
    else {
      ctx.fillStyle = '#FF8C00';
      ctx.beginPath();
      ctx.arc(px + 30, py + 30, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(0,229,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Страхи не замечают тебя…', cx, cy + R + 28);
    ctx.textAlign = 'left';
  }

  function drawIntroOverlay() {
    if (introT < 45) {
      ctx.fillStyle = 'rgba(0,229,255,0.85)';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Люцик и Обратная сторона', canvas.width / 2, 40);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${fear.emoji} ${fear.name}${isMindFlayer ? ' · 5-й забег' : ''}`, canvas.width / 2, 64);
      ctx.textAlign = 'left';
    }

    if (chaseFear) {
      const f = chaseFear;
      const gy = groundY();
      // body rising from ground
      ctx.fillStyle = 'rgba(0,0,0,0.88)';
      ctx.beginPath();
      ctx.ellipse(f.x, gy - f.h / 2, 42, f.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // crack in ground
      ctx.strokeStyle = 'rgba(255,40,40,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x - 30, gy);
      ctx.lineTo(f.x, gy + 6);
      ctx.lineTo(f.x + 30, gy);
      ctx.stroke();
      if (f.h > 35) {
        ctx.fillStyle = fear.eye;
        ctx.shadowColor = fear.eye;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(f.x - 12, gy - f.h * 0.65, 5, 0, Math.PI * 2);
        ctx.arc(f.x + 12, gy - f.h * 0.65, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    if (introT > 55 && introT < 120) {
      ctx.fillStyle = 'rgba(204,0,51,0.9)';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isMindFlayer ? 'Он выползает…' : 'Он рядом…', canvas.width / 2, canvas.height * 0.32);
      ctx.textAlign = 'left';
    }
  }

  function draw() {
    if (phase === PHASE.WELL_INSIDE) {
      drawWellInside();
      drawParticlesLayer();
      drawPostProcess();
      return;
    }

    drawNightSky();
    drawAtmosphere();
    drawGround();

    if (well && !well.used) {
      const near = well.x - lucik.x < 160 && well.x > lucik.x;
      drawWell(well, near && phase === PHASE.RUN);
    }

    trackStars.forEach((s) => {
      if (s.taken) return;
      const pulse = 1 + Math.sin(frame * 0.2) * 0.15;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      drawStarPath(0, 0, 5, s.r, 4);
      ctx.fill();
      ctx.restore();
    });

    obstacles.forEach((o) => {
      if (o.type === 'fear' && !o.hit) drawFearShape(o);
    });

    speedLines.forEach((l) => {
      ctx.strokeStyle = `rgba(255,255,255,${l.life / 14})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x, l.y + l.len);
      ctx.stroke();
    });

    trailStars.forEach((t) => {
      ctx.fillStyle = `rgba(255,215,0,${t.life / 18})`;
      ctx.beginPath();
      drawStarPath(t.x, t.y, 5, 5, 2);
      ctx.fill();
    });

    drawParticlesLayer();
    drawLucik();

    if (phase === PHASE.INTRO) drawIntroOverlay();

    if (phase === PHASE.HUNT) {
      ctx.fillStyle = 'rgba(255,215,0,0.9)';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⚡ ОХОТА · ${Math.max(0, Math.ceil((250 - huntT) / 50))}с${combo > 1 ? ` · COMBO x${combo}` : ''}`, canvas.width / 2, 28);
      ctx.textAlign = 'left';
    }

    if (rainbowT > 0) {
      ctx.fillStyle = RAINBOW[frame % RAINBOW.length];
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🌈 РАДУГА · ${Math.ceil(rainbowT / 50)}с`, canvas.width / 2, phase === PHASE.HUNT ? 48 : 28);
      ctx.textAlign = 'left';
    }

    if (phase === PHASE.WIN_SLOWMO || phase === PHASE.WON) {
      fireworks.forEach((f) => {
        ctx.fillStyle = f.color;
        ctx.globalAlpha = Math.min(1, f.life / 20);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    if (phase === PHASE.LOST) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff4466';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Страх догнал…', canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = '#00e5ff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${Math.floor(distance)}м · ⭐ ${score}`, canvas.width / 2, canvas.height / 2 + 32);
      ctx.textAlign = 'left';
    }

    if (timeScale < 1 && (phase === PHASE.HUNT || phase === PHASE.WELL_EXIT || phase === PHASE.WIN_SLOWMO)) {
      ctx.fillStyle = 'rgba(0,229,255,0.35)';
      ctx.font = '11px sans-serif';
      ctx.fillText('SLOW-MO', 12, canvas.height - 12);
    }

    drawPostProcess();
  }

  function drawParticlesLayer() {
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 15);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    dirtParticles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 18);
      ctx.fillRect(p.x, p.y, p.r, p.r);
      ctx.globalAlpha = 1;
    });
  }

  // —— photo / share ——
  function composeShareCanvas(extraLines = []) {
    const out = document.createElement('canvas');
    out.width = Math.max(480, canvas.width);
    out.height = Math.max(320, canvas.height + 70);
    const octx = out.getContext('2d');
    octx.fillStyle = '#0a0e27';
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(canvas, 0, 50, out.width, canvas.height);
    // frame
    octx.strokeStyle = '#00e5ff';
    octx.lineWidth = 4;
    octx.strokeRect(6, 6, out.width - 12, out.height - 12);
    octx.strokeStyle = '#cc0033';
    octx.lineWidth = 2;
    octx.strokeRect(12, 12, out.width - 24, out.height - 24);
    octx.fillStyle = '#00e5ff';
    octx.font = 'bold 20px Georgia, serif';
    octx.textAlign = 'center';
    octx.fillText('🐱 Люцик и Обратная сторона', out.width / 2, 34);
    octx.font = '14px sans-serif';
    octx.fillStyle = '#ffd700';
    const lines = [
      `${fear.emoji} ${fear.name} · ${Math.floor(distance)}м · ⭐ ${score}`,
      ...extraLines
    ];
    lines.forEach((line, i) => {
      octx.fillText(line, out.width / 2, out.height - 28 + i * 0);
    });
    octx.fillText(lines[0], out.width / 2, out.height - 22);
    octx.textAlign = 'left';
    return out;
  }

  function openShareSheet(dataUrl, title) {
    const sheet = document.createElement('div');
    sheet.className = 'runner-share-sheet';
    sheet.innerHTML = `
      <div style="text-align:center;">
        <img src="${dataUrl}" alt="Скриншот">
        <div class="runner-share-actions">
          <button type="button" class="runner-btn share" id="shareVk">Поделиться в ВК</button>
          <a class="runner-btn secondary" id="shareDl" download="lucik-upsidedown.png" href="${dataUrl}" style="text-decoration:none;text-align:center;">💾 Скачать</a>
          <button type="button" class="runner-btn ghost" id="shareClose">Закрыть</button>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.querySelector('#shareClose').onclick = () => sheet.remove();
    sheet.querySelector('#shareVk').onclick = () => {
      const text = encodeURIComponent(title || `Люцик и Обратная сторона — ${Math.floor(distance)}м, ⭐${score}`);
      const url = encodeURIComponent(window.location.href.split('#')[0]);
      window.open(`https://vk.com/share.php?url=${url}&title=${text}`, '_blank', 'noopener,width=600,height=400');
    };
  }

  function takePhoto() {
    try {
      const shot = composeShareCanvas();
      const dataUrl = shot.toDataURL('image/png');
      const toast = document.createElement('div');
      toast.className = 'runner-photo-toast';
      toast.textContent = '📸 Снимок готов';
      overlay.appendChild(toast);
      setTimeout(() => toast.remove(), 1200);
      openShareSheet(dataUrl, `Люцик против ${fear.name}! ${Math.floor(distance)}м`);
      trackEvent('runner_photo', { distance: Math.floor(distance), score });
    } catch (e) {
      console.warn('photo failed', e);
    }
  }

  function showResult(didWin) {
    recordGameResult('runner', didWin, level);
    trackEvent(didWin ? 'runner_won' : 'runner_lost', {
      level, score, distance: Math.floor(distance), fear: fear.id, mindflayer: isMindFlayer, portal: closedPortal
    });

    const title = didWin
      ? (closedPortal ? 'Люцик закрыл портал!' : `Люцик прогнал ${fear.name}!`)
      : 'Почти получилось!';
    const sub = didWin
      ? (closedPortal ? 'Обратная сторона запечатана. Ты герой.' : 'Сегодня он смелее. А ты?')
      : 'Страх ещё рядом — но Люцик верит в тебя.';

    speak(title);

    const prevBest = parseInt(localStorage.getItem('runner-best') || '0', 10);
    const newBest = Math.max(prevBest, Math.floor(distance));
    localStorage.setItem('runner-best', String(newBest));

    const result = document.createElement('div');
    result.className = `runner-result${closedPortal ? ' mindflayer-win' : ''}`;
    result.innerHTML = `
      <div class="runner-result-box ${didWin ? 'win' : ''}">
        <div class="emoji">${didWin ? (closedPortal ? '🌀' : '🌟') : '😅'}</div>
        <h2>${title}</h2>
        <p class="sub">${sub}</p>
        <p class="stats">🏃 Дистанция: <b>${Math.floor(distance)}м</b></p>
        <p class="stats">⭐ Очки: <b>${score}</b></p>
        <p class="stats">🏆 Рекорд: <b>${newBest}м</b></p>
        <button type="button" class="runner-btn primary" id="restartRunner">🔄 Ещё забег</button>
        <button type="button" class="runner-btn secondary" id="otherFear">👻 Другой страх</button>
        <button type="button" class="runner-btn share" id="shareResult">📤 Поделиться</button>
        <button type="button" class="runner-btn ghost" id="exitRunner">🚪 Выйти</button>
        <p class="clock-ref">⏱ Часы показывают ${clockMinute === 1 ? '3:01' : '3:00'}</p>
      </div>
    `;
    document.body.appendChild(result);

    result.querySelector('#restartRunner').onclick = () => { result.remove(); startRunnerGame(level); };
    result.querySelector('#otherFear').onclick = () => {
      result.remove();
      startRunnerGame(level >= 5 ? 1 : level + 1);
    };
    result.querySelector('#exitRunner').onclick = () => {
      result.remove();
      if (typeof showGamesMenu === 'function') showGamesMenu();
    };
    result.querySelector('#shareResult').onclick = () => {
      // recreate last frame visually on temp canvas
      const shot = document.createElement('canvas');
      shot.width = 640;
      shot.height = 400;
      const sctx = shot.getContext('2d');
      const grd = sctx.createLinearGradient(0, 0, 0, 400);
      grd.addColorStop(0, '#0a0e27');
      grd.addColorStop(1, didWin ? '#1a3a2a' : '#2d0a1a');
      sctx.fillStyle = grd;
      sctx.fillRect(0, 0, 640, 400);
      sctx.strokeStyle = '#00e5ff';
      sctx.lineWidth = 4;
      sctx.strokeRect(10, 10, 620, 380);
      sctx.fillStyle = '#00e5ff';
      sctx.font = 'bold 24px Georgia, serif';
      sctx.textAlign = 'center';
      sctx.fillText('🐱 Люцик и Обратная сторона', 320, 60);
      sctx.fillStyle = '#ffd700';
      sctx.font = 'bold 22px sans-serif';
      sctx.fillText(title, 320, 140);
      sctx.fillStyle = '#e8f4ff';
      sctx.font = '16px sans-serif';
      sctx.fillText(`${Math.floor(distance)}м · ⭐ ${score} · Рекорд ${newBest}м`, 320, 190);
      sctx.fillStyle = '#cc0033';
      sctx.fillText(`⏱ ${clockMinute === 1 ? '3:01' : '3:00'}`, 320, 240);
      sctx.fillStyle = '#889';
      sctx.font = '13px sans-serif';
      sctx.fillText(sub, 320, 300);
      openShareSheet(shot.toDataURL('image/png'), title);
    };

    window.leaderboard?.submitScore('runner', Math.floor(distance) + score);
  }

  function finish(didWin) {
    clearInterval(loop);
    window.removeEventListener('resize', resize);
    cleanupAudio();
    overlay.style.transform = '';
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    showResult(didWin);
  }

  canvas.addEventListener('click', jump);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });

  const loop = setInterval(() => {
    update();
    draw();
    if ((phase === PHASE.LOST || phase === PHASE.WON) && !finished) {
      finished = true;
      if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
      stopDrone();
      setTimeout(() => finish(phase === PHASE.WON || won), phase === PHASE.WON ? 1100 : 1600);
    }
  }, 20);

  document.getElementById('runnerMusic').onclick = function onMusic() {
    this.textContent = toggleMusic() ? '🔊' : '🔇';
  };
  document.getElementById('runnerPhoto').onclick = (e) => {
    e.stopPropagation();
    takePhoto();
  };
  document.getElementById('runnerClose').onclick = () => {
    clearInterval(loop);
    window.removeEventListener('resize', resize);
    cleanupAudio();
    overlay.style.transform = '';
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('runner_started', { level, fear: fear.id, mindflayer: isMindFlayer, run: runCount });
}

export default { startRunnerGame };
