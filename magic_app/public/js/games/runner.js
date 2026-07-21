// ========================================
// runner.js — «Люцик и Обратная сторона»
// Stranger Things × Subway Surfers × Mario
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
  WON: 'won',
  LOST: 'lost'
};

export function startRunnerGame(level = 1) {
  document.querySelectorAll('.game-fullscreen, .game-screen, .runner-result').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = true;
  level = Math.max(1, Math.min(5, level || 1));

  const fear = FEARS[Math.min(level - 1, FEARS.length - 1)];

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen runner-game';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.className = 'runner-header';
  header.innerHTML = `
    <span>🐱 Обратная сторона</span>
    <span>🏃 <b id="runnerDistance">0</b>м · ⭐ <b id="runnerScore">0</b></span>
    <span id="runnerFearLabel">${fear.emoji} ${fear.name}</span>
    <button type="button" id="runnerMusic" aria-label="Музыка">🔊</button>
    <button type="button" id="runnerClose" aria-label="Закрыть">✕</button>
  `;

  const canvas = document.createElement('canvas');
  overlay.appendChild(header);
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');

  // —— state ——
  const groundY = () => canvas.height - 58;
  const lucik = {
    x: 0, y: 0, w: 68, h: 68, vy: 0,
    jumping: false, scale: 1, glow: 0, peek: 0
  };

  let phase = PHASE.INTRO;
  let introT = 0;
  let wellT = 0;
  let huntT = 0;
  let obstacles = [];
  let trailStars = [];
  let particles = [];
  let bgStars = [];
  let fireflies = [];
  let cracks = [];
  let wellShadows = [];
  let score = 0;
  let distance = 0;
  let speed = 3.2;
  let baseSpeed = 3.2;
  let frame = 0;
  let jumpCount = 0;
  let finished = false;
  let groundOffset = 0;
  let shakeIntensity = 0;
  let well = null;
  let wellStarTaken = false;
  let invuln = 0;
  let chaseFear = null;
  let won = false;
  let musicMode = 'flee'; // flee | well | hunt | win

  // sprites
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

  // —— audio ——
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let musicOn = true;
  let musicInterval = null;
  let droneNodes = [];

  function resumeAudio() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function beep(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
    if (!musicOn) return;
    resumeAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideTo != null) osc.frequency.linearRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }

  function playHeartbeat() {
    beep(55, 0.12, 'sine', 0.2);
    setTimeout(() => beep(45, 0.18, 'sine', 0.18), 180);
  }

  function playJumpSound() {
    beep(280, 0.18, 'square', 0.08, 520);
  }

  function playStarSound() {
    beep(880, 0.12, 'sine', 0.14, 1320);
    setTimeout(() => beep(1320, 0.2, 'triangle', 0.1), 80);
  }

  function playHuntSound() {
    beep(220, 0.4, 'sawtooth', 0.08, 660);
    setTimeout(() => beep(440, 0.5, 'triangle', 0.1, 880), 120);
  }

  function playShatter() {
    beep(180, 0.15, 'sawtooth', 0.1, 40);
    beep(600, 0.2, 'square', 0.05, 1200);
  }

  function playWinChime() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => beep(f, 0.35, 'sine', 0.1), i * 120);
    });
  }

  function stopDrone() {
    droneNodes.forEach((n) => {
      try { n.stop(); } catch { /* */ }
    });
    droneNodes = [];
  }

  function startDrone(freq = 48, vol = 0.04) {
    stopDrone();
    if (!musicOn) return;
    resumeAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    droneNodes.push(osc);
  }

  function startMusic(mode = 'flee') {
    musicMode = mode;
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
    stopDrone();
    if (!musicOn) return;

    if (mode === 'well') {
      startDrone(36, 0.025);
      return;
    }
    if (mode === 'win') {
      playWinChime();
      return;
    }

    const fleeNotes = [110, 130, 146, 110, 98, 130, 164, 146];
    const huntNotes = [220, 277, 330, 370, 440, 370, 330, 277];
    const notes = mode === 'hunt' ? huntNotes : fleeNotes;
    let i = 0;
    startDrone(mode === 'hunt' ? 55 : 42, mode === 'hunt' ? 0.03 : 0.045);

    musicInterval = setInterval(() => {
      if (!musicOn || phase === PHASE.LOST || phase === PHASE.WON) {
        clearInterval(musicInterval);
        musicInterval = null;
        return;
      }
      const f = notes[i % notes.length];
      beep(f, mode === 'hunt' ? 0.22 : 0.28, mode === 'hunt' ? 'square' : 'sawtooth', mode === 'hunt' ? 0.045 : 0.035);
      if (mode === 'hunt' && i % 4 === 0) beep(f * 2, 0.12, 'triangle', 0.03);
      i++;
    }, mode === 'hunt' ? 220 : 320);
  }

  function toggleMusic() {
    musicOn = !musicOn;
    if (!musicOn) {
      if (musicInterval) clearInterval(musicInterval);
      musicInterval = null;
      stopDrone();
    } else if (phase !== PHASE.LOST && phase !== PHASE.WON && phase !== PHASE.INTRO) {
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

  // —— setup bg ——
  function initDecor() {
    bgStars = Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.55,
      r: 0.5 + Math.random() * 1.8,
      tw: Math.random() * Math.PI * 2,
      sp: 0.02 + Math.random() * 0.04
    }));
    fireflies = Array.from({ length: 18 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.7,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.4,
      hue: Math.random() < 0.55 ? 'gold' : 'red',
      ph: Math.random() * Math.PI * 2
    }));
  }

  function resize() {
    canvas.width = overlay.clientWidth;
    canvas.height = Math.max(200, overlay.clientHeight - header.offsetHeight);
    lucik.x = canvas.width * 0.28;
    if (phase === PHASE.INTRO || phase === PHASE.RUN || phase === PHASE.HUNT) {
      lucik.y = groundY() - lucik.h;
    }
    if (!bgStars.length) initDecor();
  }
  resize();
  window.addEventListener('resize', resize);

  // —— spawn helpers ——
  function spawnFearObstacle(kind = 'chase') {
    if (canvas.width <= 0) return;
    const scale = 1 + Math.min(0.5, distance * 0.00025);
    const variants = [
      { fearId: 'darkness', w: 50 * scale, h: 44 * scale },
      { fearId: 'height', w: 42 * scale, h: 52 * scale },
      { fearId: 'lonely', w: 46 * scale, h: 48 * scale },
      { fearId: 'monsters', w: 54 * scale, h: 56 * scale }
    ];
    const v = variants[Math.floor(Math.random() * variants.length)];
    const meta = FEARS.find((f) => f.id === v.fearId) || fear;
    obstacles.push({
      type: 'fear',
      kind,
      fearId: v.fearId,
      name: meta.name,
      color: meta.color,
      eye: meta.eye,
      shape: meta.shape,
      x: canvas.width + 20,
      y: groundY() - v.h,
      w: v.w,
      h: v.h,
      fleeing: phase === PHASE.HUNT,
      hit: false
    });
  }

  function spawnWell() {
    if (well || canvas.width <= 0) return;
    well = {
      x: canvas.width + 40,
      y: groundY() - 8,
      w: 72,
      h: 52,
      used: false
    };
  }

  function spawnCrack() {
    cracks.push({
      x: canvas.width,
      life: 40 + Math.random() * 30
    });
  }

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1,
        life: 20 + Math.random() * 20,
        color,
        r: 2 + Math.random() * 3
      });
    }
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
    wellShadows = [];
    wellStarTaken = false;
  }

  function startHunt() {
    phase = PHASE.HUNT;
    huntT = 0;
    invuln = 250; // ~5s at 20ms
    lucik.glow = 1;
    lucik.scale = 1;
    lucik.peek = 0;
    lucik.y = groundY() - lucik.h;
    well = null;
    overlay.classList.remove('runner-well');
    overlay.classList.add('runner-hunt');
    baseSpeed = speed;
    speed = baseSpeed * 1.5;
    obstacles.forEach((o) => { if (o.type === 'fear') o.fleeing = true; });
    startMusic('hunt');
    playHuntSound();
    burst(lucik.x + lucik.w / 2, lucik.y + lucik.h / 2, '#FFD700', 24);
  }

  function jump() {
    if (phase === PHASE.INTRO || phase === PHASE.WELL_FALL || phase === PHASE.WELL_INSIDE ||
        phase === PHASE.WELL_EXIT || phase === PHASE.LOST || phase === PHASE.WON) return;
    if (jumpCount >= 2) return;
    lucik.vy = jumpCount === 0 ? -13 : -9;
    lucik.jumping = true;
    jumpCount++;
    playJumpSound();
  }

  // —— intro ——
  function updateIntro() {
    introT++;
    lucik.y = groundY() - lucik.h;
    animState = 'idle';

    if (introT === 1) {
      resumeAudio();
      startDrone(40, 0.03);
    }
    if (introT === 50) {
      shakeIntensity = 10;
      playHeartbeat();
    }
    if (introT === 70) playHeartbeat();
    if (introT === 55) {
      chaseFear = {
        x: canvas.width * 0.72,
        y: groundY() - 90,
        h: 0,
        maxH: 100,
        eyes: true
      };
    }
    if (chaseFear && chaseFear.h < chaseFear.maxH) {
      chaseFear.h += 2.2;
    }
    if (introT === 120) {
      animState = 'run';
      phase = PHASE.RUN;
      stopDrone();
      startMusic('flee');
      speak(`Беги от ${fear.name}!`);
    }
  }

  // —— well phases ——
  function updateWellFall() {
    wellT++;
    lucik.scale = Math.max(0.15, 1 - wellT / 35);
    lucik.y += 2.5;
    animState = 'fall';
    if (wellT >= 35) {
      phase = PHASE.WELL_INSIDE;
      wellT = 0;
      lucik.scale = 1;
      lucik.peek = 0;
      wellShadows = [
        { name: 'Темнота', x: -80, speed: 4.5, y: 0.22 },
        { name: 'Высота', x: -200, speed: 3.8, y: 0.38 },
        { name: 'Одиночество', x: -360, speed: 5.2, y: 0.3 }
      ];
    }
  }

  function updateWellInside() {
    wellT++;
    lucik.peek = Math.min(1, wellT / 25);
    animState = 'peek';

    wellShadows.forEach((s) => { s.x += s.speed; });

    // take star around mid, then exit
    if (wellT === 55 && !wellStarTaken) {
      wellStarTaken = true;
      playStarSound();
      score += 25;
      const el = document.getElementById('runnerScore');
      if (el) el.textContent = score;
      burst(canvas.width / 2, canvas.height * 0.55, '#FFD700', 30);
    }

    if (wellT >= 90) {
      phase = PHASE.WELL_EXIT;
      wellT = 0;
      lucik.peek = 0;
    }
  }

  function updateWellExit() {
    wellT++;
    animState = 'jump_up';
    lucik.glow = Math.min(1, wellT / 15);
    if (wellT >= 20) startHunt();
  }

  function updateHunt() {
    huntT++;
    invuln = Math.max(0, invuln - 1);
    lucik.glow = 0.7 + Math.sin(frame * 0.2) * 0.3;

    if (frame % 3 === 0) {
      trailStars.push({
        x: lucik.x + lucik.w * 0.3,
        y: lucik.y + lucik.h * 0.5 + (Math.random() - 0.5) * 20,
        life: 18
      });
    }

    if (huntT >= 250) {
      // end hunt → victory if survived far enough, else back to run
      phase = PHASE.WON;
      won = true;
      startMusic('win');
      overlay.classList.remove('runner-hunt');
      speed = baseSpeed;
      lucik.glow = 0.5;
    }
  }

  // —— main update ——
  function update() {
    if (phase === PHASE.LOST || phase === PHASE.WON) return;
    frame++;

    if (phase === PHASE.INTRO) {
      updateIntro();
      updateParticles();
      return;
    }
    if (phase === PHASE.WELL_FALL) {
      updateWellFall();
      updateParticles();
      return;
    }
    if (phase === PHASE.WELL_INSIDE) {
      updateWellInside();
      updateParticles();
      return;
    }
    if (phase === PHASE.WELL_EXIT) {
      updateWellExit();
      updateParticles();
      return;
    }

    const hunting = phase === PHASE.HUNT;
    if (hunting) updateHunt();

    distance += speed * 0.12;
    const distEl = document.getElementById('runnerDistance');
    if (distEl) distEl.textContent = Math.floor(distance);

    // physics
    lucik.vy += 0.62;
    lucik.y += lucik.vy;
    const gy = groundY();
    if (lucik.y >= gy - lucik.h) {
      lucik.y = gy - lucik.h;
      lucik.vy = 0;
      lucik.jumping = false;
      jumpCount = 0;
    }

    // move world
    const move = speed;
    obstacles.forEach((o) => {
      o.x -= o.fleeing ? move * 1.35 : move;
    });
    if (well && !well.used) well.x -= move;
    cracks.forEach((c) => { c.x -= move; c.life--; });
    cracks = cracks.filter((c) => c.life > 0 && c.x > -40);
    trailStars.forEach((t) => { t.x -= move * 0.4; t.life--; });
    trailStars = trailStars.filter((t) => t.life > 0);

    obstacles = obstacles.filter((o) => o.x > -80 && !o.hit);

    // well proximity / enter
    if (well && !well.used && phase === PHASE.RUN) {
      const near = lucik.x + lucik.w > well.x + 8 && lucik.x < well.x + well.w - 8;
      const vertically = lucik.y + lucik.h > well.y - 40;
      if (near && vertically) enterWell();
    }

    // collisions
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
        if (hunting || invuln > 0) {
          o.hit = true;
          score += 10;
          const el = document.getElementById('runnerScore');
          if (el) el.textContent = score;
          burst(o.x + o.w / 2, o.y + o.h / 2, o.eye || '#ff4466', 18);
          playShatter();
        } else {
          phase = PHASE.LOST;
          shakeIntensity = 12;
          beep(80, 0.4, 'sawtooth', 0.12, 30);
        }
      }
    }

    // spawns
    if (phase === PHASE.RUN || phase === PHASE.HUNT) {
      const minGap = Math.max(160, 380 - distance * 0.12);
      const last = obstacles[obstacles.length - 1];
      const spawnRate = hunting ? 0.035 : 0.012 + distance * 0.000035;
      if ((!last || last.x < canvas.width - minGap) && Math.random() < spawnRate) {
        spawnFearObstacle(hunting ? 'flee' : 'chase');
      }
      // well once around mid-run
      if (phase === PHASE.RUN && !well && distance > 55 && distance < 70) {
        spawnWell();
      }
      if (Math.random() < 0.012) spawnCrack();
      if (!hunting) speed = Math.min(11, 3.2 + distance * 0.0028);
      else speed = Math.min(14, baseSpeed * 1.5);
    }

    groundOffset = (groundOffset + speed) % 48;

    // fireflies
    fireflies.forEach((f) => {
      f.x += f.vx;
      f.y += f.vy;
      f.ph += 0.05;
      if (f.x < 0) f.x = canvas.width;
      if (f.x > canvas.width) f.x = 0;
      if (f.y < 0) f.y = canvas.height * 0.6;
      if (f.y > canvas.height * 0.75) f.y = 20;
    });

    // anim
    if (lucik.jumping && lucik.vy < -3) animState = 'jump_up';
    else if (lucik.jumping && lucik.vy > 3) animState = 'land';
    else if (lucik.jumping) animState = 'fly';
    else animState = hunting ? 'glow' : 'run';

    frameCounter++;
    if (frameCounter >= (hunting ? 4 : 6)) {
      frameCounter = 0;
      if (animState === 'run' || animState === 'glow') currentFrame = currentFrame === 0 ? 1 : 0;
      else if (animState === 'jump_up' || animState === 'land') currentFrame = 2;
      else if (animState === 'fly') currentFrame = 3;
    }

    if (shakeIntensity > 0) {
      const sx = (Math.random() - 0.5) * shakeIntensity;
      const sy = (Math.random() - 0.5) * shakeIntensity;
      overlay.style.transform = `translate(${sx}px, ${sy}px)`;
      shakeIntensity *= 0.92;
      if (shakeIntensity < 0.4) {
        shakeIntensity = 0;
        overlay.style.transform = '';
      }
    }

    updateParticles();

    // win by distance without well (fallback)
    if (phase === PHASE.RUN && distance >= 320) {
      phase = PHASE.WON;
      won = true;
      startMusic('win');
    }
  }

  function updateParticles() {
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life--;
    });
    particles = particles.filter((p) => p.life > 0);
  }

  // —— draw helpers ——
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
      // petals / petals like demogorgon
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        ctx.fillStyle = '#3a0a5a';
        ctx.beginPath();
        ctx.ellipse(
          x + w / 2 + Math.cos(a) * w * 0.22,
          y + h * 0.28 + Math.sin(a) * h * 0.12,
          w * 0.12, h * 0.18, a, 0, Math.PI * 2
        );
        ctx.fill();
      }
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
        ctx.quadraticCurveTo(
          x + w * (0.1 + i * 0.2), y + h * 0.8,
          x + w * (0.05 + i * 0.22), y + h
        );
        ctx.stroke();
      }
    } else {
      // cloud / shadow
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y + h * 0.55, w * 0.28, 0, Math.PI * 2);
      ctx.arc(x + w * 0.55, y + h * 0.4, w * 0.32, 0, Math.PI * 2);
      ctx.arc(x + w * 0.75, y + h * 0.55, w * 0.26, 0, Math.PI * 2);
      ctx.arc(x + w * 0.5, y + h * 0.7, w * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // eyes
    ctx.fillStyle = eye;
    ctx.shadowColor = eye;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x + w * 0.35, y + h * 0.42, 4, 0, Math.PI * 2);
    ctx.arc(x + w * 0.62, y + h * 0.42, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // label
    ctx.fillStyle = 'rgba(0,229,255,0.85)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(o.name || '', x + w / 2, y - 4);
    ctx.textAlign = 'left';
  }

  function drawWell(wObj, showHint) {
    const { x, y, w, h } = wObj;
    // stone rim
    const stone = ctx.createLinearGradient(x, y - h, x, y + 10);
    stone.addColorStop(0, '#5a5a5a');
    stone.addColorStop(0.5, '#3a3a42');
    stone.addColorStop(1, '#1a1a22');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y, w * 0.55, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // red glow inside
    const glow = ctx.createRadialGradient(x + w / 2, y, 2, x + w / 2, y, w * 0.4);
    glow.addColorStop(0, 'rgba(255, 40, 40, 0.85)');
    glow.addColorStop(0.5, 'rgba(120, 0, 40, 0.5)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y, w * 0.38, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // moss
    ctx.fillStyle = '#2d5a2d';
    ctx.fillRect(x + 4, y - 18, 8, 16);
    ctx.fillRect(x + w - 14, y - 14, 10, 12);
    ctx.fillStyle = '#3a6a3a';
    ctx.fillRect(x + w * 0.4, y - 22, 12, 10);

    // walls
    ctx.fillStyle = '#44444e';
    ctx.fillRect(x + 6, y - h + 8, w - 12, h - 8);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(x + 6, y - h + 8, w - 12, h - 8);

    if (showHint) {
      const pulse = 0.6 + Math.sin(frame * 0.15) * 0.4;
      ctx.fillStyle = `rgba(0, 229, 255, ${pulse})`;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('В колодец!', x + w / 2, y - h - 8);
      ctx.textAlign = 'left';
    }
  }

  function drawLucik() {
    const sw = lucik.w * lucik.scale;
    const sh = lucik.h * lucik.scale;
    const sx = lucik.x + (lucik.w - sw) / 2;
    const sy = lucik.y + (lucik.h - sh);

    if (lucik.glow > 0) {
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 20 + lucik.glow * 25;
      ctx.fillStyle = `rgba(255, 215, 0, ${0.15 * lucik.glow})`;
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, sw * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // shadow
    if (phase !== PHASE.WELL_INSIDE && phase !== PHASE.WELL_FALL) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(lucik.x + lucik.w / 2, groundY() - 2, 26 * lucik.scale, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const frameImg = lucikFrames[currentFrame];
    const img = (frameImg?.complete && frameImg.naturalWidth > 0) ? frameImg
      : (lucikImg.complete && lucikImg.naturalWidth > 0 ? lucikImg : null);

    if (img) {
      ctx.drawImage(img, sx, sy, sw, sh);
    } else {
      ctx.fillStyle = lucik.glow > 0 ? '#FFD700' : '#FF8C00';
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, sw / 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(sx + sw * 0.38, sy + sh * 0.4, 3, 0, Math.PI * 2);
      ctx.arc(sx + sw * 0.62, sy + sh * 0.4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawNightSky() {
    const gy = groundY();
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#050814');
    sky.addColorStop(0.35, '#0a0e27');
    sky.addColorStop(0.7, '#1a0533');
    sky.addColorStop(1, '#2d0a1a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, gy);

    // stars
    bgStars.forEach((s) => {
      const a = 0.35 + Math.sin(frame * s.sp + s.tw) * 0.45;
      ctx.fillStyle = `rgba(220, 240, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * gy, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // giant clock (Stranger Things ref)
    const cx = canvas.width * 0.82;
    const cy = gy * 0.28;
    const cr = Math.min(55, canvas.width * 0.08);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#cc0033';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(-Math.PI / 2) * cr * 0.55, cy + Math.sin(-Math.PI / 2) * cr * 0.55);
    ctx.moveTo(cx, cy);
    // 3:00 — hour hand to the right
    ctx.lineTo(cx + Math.cos(0) * cr * 0.4, cy + Math.sin(0) * cr * 0.4);
    ctx.stroke();
    ctx.fillStyle = '#cc0033';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('3:00', cx, cy + cr + 12);
    ctx.restore();

    // trees with red glow
    for (let i = 0; i < 7; i++) {
      const tx = ((i * 160 - groundOffset * 0.3) % (canvas.width + 160)) - 40;
      const th = 70 + (i % 3) * 25;
      ctx.fillStyle = '#0a120a';
      ctx.beginPath();
      ctx.moveTo(tx, gy);
      ctx.lineTo(tx + 18, gy - th);
      ctx.lineTo(tx + 36, gy);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 30, 50, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // fireflies / sparks
    fireflies.forEach((f) => {
      const a = 0.4 + Math.sin(f.ph) * 0.4;
      ctx.fillStyle = f.hue === 'gold'
        ? `rgba(255, 220, 100, ${a})`
        : `rgba(255, 60, 60, ${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.hue === 'gold' ? 2.2 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    });
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
      ctx.fillStyle = 'rgba(120, 80, 180, 0.2)';
      ctx.fillRect(x, gy + 8, 24, 2);
    }

    // grass blades purple tint
    ctx.strokeStyle = '#5a3a7a';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < canvas.width; x += 14) {
      const h = 6 + Math.sin(x * 0.25 + frame * 0.08) * 4;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + 2, gy - h);
      ctx.stroke();
    }

    // cracks
    cracks.forEach((c) => {
      ctx.strokeStyle = `rgba(255, 40, 40, ${Math.min(1, c.life / 20)})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(c.x, gy);
      ctx.lineTo(c.x + 8, gy + 10);
      ctx.lineTo(c.x - 4, gy + 18);
      ctx.lineTo(c.x + 12, gy + 28);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  function drawWellInside() {
    // dark fill
    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // circular viewport
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.42;
    const R = Math.min(canvas.width, canvas.height) * 0.38;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // upside sky with red lightning
    const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    g.addColorStop(0, '#2a0510');
    g.addColorStop(0.5, '#100818');
    g.addColorStop(1, '#050208');
    ctx.fillStyle = g;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // lightning
    if (frame % 40 < 6) {
      ctx.strokeStyle = 'rgba(255, 40, 60, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let lx = cx - 40 + Math.random() * 80;
      let ly = cy - R + 10;
      ctx.moveTo(lx, ly);
      for (let i = 0; i < 5; i++) {
        lx += (Math.random() - 0.5) * 30;
        ly += R * 0.15;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }

    // fear shadows running above
    wellShadows.forEach((s) => {
      const sy = cy - R * 0.55 + s.y * R;
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

    // star in well
    if (!wellStarTaken) {
      const pulse = 1 + Math.sin(frame * 0.2) * 0.15;
      const sx = cx;
      const sy = cy + R * 0.25;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 20;
      drawStarPath(0, 0, 5, 14, 6);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,215,0,0.5)';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ Звезда!', cx, cy + R * 0.3);
    }

    ctx.restore();

    // stone rim around circle
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Lucik peeking over rim (bottom of circle)
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

  function drawIntroOverlay() {
    if (introT < 50) {
      ctx.fillStyle = 'rgba(0,229,255,0.85)';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Люцик и Обратная сторона', canvas.width / 2, 40);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${fear.emoji} Страх: ${fear.name}`, canvas.width / 2, 64);
      ctx.textAlign = 'left';
    }

    if (chaseFear) {
      const f = chaseFear;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.beginPath();
      ctx.ellipse(f.x, groundY() - f.h / 2, 40, f.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (f.h > 30) {
        ctx.fillStyle = fear.eye;
        ctx.shadowColor = fear.eye;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(f.x - 12, groundY() - f.h * 0.65, 5, 0, Math.PI * 2);
        ctx.arc(f.x + 12, groundY() - f.h * 0.65, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    if (introT > 50 && introT < 120) {
      ctx.fillStyle = 'rgba(204,0,51,0.9)';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Он рядом…', canvas.width / 2, canvas.height * 0.35);
      ctx.textAlign = 'left';
    }
  }

  function draw() {
    if (phase === PHASE.WELL_INSIDE || phase === PHASE.WELL_FALL && wellT > 20) {
      if (phase === PHASE.WELL_INSIDE) {
        drawWellInside();
      } else {
        drawNightSky();
        drawGround();
        if (well) drawWell(well, false);
        drawLucik();
      }
      particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life / 15);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      return;
    }

    drawNightSky();
    drawGround();

    if (well && !well.used) {
      const near = well.x - lucik.x < 160 && well.x > lucik.x;
      drawWell(well, near && phase === PHASE.RUN);
    }

    obstacles.forEach((o) => {
      if (o.type === 'fear' && !o.hit) drawFearShape(o);
    });

    trailStars.forEach((t) => {
      ctx.fillStyle = `rgba(255,215,0,${t.life / 18})`;
      ctx.beginPath();
      drawStarPath(t.x, t.y, 5, 5, 2);
      ctx.fill();
    });

    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 15);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    drawLucik();

    if (phase === PHASE.INTRO) drawIntroOverlay();

    if (phase === PHASE.HUNT) {
      ctx.fillStyle = 'rgba(255,215,0,0.85)';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⚡ ОХОТА · ${Math.max(0, Math.ceil((250 - huntT) / 50))}с`, canvas.width / 2, 28);
      ctx.textAlign = 'left';
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
  }

  // —— end screens ——
  function showResult(didWin) {
    recordGameResult('runner', didWin, level);
    trackEvent(didWin ? 'runner_won' : 'runner_lost', { level, score, distance: Math.floor(distance), fear: fear.id });
    speak(didWin ? `Люцик прогнал ${fear.name}!` : 'Попробуй ещё раз!');

    const prevBest = parseInt(localStorage.getItem('runner-best') || '0', 10);
    const newBest = Math.max(prevBest, Math.floor(distance));
    localStorage.setItem('runner-best', String(newBest));

    const result = document.createElement('div');
    result.className = 'runner-result';
    result.innerHTML = `
      <div class="runner-result-box ${didWin ? 'win' : ''}">
        <div class="emoji">${didWin ? '🌟' : '😅'}</div>
        <h2>${didWin ? `Люцик прогнал ${fear.name}!` : 'Почти получилось!'}</h2>
        <p class="sub">${didWin ? 'Сегодня он смелее. А ты?' : 'Страх ещё рядом — но Люцик верит в тебя.'}</p>
        <p class="stats">🏃 Дистанция: <b>${Math.floor(distance)}м</b></p>
        <p class="stats">⭐ Очки: <b>${score}</b></p>
        <p class="stats">🏆 Рекорд: <b>${newBest}м</b></p>
        <button type="button" class="runner-btn primary" id="restartRunner">🔄 Ещё забег</button>
        <button type="button" class="runner-btn secondary" id="otherFear">👻 Другой страх</button>
        <button type="button" class="runner-btn ghost" id="exitRunner">🚪 Выйти</button>
        <p class="clock-ref">⏱ Часы показывают 3:00</p>
      </div>
    `;
    document.body.appendChild(result);

    result.querySelector('#restartRunner').onclick = () => {
      result.remove();
      startRunnerGame(level);
    };
    result.querySelector('#otherFear').onclick = () => {
      result.remove();
      startRunnerGame(level >= 5 ? 1 : level + 1);
    };
    result.querySelector('#exitRunner').onclick = () => {
      result.remove();
      if (typeof showGamesMenu === 'function') showGamesMenu();
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

  // —— input / loop ——
  canvas.addEventListener('click', jump);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });

  const loop = setInterval(() => {
    update();
    draw();

    if ((phase === PHASE.LOST || phase === PHASE.WON) && !finished) {
      finished = true;
      if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
      }
      stopDrone();
      setTimeout(() => finish(phase === PHASE.WON || won), phase === PHASE.WON ? 900 : 1600);
    }
  }, 20);

  document.getElementById('runnerMusic').onclick = function onMusic() {
    const on = toggleMusic();
    this.textContent = on ? '🔊' : '🔇';
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

  trackEvent('runner_started', { level, fear: fear.id });
}

export default { startRunnerGame };
