// ========================================
// runner.js — «Люцик и Обратная сторона» v8
// Динамика · физика · максимальный визуал · комбо/босс · выборы с троллингом
// ========================================

import { appState, showGamesMenu } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';

const CHOICES = {
  fear: {
    trigger: 50,
    steps: [
      {
        prompt: 'Люцик видит Страх Темноты впервые.',
        options: ['Посмотреть в глаза', 'Закрыть глаза'],
        troll: 1
      },
      {
        prompt: 'Люцик: "Я его не вижу, значит его нет. Логика."\nСтрах тыкает его в бок.\nЛюцик: "АЙ! Он меня ткнул! С закрытыми глазами!"',
        options: ['Открыть глаза', 'Продолжить не видеть'],
        troll: 1
      },
      {
        prompt: 'Страх начинает танцевать.\nЛюцик (дрожа): "Почему я слышу танцевальную музыку?"',
        options: ['ОТКРЫТЬ ГЛАЗА', 'Это моя жизнь теперь'],
        troll: 1
      },
      {
        prompt: 'Люцик в позе лотоса. Выросли цветы.\n"Я стал одним целым со страхом. Омм..."\nСтрах уходит.\n"Эй, вернись!" Страх возвращается.',
        options: ['Посмотреть в глаза (битва)', 'Продолжить медитацию'],
        troll: 1
      }
    ]
  },
  mia: {
    trigger: 350,
    steps: [
      {
        prompt: 'Люцик встречает Мию — девочку-лучницу.',
        options: ['Позвать с собой', 'Пройти мимо'],
        troll: 1
      },
      {
        prompt: 'Мия: "Я вижу что ты меня видишь."\nЛюцик: "Я дерево разглядываю."\nМия: "Это фонарный столб."',
        options: ['Позвать', 'Разглядывать столб'],
        troll: 1
      },
      {
        prompt: 'Мия: "Я МОГУ СТРЕЛЯТЬ СВЕТОМ!"\nЛюцик: "А столб так не умеет..."',
        options: ['ПОЗВАТЬ', 'Спросить про столб'],
        troll: 1
      },
      {
        prompt: 'Мия делает столб волшебным.\n"Теперь он с нами. ПОШЛИ."\nЛюцик: "У нас есть волшебный столб!"',
        options: ['Отличная команда!', 'Ещё по троллить'],
        troll: 1
      }
    ]
  },
  portal: {
    trigger: 590,
    steps: [
      {
        prompt: 'Огромный портал в Обратную сторону.',
        options: ['Прыгнуть', 'Обойти'],
        troll: 1
      },
      {
        prompt: 'Люцик обходит слева. Возвращается справа.\n"Я обошёл. А он опять здесь."',
        options: ['Прыгнуть', 'Обойти с другой стороны'],
        troll: 1
      },
      {
        prompt: 'Люцик обходит справа. Возвращается слева.\n"Этот портал меня преследует."',
        options: ['ПРЫГНУТЬ', 'Позвать такси'],
        troll: 1
      },
      {
        prompt: 'Такси нет. Портал засасывает.\n"ЛАДНО-ЛАДНО, Я САМ!"',
        options: ['Прыгнуть!', 'Сопротивляться'],
        troll: 1
      }
    ]
  },
  boss: {
    trigger: 890,
    steps: [
      {
        prompt: 'Король Страхов возвышается над лесом.',
        options: ['В атаку!', 'План Б'],
        troll: 1
      },
      {
        prompt: 'Люцик: "План Б: убежать."\nМия: "Там нет плана Б!"\nМакс: "Я думал ПЛАН А — атаковать!"',
        options: ['АТАКОВАТЬ', 'Искать план В'],
        troll: 1
      },
      {
        prompt: 'Люцик достаёт резиновую уточку.\nБосс в замешательстве.\n"РАБОТАЕТ! АТАКУЕМ!"',
        options: ['ФИНАЛЬНАЯ БИТВА (бафф Уточки)', 'Ещё покопаться в рюкзаке'],
        troll: 1
      }
    ]
  },
  ending: {
    trigger: 1000,
    steps: [
      {
        prompt: 'Портал закрывается.',
        options: ['Уйти домой', 'Оставить портал'],
        troll: 1
      },
      {
        prompt: 'Маленький Страх: "Бублик!"\nЛюцик: "Смотрите, он милый!"\nМия: "Это СТРАХ. Он вырастет."',
        options: ['ЗАКРЫТЬ', 'Оставить Бублика'],
        troll: 1
      },
      {
        prompt: 'Бублик вырос в 10 раз.\n"БУБЛИК!" (басом)\nЛюцик: "Кажется я ошибся."',
        options: ['ЗАКРЫТЬ ПОРТАЛ СРОЧНО', 'Бублик — друг!'],
        troll: 1
      }
    ]
  }
};

const FEARS = [
  { id: 'darkness', name: 'Темнота', emoji: '🌑', color: '#111', eye: '#ff0033', shape: 'cloud' },
  { id: 'height', name: 'Высота', emoji: '🏔️', color: '#8899aa', eye: '#ff6666', shape: 'vortex' },
  { id: 'lonely', name: 'Одиночество', emoji: '😔', color: '#2244aa', eye: '#66aaff', shape: 'shadow' },
  { id: 'monsters', name: 'Монстры', emoji: '👾', color: '#5a1a8a', eye: '#ff44aa', shape: 'demo' },
  { id: 'mindflayer', name: 'Главный Страх', emoji: '🧠', color: '#050508', eye: '#ff0000', shape: 'flayer' }
];

const PHASE = {
  VIDEO: 'video',
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
const WELL_WHISPERS = ['Люцик...', 'Не оглядывайся...', 'Он близко...', 'Слышишь?'];
const INTRO_VIDEO = 'assets/video/runner-intro.mp4';

function nextRunCount() {
  const n = (parseInt(localStorage.getItem('runner-run-count') || '0', 10) || 0) + 1;
  localStorage.setItem('runner-run-count', String(n));
  return n;
}

function getRunnerRank(wins, closedPortal, distance) {
  if (closedPortal || wins >= 20) return { id: 'portal', title: 'Закрывающий Портал', emoji: '🌀' };
  if (wins >= 10 || distance >= 400) return { id: 'keeper', title: 'Хранитель', emoji: '🛡️' };
  if (wins >= 3 || distance >= 200) return { id: 'hunter', title: 'Охотник', emoji: '⚔️' };
  return { id: 'newbie', title: 'Новичок', emoji: '🌱' };
}

function claimDailyBonus() {
  const today = new Date().toISOString().slice(0, 10);
  const key = 'runner-daily-claim';
  if (localStorage.getItem(key) === today) return 0;
  localStorage.setItem(key, today);
  return 30;
}

export function startRunnerGame(level = 1) {
  document.querySelectorAll('.game-fullscreen, .game-screen, .runner-result, .runner-share-sheet, .runner-choice-overlay, #choice-overlay').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = true;
  level = Math.max(1, Math.min(5, level || 1));

  const runCount = nextRunCount();
  const isMindFlayer = runCount % 5 === 0 || level >= 5;
  const fear = isMindFlayer
    ? FEARS[4]
    : FEARS[Math.min(level - 1, 3)];

  const overlay = document.createElement('div');
  overlay.className = `game-fullscreen runner-game runner-cinematic${isMindFlayer ? ' runner-mindflayer' : ''}`;
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;';

  const letterTop = document.createElement('div');
  letterTop.className = 'runner-letterbox top';
  const letterBot = document.createElement('div');
  letterBot.className = 'runner-letterbox bottom';
  const blinkOverlay = document.createElement('div');
  blinkOverlay.className = 'runner-blink-overlay';
  const filmCanvas = document.createElement('canvas');
  filmCanvas.className = 'runner-film-canvas';

  const header = document.createElement('div');
  header.className = 'runner-header';
  header.innerHTML = `
    <span>🐱 Обратная сторона</span>
    <span>🏃 <b id="runnerDistance">0</b>м · ⭐ <b id="runnerScore">0</b></span>
    <span id="runnerComboHud" style="color:#ffd700;min-width:4em;"></span>
    <span id="runnerFearLabel">${fear.emoji} ${fear.name}</span>
    <span id="runnerDashHud" title="Двойной свайп вверх">⚡</span>
    <button type="button" id="runnerPhoto" aria-label="Фото">📸</button>
    <button type="button" id="runnerMusic" aria-label="Музыка">🔊</button>
    <button type="button" id="runnerClose" aria-label="Закрыть">✕</button>
  `;

  const canvas = document.createElement('canvas');
  canvas.id = 'runnerGameCanvas';
  overlay.appendChild(header);
  overlay.appendChild(canvas);
  overlay.appendChild(filmCanvas);
  overlay.appendChild(blinkOverlay);
  overlay.appendChild(letterTop);
  overlay.appendChild(letterBot);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');
  const filmCtx = filmCanvas.getContext('2d');

  const dailyBonus = claimDailyBonus();
  let fearsSmashed = 0;

  function lucikHomeX() {
    return canvas.width * 0.28 + lucik.lane * LANE_OFFSET;
  }

  function getSpeedMult() {
    if (distance >= 500) return 2;
    if (distance >= 300) return 1.6;
    if (distance >= 100) return 1.3;
    return 1;
  }

  function getComboMult() {
    if (combo >= 10) return 10;
    if (combo >= 5) return 5;
    if (combo >= 2) return 2;
    return 1;
  }

  function updateComboHud() {
    const el = document.getElementById('runnerComboHud');
    if (!el) return;
    comboMult = getComboMult();
    el.textContent = comboMult > 1 ? `×${comboMult}` : '';
    const dashEl = document.getElementById('runnerDashHud');
    if (dashEl) {
      const ready = frame >= dashReadyAt && dashT <= 0;
      dashEl.style.opacity = ready ? '1' : '0.35';
      dashEl.textContent = ready ? '⚡' : '⏳';
    }
  }

  function doDash() {
    if (choiceState.active) return;
    if (phase !== PHASE.RUN && phase !== PHASE.HUNT) return;
    if (frame < dashReadyAt || dashT > 0) return;
    dashT = 22;
    dashReadyAt = frame + 500; // ~10s at 20ms
    distance += 50;
    lucik.dashTrail = 1;
    shakeIntensity = Math.max(shakeIntensity, 6);
    for (let i = 0; i < 16; i++) {
      footSparks.push({
        x: lucik.x + lucik.w * 0.3,
        y: groundY() - 4,
        vx: -2 - Math.random() * 4,
        vy: -1 - Math.random() * 3,
        life: 15 + Math.random() * 12,
        color: '#ffd700'
      });
    }
    beep(220, 0.2, 'sawtooth', 0.1, 880);
    speak('Рывок!');
    updateComboHud();
  }

  function setLane(dir) {
    if (choiceState.active) return;
    const next = Math.max(-1, Math.min(1, lucik.lane + dir));
    if (next === lucik.lane) return;
    lucik.lane = next;
    lucik.tilt = dir * 0.35;
  }

  function spawnFearShards(cx, cy, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      shards.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        w: 4 + Math.random() * 8,
        h: 3 + Math.random() * 6,
        life: 40 + Math.random() * 30,
        color
      });
    }
  }

  function spawnChest() {
    if (canvas.width <= 0) return;
    const kinds = ['stars', 'shield', 'boost', 'rainbow'];
    chests.push({
      x: canvas.width + 20,
      y: groundY() - 48,
      w: 36,
      h: 32,
      kind: kinds[Math.floor(Math.random() * kinds.length)],
      taken: false,
      bob: Math.random() * Math.PI * 2
    });
  }

  function openChest(c) {
    c.taken = true;
    playStarSound();
    if (c.kind === 'stars') {
      score += 40;
      burst(c.x, c.y, '#FFD700', 18);
      showComboText(40);
    } else if (c.kind === 'shield') {
      shieldT = 250;
      invuln = Math.max(invuln, 250);
      showComboText('🛡');
    } else if (c.kind === 'boost') {
      boostT = 150;
      showComboText('💨');
    } else if (c.kind === 'rainbow') {
      rainbowT = Math.max(rainbowT, 400);
      overlay.classList.add('runner-rainbow');
      playRainbow();
      showComboText('🌈');
    }
    const el = document.getElementById('runnerScore');
    if (el) el.textContent = score;
  }

  function spawnBoss() {
    if (boss) return;
    boss = {
      x: canvas.width + 40,
      y: groundY() - 110,
      w: 90,
      h: 110,
      hp: 3,
      hitFlash: 0,
      wobble: 0
    };
    startMusic('boss');
    speak('Босс Страха!');
  }

  function hitBoss() {
    if (!boss) return;
    boss.hp -= hasDuckBuff ? 2 : 1;
    boss.hitFlash = 12;
    shakeIntensity = 12;
    spawnFearShards(boss.x + boss.w / 2, boss.y + boss.h / 2, fear.eye, 20);
    playShockwaveSound();
    timeScale = 0.3;
    slowMoT = 20;
    if (boss.hp <= 0) {
      score += 200;
      fearsSmashed += 3;
      showComboText(200);
      spawnFearShards(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ffd700', 30);
      localStorage.setItem('runner-boss-killed', '1');
      speak('Босс повержен!');
      boss = null;
      startMusic(phase === PHASE.HUNT ? 'hunt' : 'flee');
      const el = document.getElementById('runnerScore');
      if (el) el.textContent = score;
    }
  }

  const groundY = () => canvas.height - 58;
  const LANE_OFFSET = 42;
  const lucik = {
    x: 0, y: 0, w: 68, h: 68, vy: 0,
    jumping: false, scale: 1, glow: 0, peek: 0,
    facing: 1, lookBack: false, lookBackT: 0,
    breath: 0, breathCycles: 0, targetX: 0,
    tilt: 0, blinkT: 0, dashTrail: 0, lane: 0
  };

  const GRAVITY = 0.58;
  const JUMP_V0 = -14.2;
  const JUMP_FRAME = 0; // один кадр прыжка (не смешивать с циклом бега)

  let phase = PHASE.VIDEO;
  let introT = 0;
  let wellT = 0;
  let huntT = 0;
  let winSlowT = 0;
  let obstacles = [];
  let trackStars = [];
  let trailStars = [];
  let particles = [];
  let dirtParticles = [];
  let shards = [];
  let footSparks = [];
  let footTrails = [];
  let cameraDrops = [];
  let heatWaves = [];
  let grassPress = [];
  let chests = [];
  let boss = null;
  let comboFloats = [];
  let speedLines = [];
  let fireworks = [];
  let shockwaves = [];
  let vaporPuffs = [];
  let bgStars = [];
  let fireflies = [];
  let leaves = [];
  let fogLayers = [];
  let trees = [];
  let cracks = [];
  let wellShadows = [];
  let score = dailyBonus;
  let distance = 0;
  let speed = isMindFlayer ? 3.8 : 3.2;
  let baseSpeed = speed;
  let speedMult = 1;
  let hasGlowingPillar = false;
  let hasDuckBuff = false;
  let allies = [];
  let allyArrows = [];
  let miaLoaded = false;
  let maxLoaded = false;
  const choiceState = {
    active: false,
    situation: null,
    step: 0,
    gameSpeedBefore: 1,
    triggered: {}
  };
  let frame = 0;
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
  let shieldT = 0;
  let boostT = 0;
  let chaseFear = null;
  let won = false;
  let closedPortal = false;
  let musicMode = 'flee';
  let timeScale = 1;
  let slowMoT = 0;
  let combo = 0;
  let comboTimer = 0;
  let comboMult = 1;
  let starStreak = 0;
  let rainbowT = 0;
  let clockMinute = 0;
  let lastSmash = null;
  let masterGain = null;
  let musicVol = 0.04;
  let musicIntervalMs = 320;
  let vhsGlitchT = 0;
  let nextVhsAt = 250 + Math.random() * 250;
  let grainCanvas = null;
  let grainCtx = null;
  let nextBlinkAt = 500 + Math.random() * 250;
  let nextWhisperAt = 40;
  let nextDontLookAt = 80;
  let heartbeatBpm = 80;
  let footstepAcc = 0;
  let gameStarted = false;
  let loop = null;
  let dashReadyAt = 0;
  let dashT = 0;
  let lastChestAt = 0;
  let lastBossAt = 0;
  let lightningFlash = 0;
  let moonRayPhase = 0;
  let swipeY = null;
  let swipeX = null;
  let swipeTimes = [];
  let surfaceType = 'grass'; // grass | dirt | stone

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
  let runFrameCounter = 0;
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

  function playShockwaveSound() {
    beep(90, 0.35, 'sawtooth', 0.14, 30);
    beep(200, 0.2, 'square', 0.06, 80);
  }

  function playFootstep() {
    // шаги зависят от поверхности
    if (surfaceType === 'stone') beep(70 + Math.random() * 20, 0.04, 'square', 0.02);
    else if (surfaceType === 'dirt') beep(55 + Math.random() * 25, 0.06, 'triangle', 0.03);
    else beep(100 + Math.random() * 35, 0.045, 'sine', 0.022);
  }

  function playComboDrum() {
    beep(80, 0.06, 'square', 0.04);
    setTimeout(() => beep(120, 0.05, 'square', 0.03), 40);
  }

  function playHeartbeatThump(vol = 0.12) {
    beep(48, 0.08, 'sine', vol);
    setTimeout(() => beep(38, 0.12, 'sine', vol * 0.85), 90);
  }

  function playWhisperSpatial(text, side = 1) {
    if (!musicOn) return;
    resumeAudio();
    ensureMaster();
    try {
      const panner = audioCtx.createPanner();
      panner.panningModel = 'equalpower';
      panner.setPosition(side * 2.5, 0, 0);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420 + Math.random() * 200;
      filter.Q.value = 0.8;
      osc.type = 'sawtooth';
      osc.frequency.value = 140 + Math.random() * 80;
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(masterGain);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.45);
    } catch { /* */ }
    // визуальный шёпот
    const tip = document.createElement('div');
    tip.className = 'runner-dont-look';
    tip.textContent = text;
    tip.style.left = side < 0 ? '12%' : '55%';
    tip.style.top = `${30 + Math.random() * 30}%`;
    tip.style.color = 'rgba(200,200,220,0.55)';
    tip.style.fontSize = '14px';
    overlay.appendChild(tip);
    setTimeout(() => tip.remove(), 900);
  }

  function showDontLookText() {
    const el = document.createElement('div');
    el.className = 'runner-dont-look';
    el.textContent = 'Не оглядывайся';
    el.style.left = `${15 + Math.random() * 50}%`;
    el.style.top = `${20 + Math.random() * 50}%`;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  function triggerBlink() {
    blinkOverlay.classList.remove('active');
    void blinkOverlay.offsetWidth;
    blinkOverlay.classList.add('active');
    setTimeout(() => blinkOverlay.classList.remove('active'), 150);
  }

  function setLetterbox(on) {
    if (on) overlay.classList.add('runner-cinematic');
    else overlay.classList.remove('runner-cinematic');
  }

  function expandLetterboxThen(cb) {
    overlay.classList.remove('runner-well');
    overlay.classList.remove('runner-cinematic');
    setTimeout(() => { if (typeof cb === 'function') cb(); }, 900);
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
    if (musicInterval) { clearTimeout(musicInterval); clearInterval(musicInterval); musicInterval = null; }
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
    const bossLead = [82, 82, 98, 110, 98, 82, 73, 65, 98, 130, 110, 82];
    const notes = mode === 'boss' ? bossLead : (mode === 'hunt' ? huntLead : fleeBass);
    let i = 0;
    startDrone(
      mode === 'boss' ? 36 : (mode === 'hunt' ? 55 : (isMindFlayer ? 28 : 42)),
      mode === 'boss' ? 0.08 : (mode === 'hunt' ? 0.03 : (isMindFlayer ? 0.07 : 0.04))
    );

    const baseMs = mode === 'boss' ? 160 : (mode === 'hunt' ? 200 : (isMindFlayer ? 280 : 320));
    musicIntervalMs = baseMs;

    const playNote = () => {
      if (!musicOn || phase === PHASE.LOST || phase === PHASE.WON) return;
      const sm = getSpeedMult();
      musicIntervalMs = Math.max(110, Math.round(baseMs / sm));
      const f = notes[i % notes.length];
      const type = mode === 'hunt' || mode === 'boss' ? 'square' : 'sawtooth';
      beep(f, mode === 'boss' ? 0.22 : (mode === 'hunt' ? 0.2 : 0.28), type, mode === 'boss' ? 0.055 : (mode === 'hunt' ? 0.045 : 0.038));
      if ((mode === 'hunt' || comboMult >= 5) && i % 4 === 0) {
        beep(f * 2, 0.1, 'triangle', 0.028);
        if (comboMult >= 5) playComboDrum();
      }
      if (mode === 'boss' && i % 2 === 0) beep(f * 1.5, 0.12, 'sawtooth', 0.04);
      if (isMindFlayer && mode === 'flee' && i % 2 === 0) beep(f / 2, 0.35, 'sine', 0.05);
      i++;
    };

    playNote();
    const schedule = () => {
      if (musicInterval) clearTimeout(musicInterval);
      if (!musicOn || phase === PHASE.LOST || phase === PHASE.WON) return;
      musicInterval = setTimeout(() => {
        playNote();
        schedule();
      }, musicIntervalMs);
    };
    schedule();
  }

  function toggleMusic() {
    musicOn = !musicOn;
    if (!musicOn) {
      if (musicInterval) { clearTimeout(musicInterval); clearInterval(musicInterval); }
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
    if (musicInterval) { clearTimeout(musicInterval); clearInterval(musicInterval); }
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
    trees = Array.from({ length: 10 }, (_, i) => ({
      base: i * 140 + Math.random() * 40,
      h: 70 + (i % 3) * 25,
      w: 34 + (i % 2) * 6,
      near: i % 3 === 0,
      scroll: Math.random() * 200,
      web: Math.random() < 0.55
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
    el.textContent = typeof pts === 'number' ? `+${pts}` : String(pts);
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function nearFearRisk() {
    return obstacles.some((o) => {
      if (o.type !== 'fear' || o.hit) return false;
      const dx = (o.x + o.w / 2) - (lucik.x + lucik.w / 2);
      return dx > -20 && dx < 110;
    });
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
    const fullH = v.h;
    obstacles.push({
      type: 'fear',
      fearId: v.fearId,
      name: meta.name,
      color: meta.color,
      eye: meta.eye,
      shape: meta.shape,
      x: canvas.width + 20,
      y: groundY() - fullH,
      w: v.w,
      h: fullH,
      fullH,
      growT: 0,
      growMax: 18 + Math.floor(Math.random() * 10),
      wavePh: Math.random() * Math.PI * 2,
      fleeing: hunting,
      panicDir: Math.random() < 0.5 ? -1 : 1,
      panicT: Math.random() * 40,
      hit: false
    });
    spawnDirt(canvas.width + 20 + v.w / 2, groundY(), 8);
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
    comboTimer = 90;
    combo++;
    updateComboHud();
    const risk = nearFearRisk() ? 3 : 1;
    const pts = Math.round(bonus * getComboMult() * risk);
    score += pts;
    starStreak++;
    const el = document.getElementById('runnerScore');
    if (el) el.textContent = score;
    playStarSound();
    if (risk > 1) showComboText(`${pts} RISK`);
    else if (getComboMult() > 1) showComboText(pts);
    // двойная радуга: 5 звёзд подряд → 15 сек
    if (starStreak >= 5 && rainbowT <= 0) {
      rainbowT = 750; // ~15s
      overlay.classList.add('runner-rainbow');
      playRainbow();
      speak('Двойная радуга!');
      obstacles.forEach((o) => {
        if (o.type === 'fear' && !o.hit) smashFear(o);
      });
    }
  }

  function smashFear(o, opts = {}) {
    if (o.hit) return;
    const risk = nearFearRisk() ? 3 : 1;
    o.hit = true;
    fearsSmashed++;
    comboTimer = 90;
    combo++;
    updateComboHud();
    const pts = Math.round(Math.min(50, 10 * combo) * getComboMult() * risk);
    score += pts;
    const el = document.getElementById('runnerScore');
    if (el) el.textContent = score;
    showComboText(risk > 1 ? `${pts} ×3` : pts);
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    burst(cx, cy, o.eye || '#ff4466', 22);
    burst(cx, cy, '#FFD700', 10);
    spawnFearShards(cx, cy, o.eye || o.color || '#ff4466', 16);
    if (isMindFlayer) {
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: cx, y: cy,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 20 + Math.random() * 15,
          r: 2 + Math.random() * 2,
          color: '#ff2244'
        });
      }
    }
    shockwaves.push({ x: cx, y: cy, r: 8, max: 90, color: o.eye || o.color || '#ff4466', life: 28 });
    shakeIntensity = opts.quiet ? Math.max(shakeIntensity, 4) : (8 + Math.random() * 4);
    playShatter();
    if (!opts.quiet) playShockwaveSound();
    // slow-mo 0.3x ~0.5 сек
    if (!opts.quiet) {
      timeScale = 0.3;
      slowMoT = 25;
    }
    lastSmash = { x: cx, y: cy, color: o.eye, name: o.name };
  }

  function enterWell() {
    if (!well || well.used) return;
    well.used = true;
    phase = PHASE.WELL_FALL;
    wellT = 0;
    lucik.scale = 1;
    lucik.vy = 0;
    lucik.jumping = false;
    overlay.classList.add('runner-well');
    overlay.classList.add('runner-cinematic');
    overlay.classList.add('runner-heartbeat');
    heartbeatBpm = 80;
    overlay.style.setProperty('--hb-ms', `${Math.round(60000 / heartbeatBpm)}ms`);
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
    nextWhisperAt = 25;
    nextDontLookAt = 50;
    vaporPuffs = [];
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
    overlay.classList.remove('runner-heartbeat');
    overlay.classList.add('runner-hunt');
    expandLetterboxThen(() => {});
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
    if (!closedPortal) closedPortal = isMindFlayer;
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

  function showChoice(situation) {
    const data = CHOICES[situation];
    if (!data) return;
    const steps = data.steps;
    const step = steps[Math.min(choiceState.step, steps.length - 1)];

    choiceState.active = true;
    choiceState.situation = situation;
    choiceState.gameSpeedBefore = speed;
    speed = 0;

    document.getElementById('choice-overlay')?.remove();

    const choiceOverlay = document.createElement('div');
    choiceOverlay.id = 'choice-overlay';
    choiceOverlay.className = 'runner-choice-overlay';

    const prompt = document.createElement('div');
    prompt.className = 'runner-choice-prompt';
    prompt.textContent = step.prompt;
    choiceOverlay.appendChild(prompt);

    const btnContainer = document.createElement('div');
    btnContainer.className = 'runner-choice-btns';

    step.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `runner-choice-btn${i === step.troll ? ' troll' : ' correct'}`;
      btn.textContent = opt;
      btn.onclick = () => handleChoice(i);
      btnContainer.appendChild(btn);
    });

    choiceOverlay.appendChild(btnContainer);
    document.body.appendChild(choiceOverlay);
  }

  function handleChoice(optionIndex) {
    const situation = choiceState.situation;
    const steps = CHOICES[situation]?.steps;
    if (!steps) {
      closeChoice();
      return;
    }
    const currentStep = Math.min(choiceState.step, steps.length - 1);

    if (optionIndex === steps[currentStep].troll) {
      choiceState.step++;
      document.getElementById('choice-overlay')?.remove();
      if (choiceState.step < steps.length) {
        showChoice(situation);
      } else {
        choiceState.step = 0;
        applyChoiceReward(situation, steps.length - 1);
        closeChoice();
      }
    } else {
      const rewardedStep = currentStep;
      choiceState.step = 0;
      applyChoiceReward(situation, rewardedStep);
      closeChoice();
    }
  }

  function applyChoiceReward(situation, stepReached) {
    if (situation === 'mia') {
      spawnMia();
      if (stepReached >= 3) {
        hasGlowingPillar = true;
        shieldT = Math.max(shieldT, 350);
        invuln = Math.max(invuln, 200);
        showComboText('🪄 Столб!');
        score += 50;
      } else {
        shieldT = Math.max(shieldT, 180);
        showComboText('🏹 Мия!');
        score += 30;
      }
    }
    if (situation === 'boss') {
      if (stepReached >= 2) {
        hasDuckBuff = true;
        showComboText('🦆 Уточка!');
        score += 40;
      }
      if (!boss) spawnBoss();
    }
    if (situation === 'portal') {
      score += 20 + stepReached * 10;
      showComboText('🌀');
    }
    if (situation === 'fear') {
      score += 15;
      showComboText('👀');
    }
    if (situation === 'ending') {
      closedPortal = true;
      triggerWin();
    }
    const scoreEl = document.getElementById('runnerScore');
    if (scoreEl) scoreEl.textContent = score;
  }

  function showAllyMessage(text) {
    const el = document.createElement('div');
    el.className = 'runner-ally-toast';
    el.textContent = text;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function allyHomeX(lane) {
    return canvas.width * 0.28 + lane * LANE_OFFSET;
  }

  function pickAllyLane(preferRight) {
    const base = lucik.lane;
    if (preferRight) {
      if (base < 1) return base + 1;
      return base - 1;
    }
    if (base > -1) return base - 1;
    return base + 1;
  }

  function spawnMia() {
    if (miaLoaded) return;
    miaLoaded = true;
    const lane = pickAllyLane(true);
    allies.push({
      id: 'mia',
      name: 'Мия',
      lane,
      x: lucik.x - 90,
      y: groundY() - 60,
      w: 50,
      h: 60,
      anim: 0,
      shootTimer: 0,
      shootCooldown: 250, // ~5с при 20мс
      bob: 0
    });
    showAllyMessage('Мия присоединилась! 💫');
    speak('Мия с нами!');
    burst(lucik.x - 60, groundY() - 40, '#ff69b4', 18);
  }

  function spawnMax() {
    if (maxLoaded) return;
    maxLoaded = true;
    const mia = allies.find((a) => a.id === 'mia');
    let lane = pickAllyLane(false);
    if (mia && mia.lane === lane) {
      lane = mia.lane === 1 ? -1 : (mia.lane === -1 ? 1 : (lucik.lane >= 0 ? -1 : 1));
    }
    allies.push({
      id: 'max',
      name: 'Макс',
      lane,
      x: lucik.x - 140,
      y: groundY() - 65,
      w: 55,
      h: 65,
      anim: 0,
      protectTimer: 0,
      protectCooldown: 400, // ~8с
      protectWindow: 0,
      isProtecting: false,
      knockX: 0,
      knockT: 0,
      bob: 0
    });
    showAllyMessage('Макс присоединился! 🛡️');
    speak('Макс на защите!');
    burst(lucik.x - 120, groundY() - 40, '#4169e1', 18);
  }

  function createArrowEffect(x1, y1, x2, y2) {
    allyArrows.push({
      x1, y1, x2, y2,
      life: 14,
      maxLife: 14
    });
    // вспышка у цели
    burst(x2, y2, '#fff8b0', 14);
    burst(x2, y2, '#ff69b4', 10);
    shockwaves.push({ x: x2, y: y2, r: 6, max: 55, color: '#ffe566', life: 18 });
  }

  function shootArrow(ally) {
    let closest = null;
    let closestDist = Infinity;
    for (const o of obstacles) {
      if (o.type !== 'fear' || o.hit) continue;
      const dist = (o.x + o.w / 2) - (ally.x + ally.w / 2);
      if (dist > 20 && dist < closestDist && dist < canvas.width * 0.85) {
        closest = o;
        closestDist = dist;
      }
    }
    if (!closest) return;
    createArrowEffect(
      ally.x + ally.w,
      ally.y + ally.h * 0.4,
      closest.x + closest.w / 2,
      closest.y + closest.h * 0.4
    );
    smashFear(closest, { quiet: true });
    beep(880, 0.08, 'sine', 0.05, 1400);
  }

  function maxCanProtect() {
    const max = allies.find((a) => a.id === 'max');
    return !!(max && max.isProtecting && max.knockT <= 0);
  }

  function maxInterceptFear(o) {
    const max = allies.find((a) => a.id === 'max');
    if (!max || !max.isProtecting) return false;
    smashFear(o, { quiet: true });
    max.isProtecting = false;
    max.protectWindow = 0;
    max.knockT = 28;
    max.knockX = 0;
    shakeIntensity = Math.max(shakeIntensity, 10);
    showAllyMessage('Макс принял удар! 🛡️');
    showComboText('🛡️ Макс!');
    beep(120, 0.25, 'square', 0.08, 60);
    return true;
  }

  function updateAllies() {
    if (phase !== PHASE.RUN && phase !== PHASE.HUNT) return;
    const gy = groundY();

    allies.forEach((ally) => {
      const targetX = allyHomeX(ally.lane) - (ally.id === 'mia' ? 70 : 120);
      const knock = ally.knockT > 0 ? ally.knockX : 0;
      ally.x += (targetX + knock - ally.x) * 0.14;
      ally.y = gy - ally.h + Math.sin(frame * 0.15 + ally.bob) * 1.5;
      ally.anim += Math.max(0.1, speed * 0.04);
      ally.bob += 0.05;

      if (ally.id === 'mia') {
        ally.shootTimer++;
        if (ally.shootTimer >= ally.shootCooldown) {
          ally.shootTimer = 0;
          shootArrow(ally);
        }
      }

      if (ally.id === 'max') {
        if (ally.knockT > 0) {
          ally.knockT--;
          ally.knockX = Math.sin((1 - ally.knockT / 28) * Math.PI) * -55;
          if (ally.knockT <= 0) ally.knockX = 0;
        } else {
          ally.protectTimer++;
          if (ally.protectTimer >= ally.protectCooldown) {
            ally.protectTimer = 0;
            ally.isProtecting = true;
            ally.protectWindow = 100; // ~2с окно защиты
          }
        }
        if (ally.protectWindow > 0) {
          ally.protectWindow--;
          if (ally.protectWindow <= 0) ally.isProtecting = false;
        }
      }
    });

    allyArrows.forEach((a) => { a.life--; });
    allyArrows = allyArrows.filter((a) => a.life > 0);
  }

  function drawAllies() {
    allies.forEach((ally) => {
      const runFrame = Math.floor(ally.anim) % 2;
      const bobY = runFrame === 0 ? 0 : -3;
      const x = ally.x;
      const y = ally.y + bobY;
      const isMia = ally.id === 'mia';

      ctx.save();
      // тень
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + ally.w / 2, groundY() - 2, ally.w * 0.35, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // заглушка спрайта
      ctx.fillStyle = isMia ? '#ff69b4' : '#4169e1';
      ctx.strokeStyle = isMia ? '#ff1493' : '#1e3a8a';
      ctx.lineWidth = 2;
      const r = 8;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + ally.w - r, y);
      ctx.quadraticCurveTo(x + ally.w, y, x + ally.w, y + r);
      ctx.lineTo(x + ally.w, y + ally.h - r);
      ctx.quadraticCurveTo(x + ally.w, y + ally.h, x + ally.w - r, y + ally.h);
      ctx.lineTo(x + r, y + ally.h);
      ctx.quadraticCurveTo(x, y + ally.h, x, y + ally.h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // «ноги» — 2 кадра бега
      ctx.fillStyle = isMia ? '#c71585' : '#27408b';
      if (runFrame === 0) {
        ctx.fillRect(x + 10, y + ally.h - 4, 10, 6);
        ctx.fillRect(x + ally.w - 20, y + ally.h - 2, 10, 4);
      } else {
        ctx.fillRect(x + 12, y + ally.h - 2, 10, 4);
        ctx.fillRect(x + ally.w - 22, y + ally.h - 4, 10, 6);
      }

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${isMia ? 22 : 16}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isMia ? 'М' : 'МА', x + ally.w / 2, y + ally.h * 0.42);

      // имя
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = isMia ? '#ffb6d9' : '#a8c4ff';
      ctx.fillText(ally.name, x + ally.w / 2, y - 8);

      // щит Макса
      if (!isMia && ally.isProtecting) {
        const pulse = 0.45 + Math.sin(frame * 0.25) * 0.2;
        ctx.strokeStyle = `rgba(65,105,225,${pulse})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = '#4169e1';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(x + ally.w / 2, y + ally.h / 2, 38 + Math.sin(frame * 0.2) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // лук Мии (полоска)
      if (isMia) {
        ctx.strokeStyle = '#ffe566';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + ally.w - 4, y + ally.h * 0.4, 12, -0.8, 0.8);
        ctx.stroke();
      }
      ctx.restore();
    });

    // световые стрелы
    allyArrows.forEach((a) => {
      const t = 1 - a.life / a.maxLife;
      const x = a.x1 + (a.x2 - a.x1) * Math.min(1, t * 1.4);
      const y = a.y1 + (a.y2 - a.y1) * Math.min(1, t * 1.4);
      ctx.save();
      ctx.strokeStyle = `rgba(255,245,150,${a.life / a.maxLife})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function closeChoice() {
    document.getElementById('choice-overlay')?.remove();
    choiceState.active = false;
    speed = choiceState.gameSpeedBefore || baseSpeed;
    choiceState.situation = null;
  }

  function jump() {
    if (choiceState.active) return;
    if (phase === PHASE.INTRO || phase === PHASE.WELL_FALL || phase === PHASE.WELL_INSIDE ||
        phase === PHASE.WELL_EXIT || phase === PHASE.LOST || phase === PHASE.WON ||
        phase === PHASE.WIN_SLOWMO) return;
    // только с земли — без двойного прыжка
    if (lucik.jumping) return;
    const sm = Math.max(1, getSpeedMult());
    lucik.vy = JUMP_V0 * (0.92 + 0.08 * Math.min(2, sm));
    lucik.jumping = true;
    wasAirborne = true;
    currentFrame = JUMP_FRAME;
    animState = 'jump';
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
    // ускоряющееся падение
    const accel = 1.6 + wellT * 0.12;
    lucik.scale = Math.max(0.12, 1 - wellT / 28);
    lucik.y += accel;
    animState = 'fall';
    wellParallax += 1.5 + wellT * 0.08;
    if (wellT % 3 === 0) {
      particles.push({
        x: lucik.x + lucik.w / 2 + (Math.random() - 0.5) * 20,
        y: lucik.y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1 - Math.random(),
        life: 20,
        r: 1.5,
        color: 'rgba(200,220,255,0.7)'
      });
    }
    if (wellT >= 28) {
      phase = PHASE.WELL_INSIDE;
      wellT = 0;
      lucik.scale = 1;
      lucik.peek = 0;
      wellEyeT = 35;
    }
  }

  function updateWellInside() {
    wellT++;
    lucik.peek = Math.min(1, wellT / 22);
    animState = 'peek';
    wellParallax += 0.8;
    wellShadows.forEach((s) => { s.x += s.speed; });
    if (wellEyeT > 0) wellEyeT--;

    // сердцебиение 80 → 120 BPM
    heartbeatBpm = Math.min(120, 80 + wellT * 0.45);
    overlay.style.setProperty('--hb-ms', `${Math.round(60000 / heartbeatBpm)}ms`);
    if (wellT % Math.max(8, Math.round(50 / (heartbeatBpm / 60))) === 0) {
      playHeartbeatThump(0.08 + (heartbeatBpm - 80) / 400);
    }

    // шёпот
    if (wellT >= nextWhisperAt) {
      const phrase = WELL_WHISPERS[Math.floor(Math.random() * WELL_WHISPERS.length)];
      playWhisperSpatial(phrase, Math.random() < 0.5 ? -1 : 1);
      nextWhisperAt = wellT + 35 + Math.floor(Math.random() * 40);
    }
    if (wellT >= nextDontLookAt) {
      showDontLookText();
      nextDontLookAt = wellT + 55 + Math.floor(Math.random() * 40);
    }

    // пар изо рта
    if (wellT % 12 === 0) {
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.42;
      const R = Math.min(canvas.width, canvas.height) * 0.38;
      vaporPuffs.push({
        x: cx - 8 + Math.random() * 16,
        y: cy + R - 20,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.6 - Math.random() * 0.5,
        r: 6 + Math.random() * 8,
        life: 35 + Math.random() * 20
      });
    }
    vaporPuffs.forEach((v) => {
      v.x += v.vx;
      v.y += v.vy;
      v.r += 0.15;
      v.life--;
    });
    vaporPuffs = vaporPuffs.filter((v) => v.life > 0);

    // белые хлопья «как под водой»
    if (wellT % 2 === 0) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.4 + Math.random() * 0.8,
        life: 40 + Math.random() * 30,
        r: 1 + Math.random() * 2.5,
        color: 'rgba(220,240,255,0.55)',
        under: true
      });
    }

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

    // последние ~2 сек охоты — slow-mo 0.5x
    if (huntT >= 150 && huntT < 250) {
      timeScale = 0.5;
      if (huntT % 20 === 0) {
        beep(110, 0.15, 'sawtooth', 0.06, 55);
        playShockwaveSound();
      }
    }

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

    obstacles.forEach((o) => {
      if (o.type !== 'fear' || o.hit) return;
      o.panicT++;
      if (o.panicT % 18 === 0) o.panicDir *= -1;
      o.x += o.panicDir * 1.8;
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
    if (phase === PHASE.VIDEO || phase === PHASE.LOST || phase === PHASE.WON) return;
    if (choiceState.active) return;

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

    // развилки с троллингом
    if (phase === PHASE.RUN || phase === PHASE.HUNT) {
      for (const [situation, data] of Object.entries(CHOICES)) {
        if (distance >= data.trigger && !choiceState.triggered[situation]) {
          choiceState.triggered[situation] = true;
          choiceState.step = 0;
          showChoice(situation);
          return;
        }
      }
    }

    const hunting = phase === PHASE.HUNT;
    const rainbow = rainbowT > 0;
    if (hunting) updateHunt();
    if (rainbow) {
      rainbowT--;
      if (rainbowT <= 0) overlay.classList.remove('runner-rainbow');
    }
    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer <= 0) {
        combo = 0;
        updateComboHud();
      }
    }
    if (shieldT > 0) shieldT--;
    if (boostT > 0) boostT--;
    if (dashT > 0) {
      dashT--;
      lucik.dashTrail = Math.max(0, lucik.dashTrail - 0.04);
    } else {
      lucik.dashTrail *= 0.92;
    }
    lucik.tilt *= 0.88;
    if (lucik.blinkT > 0) lucik.blinkT--;
    else if (Math.random() < 0.008) lucik.blinkT = 6;
    if (lightningFlash > 0) lightningFlash--;
    moonRayPhase += 0.01;

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
      // моргание экрана раз в 10–15 сек
      if (frame >= nextBlinkAt) {
        triggerBlink();
        nextBlinkAt = frame + 500 + Math.floor(Math.random() * 250);
      }
      if (frame >= nextDontLookAt && Math.random() < 0.4) {
        showDontLookText();
        nextDontLookAt = frame + 400 + Math.floor(Math.random() * 300);
      }
    }

    // шаги от скорости + поверхности
    if ((phase === PHASE.RUN || phase === PHASE.HUNT) && !lucik.jumping) {
      footstepAcc += speed;
      if (footstepAcc > 28) {
        footstepAcc = 0;
        surfaceType = distance > 200 && Math.random() < 0.3 ? 'dirt'
          : (well && Math.abs(well.x - lucik.x) < 120 ? 'stone' : 'grass');
        playFootstep();
        // искры / следы под лапами
        if (dashT > 0 || speedMult >= 1.6) {
          footSparks.push({
            x: lucik.x + lucik.w * 0.35,
            y: groundY() - 2,
            vx: -1 - Math.random() * 2,
            vy: -0.5 - Math.random() * 2,
            life: 12,
            color: '#ffcc66'
          });
        }
        footTrails.push({
          x: lucik.x + lucik.w * 0.3,
          y: groundY() - 1,
          life: 18,
          a: 0.45
        });
        grassPress.push({ x: lucik.x + lucik.w * 0.4, life: 20, w: 18 });
      }
    }

    // ударные волны
    shockwaves.forEach((sw) => {
      sw.r += (sw.max - sw.r) * 0.18 + 2;
      sw.life--;
    });
    shockwaves = shockwaves.filter((sw) => sw.life > 0);

    distance += speed * 0.12 * (timeScale < 1 ? timeScale : 1);
    const distEl = document.getElementById('runnerDistance');
    if (distEl) distEl.textContent = Math.floor(distance);

    // dynamic music volume from speed
    if (phase === PHASE.RUN || phase === PHASE.HUNT) {
      setMusicVolume(0.03 + (speed / 14) * 0.08);
    }

    // инерция X — плавно к «дорожке»
    lucik.targetX = lucikHomeX();
    lucik.x += (lucik.targetX - lucik.x) * 0.18;

    // дыхание после колодца (3 цикла пульсации)
    if (lucik.breathCycles > 0) {
      lucik.breath += 0.18;
      if (lucik.breath >= Math.PI * 2) {
        lucik.breath = 0;
        lucik.breathCycles--;
      }
    } else {
      lucik.breath += 0.06; // лёгкое дыхание всегда
    }

    // параболический прыжок — g зависит от скорости
    const gNow = GRAVITY * (0.85 + 0.25 * Math.min(2, getSpeedMult()));
    lucik.vy += gNow;
    lucik.y += lucik.vy;
    const gy = groundY();
    if (lucik.y >= gy - lucik.h) {
      if (wasAirborne && lucik.jumping) {
        shakeIntensity = Math.max(shakeIntensity, 3 + Math.random() * 2);
        spawnDirt(lucik.x + lucik.w / 2, gy, 12);
        for (let i = 0; i < 8; i++) {
          dirtParticles.push({
            x: lucik.x + lucik.w * 0.3 + Math.random() * 20,
            y: gy - 2,
            vx: (Math.random() - 0.5) * 3,
            vy: -0.5 - Math.random() * 2,
            life: 18,
            r: 2 + Math.random() * 2,
            color: '#6a5030'
          });
        }
      }
      lucik.y = gy - lucik.h;
      lucik.vy = 0;
      lucik.jumping = false;
      wasAirborne = false;
      animState = 'run';
      // сразу обратно к циклу бега
      currentFrame = Math.floor(runFrameCounter) % 4;
    }

    // звёздная пыль за Люциком
    if (frame % 2 === 0 && (phase === PHASE.RUN || phase === PHASE.HUNT)) {
      trailStars.push({
        x: lucik.x + 8,
        y: lucik.y + lucik.h * 0.5 + (Math.random() - 0.5) * 20,
        life: 16,
        color: phase === PHASE.HUNT ? '#ffd700' : '#aaccff'
      });
      if (phase === PHASE.HUNT) {
        particles.push({
          x: lucik.x + 10,
          y: lucik.y + lucik.h * 0.4,
          vx: -2 - Math.random() * 2,
          vy: (Math.random() - 0.5) * 2,
          life: 18,
          r: 2,
          color: '#FFD700'
        });
      }
    }

    // редкие капли на «камере»
    if (Math.random() < 0.008 && cameraDrops.length < 6) {
      cameraDrops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.5,
        r: 3 + Math.random() * 5,
        life: 80 + Math.random() * 60
      });
    }

    const move = speed * (timeScale < 1 ? timeScale : 1);
    obstacles.forEach((o) => {
      o.x -= o.fleeing ? move * 1.4 : move;
      if (o.growT < o.growMax) {
        o.growT++;
        const t = o.growT / o.growMax;
        o.h = o.fullH * Math.min(1, t * t * (3 - 2 * t));
        o.y = gy - o.h;
      }
      o.wavePh = (o.wavePh || 0) + 0.12;
      o.y = gy - o.h + Math.sin(o.wavePh) * 3;
    });
    trackStars.forEach((s) => { s.x -= move; });
    chests.forEach((c) => {
      c.x -= move;
      c.bob += 0.1;
    });
    if (boss) {
      boss.x -= move * 0.55;
      boss.wobble += 0.08;
      boss.y = gy - boss.h + Math.sin(boss.wobble) * 4;
      if (boss.hitFlash > 0) boss.hitFlash--;
    }
    if (well && !well.used) well.x -= move;
    cracks.forEach((c) => { c.x -= move; c.life--; });
    cracks = cracks.filter((c) => c.life > 0 && c.x > -40);
    trailStars.forEach((t) => { t.x -= move * 0.35; t.life--; });
    trailStars = trailStars.filter((t) => t.life > 0);
    speedLines.forEach((l) => { l.y += 8; l.life--; });
    speedLines = speedLines.filter((l) => l.life > 0);

    // missed star breaks rainbow streak + combo
    for (const s of [...trackStars]) {
      if (!s.taken && s.x + 20 < lucik.x) {
        starStreak = 0;
        if (combo > 0) {
          combo = 0;
          comboTimer = 0;
          updateComboHud();
        }
        s.taken = true;
      }
    }

    obstacles = obstacles.filter((o) => {
      if (o.hit) return false;
      if (o.x > -90) return true;
      // пропуск страха в охоте сбрасывает комбо
      if (o.fleeing && combo > 0) {
        combo = 0;
        comboTimer = 0;
        updateComboHud();
      }
      return false;
    });
    trackStars = trackStars.filter((s) => s.x > -20 && !s.taken);
    chests = chests.filter((c) => c.x > -40 && !c.taken);

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

    // chests
    for (const c of chests) {
      if (c.taken) continue;
      if (Math.abs(lucik.x + lucik.w / 2 - (c.x + c.w / 2)) < 36 &&
          Math.abs(lucik.y + lucik.h / 2 - (c.y + c.h / 2)) < 40) {
        openChest(c);
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
        if (hunting || rainbow || invuln > 0 || shieldT > 0) {
          smashFear(o);
        } else if (maxCanProtect() && maxInterceptFear(o)) {
          // Макс перехватил удар
        } else {
          starStreak = 0;
          combo = 0;
          updateComboHud();
          phase = PHASE.LOST;
          shakeIntensity = 14;
          beep(80, 0.4, 'sawtooth', 0.12, 30);
        }
      }
    }

    // босс хит
    if (boss && (hunting || rainbow || invuln > 0 || shieldT > 0 || lucik.jumping)) {
      if (lx < boss.x + boss.w && lx + lw > boss.x && ly < boss.y + boss.h && ly + lh > boss.y) {
        if (boss.hitFlash <= 0) hitBoss();
      }
    } else if (boss && !(hunting || rainbow || invuln > 0 || shieldT > 0)) {
      if (lx < boss.x + boss.w * 0.7 && lx + lw > boss.x + 10 && ly < boss.y + boss.h && ly + lh > boss.y + 20) {
        starStreak = 0;
        combo = 0;
        phase = PHASE.LOST;
        shakeIntensity = 16;
        beep(70, 0.45, 'sawtooth', 0.14, 25);
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

      // сундуки каждые 100м — 10%
      const chestMark = Math.floor(distance / 100) * 100;
      if (chestMark >= 100 && chestMark > lastChestAt) {
        lastChestAt = chestMark;
        if (Math.random() < 0.1) spawnChest();
      }
      // босс каждые 500м
      const bossMark = Math.floor(distance / 500) * 500;
      if (bossMark >= 500 && bossMark > lastBossAt && !boss) {
        lastBossAt = bossMark;
        spawnBoss();
      }

      // Макс — начало Мира 3
      if (distance >= 600 && !maxLoaded) spawnMax();

      // скорость: тиры дистанции × boost × dash
      speedMult = getSpeedMult();
      const boostF = boostT > 0 ? 1.35 : 1;
      const dashF = dashT > 0 ? 1.8 : 1;
      if (!hunting) {
        speed = Math.min(isMindFlayer ? 16 : 14, baseSpeed * speedMult * boostF * dashF);
      } else {
        speed = Math.min(18, baseSpeed * 1.5 * speedMult * 0.85 * boostF * dashF);
      }

      // молнии Mind Flayer → flash + heat wave
      if (isMindFlayer && frame % 40 === 0 && Math.random() < 0.45) {
        lightningFlash = 10;
        heatWaves.push({ life: 18, amp: 0.4 + Math.random() * 0.4 });
      }
    }

    updateAllies();

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

    // деревья — передний план ×2 параллакс (через base offset в draw)
    trees.forEach((t) => {
      t.scroll = ((t.scroll || 0) + speed * (t.near ? 1.1 : 0.45)) % 1600;
    });

    // VHS-помехи раз в 5–10 сек
    if (frame >= nextVhsAt) {
      vhsGlitchT = 8 + Math.floor(Math.random() * 10);
      nextVhsAt = frame + 250 + Math.random() * 250;
    }
    if (vhsGlitchT > 0) vhsGlitchT--;

    // анимация: на земле только бег 0-1-2-3, в воздухе только кадр прыжка
    if (lucik.jumping) {
      animState = 'jump';
      currentFrame = JUMP_FRAME;
    } else {
      animState = (hunting || rainbow) ? 'glow' : 'run';
      runFrameCounter += Math.max(0.12, speed * 0.035);
      currentFrame = Math.floor(runFrameCounter) % 4;
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

    // победа после развилки ending (сама развилка тоже вызывает triggerWin)
    if (phase === PHASE.RUN && distance >= 1000 && choiceState.triggered.ending && !choiceState.active && !boss) {
      triggerWin();
    }
  }

  function updateParticles() {
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.under) {
        p.vy += 0.02;
        p.vx += Math.sin(frame * 0.05 + p.x) * 0.02;
      } else {
        p.vy += 0.12;
      }
      p.life--;
    });
    particles = particles.filter((p) => p.life > 0);
    dirtParticles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
    });
    dirtParticles = dirtParticles.filter((p) => p.life > 0);
    shards.forEach((s) => {
      s.vy += 0.35;
      s.vx *= 0.985;
      s.x += s.vx;
      s.y += s.vy;
      s.rot += s.spin;
      s.life--;
      if (s.y > groundY() - 2) {
        s.y = groundY() - 2;
        s.vy *= -0.25;
        s.vx *= 0.7;
      }
    });
    shards = shards.filter((s) => s.life > 0);
    footSparks.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    });
    footSparks = footSparks.filter((p) => p.life > 0);
    footTrails.forEach((t) => { t.life--; t.a *= 0.92; });
    footTrails = footTrails.filter((t) => t.life > 0);
    grassPress.forEach((g) => { g.life--; });
    grassPress = grassPress.filter((g) => g.life > 0);
    cameraDrops.forEach((d) => { d.life--; d.y += 0.15; });
    cameraDrops = cameraDrops.filter((d) => d.life > 0);
    heatWaves.forEach((h) => { h.life--; });
    heatWaves = heatWaves.filter((h) => h.life > 0);
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
    const grow = o.growMax ? Math.min(1, o.growT / o.growMax) : 1;
    const waveY = Math.sin(o.wavePh || 0) * 2;
    const { x, w, color, eye, shape, fleeing } = o;
    const h = o.h;
    const y = o.y;
    ctx.save();
    ctx.translate(x + w / 2, y + h);
    ctx.scale(0.85 + grow * 0.15, grow);
    ctx.translate(-(x + w / 2), -(y + h));
    if (fleeing) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    ctx.globalAlpha = 0.55 + grow * 0.37;
    const yy = y + waveY;
    if (shape === 'vortex') {
      for (let i = 4; i >= 0; i--) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, yy + h / 2, w * 0.2 * (i + 1), h * 0.15 * (i + 1), frame * 0.05 + i, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (shape === 'demo') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, yy);
      ctx.lineTo(x + w, yy + h * 0.35);
      ctx.lineTo(x + w * 0.85, yy + h);
      ctx.lineTo(x + w * 0.15, yy + h);
      ctx.lineTo(x, yy + h * 0.35);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'flayer') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, yy + h * 0.4, w * 0.45, h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, yy + h * 0.55);
        ctx.quadraticCurveTo(x + w * (0.1 + i * 0.2), yy + h * 0.8, x + w * (0.05 + i * 0.22), yy + h);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w * 0.3, yy + h * 0.55, w * 0.28, 0, Math.PI * 2);
      ctx.arc(x + w * 0.55, yy + h * 0.4, w * 0.32, 0, Math.PI * 2);
      ctx.arc(x + w * 0.75, yy + h * 0.55, w * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = eye;
    ctx.shadowColor = eye;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x + w * 0.35, yy + h * 0.42, 4, 0, Math.PI * 2);
    ctx.arc(x + w * 0.62, yy + h * 0.42, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    if (grow > 0.6) {
      ctx.fillStyle = 'rgba(0,229,255,0.85)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(o.name || '', x + w / 2, y - 4);
      ctx.textAlign = 'left';
    }
    // зона риска — тонкое кольцо
    if (nearFearRisk() && Math.abs((o.x + o.w / 2) - (lucik.x + lucik.w / 2)) < 110) {
      ctx.strokeStyle = 'rgba(255,80,80,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, o.y + o.h / 2, Math.max(o.w, o.h) * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
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
    // паутина на колодце
    ctx.strokeStyle = 'rgba(200,200,220,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.7, y - h);
    ctx.lineTo(x + w * 0.95, y - h * 0.4);
    ctx.lineTo(x + w * 0.75, y - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w * 0.82, y - h * 0.55, 8, 0, Math.PI * 1.3);
    ctx.stroke();
  }

  function drawLucik() {
    const breathScale = 1 + Math.sin(lucik.breath) * (lucik.breathCycles > 0 ? 0.045 : 0.015);
    const sw = lucik.w * lucik.scale * breathScale;
    const sh = lucik.h * lucik.scale * breathScale;
    const sx = lucik.x + (lucik.w - sw) / 2;
    const sy = lucik.y + (lucik.h - sh);
    const gy = groundY();
    const hunting = phase === PHASE.HUNT;
    const lx = lucik.x + lucik.w / 2;

    // динамический свет от «Звезды»
    const lightR = hunting || lucik.glow > 0.3 ? 95 + lucik.glow * 40 : 55;
    const lightA = hunting ? 0.32 : (lucik.glow > 0 ? 0.22 : 0.1);
    const light = ctx.createRadialGradient(lx, gy - 4, 4, lx, gy - 4, lightR);
    light.addColorStop(0, `rgba(255, 220, 120, ${lightA})`);
    light.addColorStop(0.45, `rgba(255, 180, 60, ${lightA * 0.35})`);
    light.addColorStop(1, 'rgba(255, 180, 60, 0)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(lx, gy - 2, lightR, lightR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // мягкая тень
    if (phase !== PHASE.WELL_INSIDE && phase !== PHASE.WELL_FALL) {
      const air = Math.max(0, (gy - lucik.h - lucik.y) / 80);
      const shadowW = 30 * lucik.scale * (1 - air * 0.4);
      const shadowA = 0.35 * (1 - air * 0.6);
      ctx.fillStyle = `rgba(10,5,25,${shadowA})`;
      ctx.beginPath();
      ctx.ellipse(lx + lucik.tilt * 8, gy - 1, shadowW, 7 * (1 - air * 0.3), lucik.tilt * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // шлейф рывка
    if (lucik.dashTrail > 0.05) {
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = lucik.dashTrail * 0.2 * i;
        ctx.fillStyle = '#88ccff';
        ctx.beginPath();
        ctx.ellipse(sx - i * 14, sy + sh * 0.55, sw * 0.35, sh * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(sx + sw / 2, sy + sh * 0.55);
    ctx.rotate(lucik.tilt);
    ctx.translate(-(sx + sw / 2), -(sy + sh * 0.55));

    if (lucik.facing < 0) {
      ctx.translate(sx + sw / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(sx + sw / 2), 0);
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
      // моргание
      if (lucik.blinkT > 0) {
        ctx.fillStyle = 'rgba(20,10,30,0.85)';
        ctx.fillRect(sx + sw * 0.28, sy + sh * 0.32, sw * 0.44, sh * 0.08);
      }
    } else {
      ctx.fillStyle = rainbowT > 0 ? RAINBOW[frame % RAINBOW.length] : (lucik.glow > 0 ? '#FFD700' : '#FF8C00');
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, sw / 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // bloom-блик на ярких
    if (hunting || rainbowT > 0 || lucik.glow > 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12;
      const bloom = ctx.createRadialGradient(lx, sy + sh * 0.4, 2, lx, sy + sh * 0.4, sw);
      bloom.addColorStop(0, '#fff8d0');
      bloom.addColorStop(1, 'transparent');
      ctx.fillStyle = bloom;
      ctx.fillRect(sx - 20, sy - 20, sw + 40, sh + 40);
      ctx.restore();
    }
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

    // луна + god rays
    const moonX = canvas.width * 0.18;
    const moonY = gy * 0.18;
    ctx.fillStyle = 'rgba(200,210,255,0.85)';
    ctx.shadowColor = '#aab8ff';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < 7; r++) {
      const ang = -0.4 + r * 0.18 + Math.sin(moonRayPhase + r) * 0.04;
      const len = gy * (0.55 + (r % 3) * 0.08);
      ctx.beginPath();
      ctx.moveTo(moonX, moonY);
      ctx.lineTo(moonX + Math.cos(ang) * len * 0.15, moonY + Math.sin(ang + 1.2) * 8);
      ctx.lineTo(moonX + Math.sin(ang) * 40 + r * 18, gy);
      ctx.lineTo(moonX + Math.sin(ang) * 40 + r * 18 + 28, gy);
      ctx.closePath();
      ctx.fillStyle = `rgba(180,200,255,${0.03 + (r % 2) * 0.02})`;
      ctx.fill();
    }
    ctx.restore();

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const parallax = t.near ? (t.scroll || groundOffset * 1.1) : (groundOffset * 0.35 + (t.scroll || 0) * 0.2);
      const span = canvas.width + (t.near ? 220 : 160);
      const tx = ((t.base - parallax) % span + span) % span - 40;
      const th = t.h * (t.near ? 1.35 : 1);
      const tw = t.w * (t.near ? 1.25 : 1);
      ctx.fillStyle = t.near ? '#061008' : '#0a120a';
      ctx.beginPath();
      ctx.moveTo(tx, gy);
      ctx.lineTo(tx + tw * 0.5, gy - th);
      ctx.lineTo(tx + tw, gy);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 30, 50, 0.35)';
      ctx.lineWidth = t.near ? 2.5 : 2;
      ctx.stroke();
      // паутина
      if (t.web) {
        ctx.strokeStyle = 'rgba(200,200,220,0.22)';
        ctx.lineWidth = 0.8;
        const wx = tx + tw * 0.55;
        const wy = gy - th * 0.75;
        for (let s = 0; s < 4; s++) {
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + 18 + s * 6, wy + 10 + s * 8);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(wx + 12, wy + 14, 10, 0.2, Math.PI * 1.2);
        ctx.stroke();
      }
      const shadowLen = 40 + th * 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.moveTo(tx + 4, gy);
      ctx.lineTo(tx + tw - 4, gy);
      ctx.lineTo(tx + tw * 0.5 + shadowLen * 0.6, gy + 14);
      ctx.lineTo(tx + tw * 0.2 + shadowLen * 0.3, gy + 16);
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
    // трава колышется (sin-волна) + приминание
    ctx.strokeStyle = '#5a3a7a';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < canvas.width; x += 11) {
      let press = 0;
      for (const g of grassPress) {
        if (Math.abs(g.x - x) < g.w) press = Math.max(press, g.life / 20);
      }
      const sway = Math.sin(x * 0.22 + frame * 0.09) * 4 * (1 - press * 0.7);
      const h = (7 + Math.sin(x * 0.31 + frame * 0.07) * 5) * (1 - press * 0.85);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.quadraticCurveTo(x + sway * 0.5, gy - h * 0.5, x + sway + press * 6, gy - h);
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

    // цветокоррекция сине-фиолетовая
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(40, 30, 90, 0.28)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // красная вспышка молнии
    if (lightningFlash > 0) {
      ctx.fillStyle = `rgba(255,40,60,${0.08 + lightningFlash * 0.04})`;
      ctx.fillRect(0, 0, w, h);
    }

    // волны тепла (искажение-полосы)
    heatWaves.forEach((hw) => {
      const a = (hw.life / 18) * hw.amp * 0.15;
      for (let i = 0; i < 5; i++) {
        const y = (h * 0.2) + i * (h * 0.12) + Math.sin(frame * 0.2 + i) * 8;
        ctx.fillStyle = `rgba(255,80,60,${a})`;
        ctx.fillRect(0, y, w, 3);
      }
    });

    // капли на объективе
    cameraDrops.forEach((d) => {
      ctx.fillStyle = `rgba(180,200,255,${Math.min(0.35, d.life / 100)})`;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r * 0.6, d.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.15})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // виньетка
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.65, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.58)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // зернистость
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
      ctx.globalAlpha = 0.14;
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < h; y += 64) {
        for (let x = 0; x < w; x += 64) {
          ctx.drawImage(grainCanvas, 0, 0, 64, 64, x, y, 64, 64);
        }
      }
      ctx.restore();
    }

    // хроматические аберрации
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#ff0040';
    ctx.fillRect(0, 0, 4, h);
    ctx.fillRect(w - 4, 0, 4, h);
    ctx.fillStyle = '#0040ff';
    ctx.fillRect(2, 0, 3, h);
    ctx.fillRect(w - 5, 0, 3, h);
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
      if (Math.random() < 0.4) {
        const sy = Math.random() * h;
        const sh = 10 + Math.random() * 30;
        try {
          const slice = ctx.getImageData(0, sy, w, Math.min(sh, h - sy));
          ctx.putImageData(slice, (Math.random() - 0.5) * 12, sy);
        } catch { /* */ }
      }
    }
  }

  function updateFilmLayer() {
    const fw = overlay.clientWidth;
    const fh = overlay.clientHeight;
    if (filmCanvas.width !== fw || filmCanvas.height !== fh) {
      filmCanvas.width = fw;
      filmCanvas.height = fh;
    }
    filmCtx.clearRect(0, 0, fw, fh);
    const strong = phase === PHASE.WELL_INSIDE || phase === PHASE.WELL_FALL;
    // пылинки
    const dust = strong ? 40 : 22;
    for (let i = 0; i < dust; i++) {
      filmCtx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.1})`;
      filmCtx.fillRect(Math.random() * fw, Math.random() * fh, 1 + Math.random() * 2, 1);
    }
    // царапины
    const scratches = strong ? 6 : 3;
    for (let i = 0; i < scratches; i++) {
      const x = Math.random() * fw;
      filmCtx.strokeStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.1})`;
      filmCtx.lineWidth = 1;
      filmCtx.beginPath();
      filmCtx.moveTo(x, 0);
      filmCtx.lineTo(x + (Math.random() - 0.5) * 8, fh);
      filmCtx.stroke();
    }
    // горизонтальная «грязь» плёнки
    if (Math.random() < (strong ? 0.35 : 0.12)) {
      const y = Math.random() * fh;
      filmCtx.fillStyle = 'rgba(0,0,0,0.15)';
      filmCtx.fillRect(0, y, fw, 1 + Math.random() * 3);
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

    // луч фонарика (sin-волна)
    const beamAngle = Math.sin(frame * 0.05) * 0.55;
    const beamLen = R * 1.1;
    const bx = cx - 10;
    const by = cy + R * 0.55;
    const tipX = bx + Math.sin(beamAngle) * beamLen;
    const tipY = by - Math.cos(beamAngle) * beamLen * 0.75;
    const beam = ctx.createRadialGradient(bx, by, 2, tipX, tipY, beamLen * 0.5);
    beam.addColorStop(0, 'rgba(255, 230, 160, 0.45)');
    beam.addColorStop(0.4, 'rgba(255, 200, 100, 0.18)');
    beam.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tipX + Math.cos(beamAngle) * 28, tipY + Math.sin(beamAngle) * 28);
    ctx.lineTo(tipX - Math.cos(beamAngle) * 28, tipY - Math.sin(beamAngle) * 28);
    ctx.closePath();
    ctx.fill();
    // пятно на стене
    ctx.fillStyle = 'rgba(255, 220, 140, 0.2)';
    ctx.beginPath();
    ctx.ellipse(tipX, tipY, 22, 14, beamAngle, 0, Math.PI * 2);
    ctx.fill();

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

    // дыхание — клубы пара
    vaporPuffs.forEach((v) => {
      ctx.fillStyle = `rgba(220, 230, 255, ${Math.min(0.35, v.life / 50)})`;
      ctx.beginPath();
      ctx.ellipse(v.x, v.y, v.r, v.r * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    });
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

    // сундуки
    chests.forEach((c) => {
      if (c.taken) return;
      const bob = Math.sin(c.bob) * 4;
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + bob);
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(-c.w / 2, 0, c.w, c.h);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(-c.w / 2, c.h * 0.35, c.w, 4);
      ctx.fillStyle = '#c9a227';
      ctx.beginPath();
      ctx.arc(0, c.h * 0.55, 5, 0, Math.PI * 2);
      ctx.fill();
      const icons = { stars: '⭐', shield: '🛡', boost: '💨', rainbow: '🌈' };
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(icons[c.kind] || '📦', 0, -6);
      ctx.restore();
    });

    obstacles.forEach((o) => {
      if (o.type === 'fear' && !o.hit) drawFearShape(o);
    });

    // босс
    if (boss) {
      ctx.save();
      if (boss.hitFlash > 0) ctx.globalAlpha = 0.5 + Math.sin(frame) * 0.3;
      ctx.fillStyle = fear.color || '#1a0510';
      ctx.shadowColor = fear.eye;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(boss.x + boss.w / 2, boss.y + boss.h * 0.45, boss.w * 0.45, boss.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = '#330010';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(boss.x + boss.w / 2, boss.y + boss.h * 0.55);
        ctx.quadraticCurveTo(
          boss.x + boss.w * (0.1 + i * 0.15),
          boss.y + boss.h * 0.75 + Math.sin(frame * 0.1 + i) * 6,
          boss.x + i * 14,
          boss.y + boss.h
        );
        ctx.stroke();
      }
      ctx.fillStyle = fear.eye;
      ctx.beginPath();
      ctx.arc(boss.x + boss.w * 0.35, boss.y + boss.h * 0.35, 6, 0, Math.PI * 2);
      ctx.arc(boss.x + boss.w * 0.65, boss.y + boss.h * 0.35, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`BOSS · ${'❤'.repeat(boss.hp)}`, boss.x + boss.w / 2, boss.y - 8);
      ctx.restore();
    }

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

    // ударные волны
    shockwaves.forEach((sw) => {
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.life / 28) * 0.7;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    drawParticlesLayer();
    drawAllies();
    drawLucik();

    if (phase === PHASE.INTRO) drawIntroOverlay();

    if (phase === PHASE.HUNT) {
      ctx.fillStyle = 'rgba(255,215,0,0.9)';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      const cm = getComboMult();
      ctx.fillText(`⚡ ОХОТА · ${Math.max(0, Math.ceil((250 - huntT) / 50))}с${cm > 1 ? ` · ×${cm}` : ''}`, canvas.width / 2, 28);
      ctx.textAlign = 'left';
    }

    if (rainbowT > 0) {
      ctx.fillStyle = RAINBOW[frame % RAINBOW.length];
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🌈 РАДУГА · ${Math.ceil(rainbowT / 50)}с`, canvas.width / 2, phase === PHASE.HUNT ? 48 : 28);
      ctx.textAlign = 'left';
    }

    // баффы от развилок и союзники
    if (hasGlowingPillar || hasDuckBuff || miaLoaded || maxLoaded) {
      const bits = [];
      if (miaLoaded) bits.push('🏹 Мия');
      if (maxLoaded) bits.push('🛡️ Макс');
      if (hasGlowingPillar) bits.push('🪄 Столб');
      if (hasDuckBuff) bits.push('🦆 Уточка');
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(bits.join(' · '), canvas.width - 12, 28);
      ctx.textAlign = 'left';
    }

    // волшебный столб рядом с Люциком
    if (hasGlowingPillar && (phase === PHASE.RUN || phase === PHASE.HUNT)) {
      const px = lucik.x - 28;
      const py = groundY();
      const glow = 0.5 + Math.sin(frame * 0.12) * 0.3;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.4 + glow * 0.4})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12 + glow * 10;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 52);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 240, 150, ${0.5 + glow * 0.4})`;
      ctx.beginPath();
      ctx.arc(px, py - 56, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
    footTrails.forEach((t) => {
      ctx.fillStyle = `rgba(180,220,255,${t.a})`;
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 10, 3, 0, 0, Math.PI * 2);
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
    dirtParticles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 18);
      ctx.fillRect(p.x, p.y, p.r, p.r);
      ctx.globalAlpha = 1;
    });
    shards.forEach((s) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.globalAlpha = Math.min(1, s.life / 25);
      ctx.fillStyle = s.color;
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
      ctx.globalAlpha = 1;
    });
    footSparks.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 12);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
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
    const prevWins = parseInt(localStorage.getItem('runner-wins') || '0', 10) || 0;
    const wins = didWin ? prevWins + 1 : prevWins;
    if (didWin) localStorage.setItem('runner-wins', String(wins));

    recordGameResult('runner', didWin, level);
    trackEvent(didWin ? 'runner_won' : 'runner_lost', {
      level, score, distance: Math.floor(distance), fear: fear.id,
      mindflayer: isMindFlayer, portal: closedPortal, smashed: fearsSmashed
    });

    const rank = getRunnerRank(wins, closedPortal && didWin, Math.floor(distance));
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
    result.className = `runner-result${closedPortal && didWin ? ' mindflayer-win' : ''}`;
    result.innerHTML = `
      <div class="runner-result-box ${didWin ? 'win' : ''}">
        <div class="emoji">${didWin ? (closedPortal ? '🌀' : '🌟') : '😅'}</div>
        <h2>${title}</h2>
        <p class="sub">${sub}</p>
        <div class="rank">${rank.emoji} Ранг: ${rank.title}</div>
        <p class="compare" id="runnerCompare">Считаем место среди игроков…</p>
        ${dailyBonus > 0 ? `<p class="daily">🎁 Ежедневная награда: +${dailyBonus}⭐</p>` : ''}
        <p class="stats">🏃 Дистанция: <b>${Math.floor(distance)}м</b></p>
        <p class="stats">⭐ Очки: <b>${score}</b> · 💥 Страхов: <b>${fearsSmashed}</b></p>
        <p class="stats">🏆 Рекорд: <b>${newBest}м</b></p>
        ${localStorage.getItem('runner-boss-killed') === '1' ? '<p class="stats">🏅 Ачивка: Победитель Босса</p>' : ''}
        <button type="button" class="runner-btn primary" id="restartRunner">🔄 Ещё забег</button>
        <button type="button" class="runner-btn secondary" id="otherFear">👻 Другой страх</button>
        <button type="button" class="runner-btn share" id="shareResult">📤 Поделиться</button>
        <button type="button" class="runner-btn ghost" id="exitRunner">🚪 Выйти</button>
        <p class="clock-ref">⏱ Часы показывают ${clockMinute === 1 ? '3:01' : '3:00'}</p>
      </div>
    `;
    document.body.appendChild(result);

    // сравнение с leaderboard
    (async () => {
      const compareEl = result.querySelector('#runnerCompare');
      if (!compareEl) return;
      try {
        const myScore = Math.floor(distance) + score;
        const res = await fetch(`/api/leaderboard?game=${encodeURIComponent('runner')}`);
        const scores = await res.json();
        if (!Array.isArray(scores) || !scores.length) {
          compareEl.textContent = 'Ты среди первых героев Обратной стороны!';
          return;
        }
        const beaten = scores.filter((s) => (s.score || 0) < myScore).length;
        const pct = Math.max(1, Math.min(99, Math.round((beaten / scores.length) * 100)));
        compareEl.textContent = didWin
          ? `Ты победил больше Страхов, чем ${pct}% игроков!`
          : `Твой результат выше, чем у ${pct}% игроков`;
      } catch {
        compareEl.textContent = 'Таблица лидеров пока недоступна';
      }
    })();

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
      const shot = document.createElement('canvas');
      shot.width = 640;
      shot.height = 420;
      const sctx = shot.getContext('2d');
      const grd = sctx.createLinearGradient(0, 0, 0, 420);
      grd.addColorStop(0, '#0a0e27');
      grd.addColorStop(1, didWin ? '#1a3a2a' : '#2d0a1a');
      sctx.fillStyle = grd;
      sctx.fillRect(0, 0, 640, 420);
      sctx.strokeStyle = '#00e5ff';
      sctx.lineWidth = 4;
      sctx.strokeRect(10, 10, 620, 400);
      sctx.fillStyle = '#00e5ff';
      sctx.font = 'bold 22px Georgia, serif';
      sctx.textAlign = 'center';
      sctx.fillText('🐱 Люцик и Обратная сторона', 320, 55);
      sctx.fillStyle = '#ffd700';
      sctx.font = 'bold 20px sans-serif';
      sctx.fillText(title, 320, 120);
      sctx.fillStyle = '#e8f4ff';
      sctx.font = '16px sans-serif';
      sctx.fillText(`${rank.emoji} ${rank.title}`, 320, 160);
      sctx.fillText(`${Math.floor(distance)}м · ⭐ ${score} · Рекорд ${newBest}м`, 320, 200);
      sctx.fillStyle = '#cc0033';
      sctx.fillText(`⏱ ${clockMinute === 1 ? '3:01' : '3:00'}`, 320, 250);
      openShareSheet(shot.toDataURL('image/png'), title);
    };

    window.leaderboard?.submitScore('runner', Math.floor(distance) + score);
  }

  function finish(didWin) {
    if (loop) clearInterval(loop);
    loop = null;
    window.removeEventListener('resize', resize);
    cleanupAudio();
    document.getElementById('choice-overlay')?.remove();
    choiceState.active = false;
    overlay.style.transform = '';
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    showResult(didWin);
  }

  function onPointerDown(e) {
    if (choiceState.active) return;
    const t = e.touches ? e.touches[0] : e;
    swipeX = t.clientX;
    swipeY = t.clientY;
    swipeTimes.push(performance.now());
    if (swipeTimes.length > 4) swipeTimes.shift();
  }

  function onPointerUp(e) {
    if (choiceState.active) {
      swipeX = null;
      swipeY = null;
      return;
    }
    if (swipeX == null || swipeY == null) {
      jump();
      return;
    }
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - swipeX;
    const dy = t.clientY - swipeY;
    const now = performance.now();
    swipeX = null;
    swipeY = null;

    // свайп влево/вправо — дорожки
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      setLane(dx > 0 ? 1 : -1);
      return;
    }
    // свайп вверх — прыжок; двойной быстрый вверх — рывок
    if (dy < -50 && Math.abs(dy) > Math.abs(dx)) {
      const recent = swipeTimes.filter((tm) => now - tm < 350);
      if (recent.length >= 2) {
        doDash();
      } else {
        jump();
      }
      return;
    }
    jump();
  }

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onPointerDown(e); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); onPointerUp(e); }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (choiceState.active) return;
    if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      const now = performance.now();
      swipeTimes.push(now);
      if (swipeTimes.length > 4) swipeTimes.shift();
      const recent = swipeTimes.filter((tm) => now - tm < 350);
      if (recent.length >= 2) doDash();
      else jump();
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setLane(-1);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setLane(1);
    if (e.key === 'Shift') doDash();
  });

  function startGameLoop() {
    if (loop) return;
    gameStarted = true;
    phase = PHASE.INTRO;
    introT = 0;
    if (dailyBonus > 0) {
      const el = document.getElementById('runnerScore');
      if (el) el.textContent = score;
    }
    loop = setInterval(() => {
      update();
      draw();
      updateFilmLayer();
      if ((phase === PHASE.LOST || phase === PHASE.WON) && !finished) {
        finished = true;
        if (musicInterval) { clearTimeout(musicInterval); clearInterval(musicInterval); musicInterval = null; }
        stopDrone();
        setTimeout(() => finish(phase === PHASE.WON || won), phase === PHASE.WON ? 1100 : 1600);
      }
    }, 20);
    trackEvent('runner_started', { level, fear: fear.id, mindflayer: isMindFlayer, run: runCount, daily: dailyBonus });
  }

  function beginAfterVideo() {
    expandLetterboxThen(() => {
      setLetterbox(false);
      startGameLoop();
    });
  }

  function playIntroVideo() {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = INTRO_VIDEO;
      video.muted = false;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.preload = 'auto';
      video.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:9999;background:#000;';
      document.body.appendChild(video);

      const transitionOverlay = document.createElement('div');
      transitionOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;pointer-events:none;opacity:0;transition:opacity 0.5s;';
      document.body.appendChild(transitionOverlay);

      const skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.textContent = 'Пропустить →';
      skipBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10001;padding:8px 16px;background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.5);border-radius:8px;cursor:pointer;font-size:14px;';

      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        try { video.pause(); } catch { /* */ }
        video.remove();
        transitionOverlay.remove();
        skipBtn.remove();
        resolve();
      };

      skipBtn.onclick = () => cleanup();
      document.body.appendChild(skipBtn);

      if (!document.getElementById('runner-transition-particles-style')) {
        const style = document.createElement('style');
        style.id = 'runner-transition-particles-style';
        style.textContent = `
          @keyframes transitionParticle {
            0% { opacity:1; transform:scale(1); }
            100% { opacity:0; transform:scale(3); }
          }
        `;
        document.head.appendChild(style);
      }

      video.ontimeupdate = () => {
        if (!video.duration || Number.isNaN(video.duration)) return;
        if (video.duration - video.currentTime < 0.5 && !transitionOverlay.dataset.transitioning) {
          transitionOverlay.dataset.transitioning = 'true';
          transitionOverlay.style.background = 'linear-gradient(180deg, #0a0a2e 0%, #1a0a2e 50%, #0a1a0a 100%)';
          transitionOverlay.style.opacity = '1';
          video.style.transform = 'scale(1.2)';
          video.style.transition = 'transform 0.5s ease-in';

          for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
              position:fixed;
              width:4px;height:4px;
              background:gold;
              border-radius:50%;
              z-index:10001;
              left:${Math.random() * 100}%;
              top:${Math.random() * 100}%;
              animation: transitionParticle ${0.5 + Math.random() * 0.5}s ease-out forwards;
              animation-delay:${Math.random() * 0.3}s;
            `;
            transitionOverlay.appendChild(particle);
          }
        }
      };

      video.onended = () => {
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:10002;opacity:1;transition:opacity 0.3s;';
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '0'; }, 50);
        setTimeout(() => {
          flash.remove();
          cleanup();
        }, 350);
      };

      video.onerror = () => cleanup();

      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          video.muted = true;
          video.play().catch(() => cleanup());
        });
      }

      setTimeout(() => {
        if (!done && video.readyState < 2) cleanup();
      }, 4000);
    });
  }

  document.getElementById('runnerMusic').onclick = function onMusic() {
    this.textContent = toggleMusic() ? '🔊' : '🔇';
  };
  document.getElementById('runnerPhoto').onclick = (e) => {
    e.stopPropagation();
    if (phase === PHASE.VIDEO) return;
    takePhoto();
  };
  document.getElementById('runnerClose').onclick = () => {
    if (loop) clearInterval(loop);
    loop = null;
    window.removeEventListener('resize', resize);
    cleanupAudio();
    document.getElementById('choice-overlay')?.remove();
    choiceState.active = false;
    overlay.style.transform = '';
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    document.querySelectorAll('video[src*="runner-intro"]').forEach((v) => v.remove());
  };

  playIntroVideo().then(() => beginAfterVideo());
}

export default { startRunnerGame };
