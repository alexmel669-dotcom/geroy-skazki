// ========================================
// runner.js — Люцик-раннер (v5.5.12)
// ========================================

import { appState, showGamesMenu } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';


export function startRunnerGame(level = 1) {
  document.querySelectorAll('.game-fullscreen, .game-screen').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  document.body.style.transform = '';
  appState.gameActive = false;

  appState.gameActive = true;
  level = level || 1;
  const WIN_DISTANCE = 1000 + level * 200;

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(0,0,0,0.4);color:#fff;z-index:10;';
  header.innerHTML = `
    <span style="font-size:18px;">🏃 Люцик-раннер</span>
    <span>🏃 <b id="runnerDistance">0</b>м | ⭐ <b id="runnerScore">0</b></span>
    <button id="runnerMusic" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">🔊</button>
    <button id="runnerClose" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>
  `;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'flex:1;display:block;width:100%;';

  overlay.appendChild(header);
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');

  const groundY = () => canvas.height - 60;
  const lucik = { x: 0, y: 0, w: 70, h: 70, vy: 0, jumping: false };
  let obstacles = [];
  let stars = [];
  let score = 0;
  let distance = 0;
  let speed = 3;
  let frame = 0;
  let jumpCount = 0;
  let gameOver = false;
  let gameWon = false;
  let finished = false;
  let groundOffset = 0;
  let worldFlipped = false;

  // Web Audio контекст
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let musicOn = true;
  let musicInterval = null;

  function playStarSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  }

  function playJumpSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.setValueAtTime(500, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  }

  function startMusic() {
    if (!musicOn) return;
    if (musicInterval) clearInterval(musicInterval);
    const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
    let noteIndex = 0;
    musicInterval = setInterval(() => {
      if (!musicOn || gameOver) {
        clearInterval(musicInterval);
        musicInterval = null;
        return;
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.value = notes[noteIndex % notes.length];
      gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
      noteIndex++;
    }, 400);
  }

  function toggleMusic() {
    musicOn = !musicOn;
    if (!musicOn && musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
    if (musicOn && !gameOver) startMusic();
    return musicOn;
  }

  function cleanupAudio() {
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
    audioCtx.close();
  }

  function resize() {
    canvas.width = overlay.clientWidth;
    canvas.height = overlay.clientHeight - header.offsetHeight;
    lucik.x = canvas.width * 0.35;
    lucik.y = groundY() - lucik.h;
  }
  resize();
  window.addEventListener('resize', resize);

  // Кадры анимации (только PNG)
  const lucikFrames = [];
  for (let i = 1; i <= 4; i++) {
    const img = new Image();
    img.src = `assets/images/lucik-run-${i}.png`;
    lucikFrames.push(img);
  }
  let currentFrame = 0;
  let frameCounter = 0;
  const FRAME_SPEED = 6;

  // Состояние анимации
  let animState = 'run';

  function spawnObstacle() {
    if (canvas.width <= 0) return;

    const scale = 1 + distance * 0.0005;

    const types = [
      // ЗАБОРЧИК
      {
        w: Math.floor(45 * scale),
        h: Math.floor(40 * scale),
        draw(ctx, x, y) {
          const w = this.w;
          const h = this.h;
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(x + 2, y + 5, 6, h - 5);
          ctx.fillRect(x + w - 8, y + 5, 6, h - 5);
          ctx.fillStyle = '#A0522D';
          ctx.fillRect(x, y + 10, w, 6);
          ctx.fillRect(x, y + h - 12, w, 6);
          ctx.fillStyle = '#555';
          ctx.beginPath(); ctx.arc(x + 5, y + 13, 2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + w - 5, y + 13, 2, 0, Math.PI * 2); ctx.fill();
        }
      },
      // КАМЕНЬ
      {
        w: Math.floor(35 * scale),
        h: Math.floor(30 * scale),
        draw(ctx, x, y) {
          const w = this.w;
          const h = this.h;
          const grad = ctx.createLinearGradient(x, y, x + w, y + h);
          grad.addColorStop(0, '#999');
          grad.addColorStop(0.5, '#777');
          grad.addColorStop(1, '#555');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(x + 2, y + h);
          ctx.lineTo(x, y + h * 0.4);
          ctx.lineTo(x + w * 0.3, y);
          ctx.lineTo(x + w * 0.7, y + 2);
          ctx.lineTo(x + w, y + h * 0.3);
          ctx.lineTo(x + w - 2, y + h);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath();
          ctx.arc(x + w * 0.35, y + h * 0.35, w * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x + 2, y + h - 4, w - 4, 4);
        }
      },
      // ЯМА
      {
        w: Math.floor(60 * scale),
        h: Math.floor(10 * scale),
        draw(ctx, x, y) {
          const w = this.w;
          const h = this.h;
          const holeGrad = ctx.createLinearGradient(0, y, 0, y + h + 20);
          holeGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
          holeGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = holeGrad;
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2 + 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#5D4037';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2 + 8, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const tx = x + w * (0.2 + i * 0.3);
            ctx.moveTo(tx, y + h + 8);
            ctx.lineTo(tx + (Math.random() - 0.5) * 15, y + h + 20);
            ctx.stroke();
          }
        }
      },
      // БАТУТ
      {
        w: 40,
        h: 15,
        draw(ctx, x, y) {
          ctx.fillStyle = '#888';
          for (let i = 0; i < 6; i++) ctx.fillRect(x + 3 + i * 6, y + 10, 3, 5);
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(x, y + 4, 40, 8);
          ctx.fillStyle = '#FFA000';
          ctx.fillRect(x, y + 2, 40, 4);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(x + 5, y + 3, 30, 2);
        },
        onHit() {
          lucik.vy = -22;
          lucik.jumping = true;
          playJumpSound();
          playJumpSound();
        },
        type: 'bonus'
      },
      // ПОРТАЛ
      {
        w: 50,
        h: 60,
        draw(ctx, x, y) {
          const glow = ctx.createRadialGradient(x + 25, y + 30, 5, x + 25, y + 30, 35);
          glow.addColorStop(0, 'rgba(180,130,255,0.8)');
          glow.addColorStop(1, 'rgba(50,0,100,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x + 25, y + 30, 35, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#9B59B6';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x + 25, y + 30, 25, 0, Math.PI * 2);
          ctx.stroke();
        },
        onHit() {
          worldFlipped = !worldFlipped;
          document.body.style.transform = worldFlipped ? 'rotate(180deg)' : 'rotate(0deg)';
        },
        type: 'portal'
      }
    ];

    const t = types[Math.floor(Math.random() * types.length)];
    obstacles.push({
      x: canvas.width,
      y: groundY() - t.h,
      w: t.w,
      h: t.h,
      draw: t.draw,
      type: t.type,
      onHit: t.onHit
    });
  }

  function spawnStar() {
    if (canvas.width <= 0) return;
    stars.push({ x: canvas.width, y: groundY() - 60 - Math.random() * 60, r: 10 });
  }

  function jump() {
    if (jumpCount >= 2 || gameOver) return;
    lucik.vy = jumpCount === 0 ? -12 : -8;
    lucik.jumping = true;
    jumpCount++;
    playJumpSound();
  }

  function update() {
    if (gameOver) return;
    frame++;

    distance += speed * 0.1;
    document.getElementById('runnerDistance').textContent = Math.floor(distance);
    if (distance >= WIN_DISTANCE) {
      gameWon = true;
      gameOver = true;
    }

    lucik.vy += 0.6;
    lucik.y += lucik.vy;
    const gy = groundY();
    if (lucik.y >= gy - lucik.h) {
      lucik.y = gy - lucik.h;
      lucik.vy = 0;
      lucik.jumping = false;
      jumpCount = 0;
    }

    obstacles.forEach((o) => { o.x -= speed; });
    stars.forEach((s) => { s.x -= speed; });
    obstacles = obstacles.filter((o) => o.x > -60);
    stars = stars.filter((s) => s.x > -20);

    for (const o of obstacles) {
      if (o.x <= 0 || o.x > canvas.width) continue;

      const margin = 8;
      const lx = lucik.x + margin;
      const ly = lucik.y + margin + 5;
      const lw = lucik.w - margin * 2;
      const lh = lucik.h - margin * 2 - 5;

      const ox = o.x + margin / 2;
      const oy = o.y + (o.h < 20 ? 0 : margin / 2);
      const ow = o.w - margin;
      const oh = o.h < 20 ? o.h + 10 : o.h - margin;

      if (o.type === 'bonus' || o.type === 'portal') {
        if (lx < ox + ow && lx + lw > ox && ly < oy + oh && ly + lh > oy) {
          o.onHit?.();
          obstacles = obstacles.filter((x) => x !== o);
        }
        continue;
      }

      if (lx < ox + ow && lx + lw > ox && ly < oy + oh && ly + lh > oy) {
        gameOver = true;
      }
    }

    for (const s of [...stars]) {
      if (Math.abs(lucik.x + lucik.w / 2 - s.x) < 28 && Math.abs(lucik.y + lucik.h / 2 - s.y) < 28) {
        score += 10;
        stars = stars.filter((x) => x !== s);
        document.getElementById('runnerScore').textContent = score;
        playStarSound();
      }
    }

    const minGap = 250;
    const lastObstacle = obstacles[obstacles.length - 1];
    if ((!lastObstacle || lastObstacle.x < canvas.width - minGap) && Math.random() < 0.012) {
      spawnObstacle();
    }
    if (Math.random() < 0.03) spawnStar();
    speed = 3 + distance * 0.002;
    groundOffset = (groundOffset + speed) % 40;

    if (lucik.jumping && lucik.vy < -3) animState = 'jump_up';
    else if (lucik.jumping && lucik.vy > 3) animState = 'land';
    else if (lucik.jumping) animState = 'fly';
    else animState = 'run';

    frameCounter++;
    if (frameCounter >= FRAME_SPEED) {
      frameCounter = 0;
      switch (animState) {
        case 'run':
          currentFrame = currentFrame === 0 ? 1 : 0;
          break;
        case 'jump_up':
        case 'land':
          currentFrame = 2;
          break;
        case 'fly':
          currentFrame = 3;
          break;
      }
    }
  }

  function draw() {
    const gy = groundY();

    // НЕБО
    const skyGrad = ctx.createLinearGradient(0, 0, 0, gy);
    skyGrad.addColorStop(0, '#4A90D9');
    skyGrad.addColorStop(0.5, '#87CEEB');
    skyGrad.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, gy);

    // СОЛНЦЕ
    const sunX = canvas.width * 0.85;
    const sunY = canvas.height * 0.12;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + frame * 0.005;
      const lx = sunX + Math.cos(angle) * 50;
      const ly = sunY + Math.sin(angle) * 50;
      ctx.strokeStyle = 'rgba(255,255,100,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(angle) * 25, sunY + Math.sin(angle) * 25);
      ctx.lineTo(lx, ly);
      ctx.stroke();
    }
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 35);
    sunGrad.addColorStop(0, 'rgba(255,255,200,1)');
    sunGrad.addColorStop(0.5, 'rgba(255,240,150,0.8)');
    sunGrad.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 35, 0, Math.PI * 2);
    ctx.fill();

    // ОБЛАКА
    const clouds = [
      { x: 100, y: 40, s: 1.0 },
      { x: canvas.width * 0.5, y: 30, s: 0.7 },
      { x: canvas.width * 0.75, y: 55, s: 1.2 }
    ];
    clouds.forEach((c) => {
      const cx = (c.x + frame * 0.3) % (canvas.width + 200) - 100;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(cx, c.y, 25 * c.s, 0, Math.PI * 2);
      ctx.arc(cx + 20 * c.s, c.y - 8 * c.s, 20 * c.s, 0, Math.PI * 2);
      ctx.arc(cx + 40 * c.s, c.y, 22 * c.s, 0, Math.PI * 2);
      ctx.fill();
    });

    // ТРАВА
    const grassGrad = ctx.createLinearGradient(0, gy, 0, canvas.height);
    grassGrad.addColorStop(0, '#4CAF50');
    grassGrad.addColorStop(0.3, '#388E3C');
    grassGrad.addColorStop(1, '#2E7D32');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, gy, canvas.width, canvas.height - gy);

    // Полоски на земле, бегущие влево
    for (let x = -groundOffset; x < canvas.width; x += 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, gy + 10, 20, 2);
    }

    // ТРАВИНКИ
    ctx.strokeStyle = '#66BB6A';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < canvas.width; x += 12) {
      const h = 8 + Math.sin(x * 0.3 + frame * 0.1) * 5;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + 3, gy - h);
      ctx.stroke();
    }

    obstacles.forEach((o) => o.draw(ctx, o.x, o.y));

    stars.forEach((s) => {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // ТЕНЬ ПОД ЛЮЦИКОМ
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(lucik.x + lucik.w / 2, gy - 2, 28, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const frameImg = lucikFrames[currentFrame];
    if (frameImg?.complete && frameImg.naturalWidth > 0) {
      ctx.drawImage(frameImg, lucik.x, lucik.y, lucik.w, lucik.h);
    } else {
      ctx.fillStyle = '#FF8C00';
      ctx.beginPath();
      ctx.arc(lucik.x + lucik.w / 2, lucik.y + lucik.h / 2, lucik.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = gameWon ? '#FFD700' : '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gameWon ? '🎉 Победа!' : 'Игра окончена', canvas.width / 2, canvas.height / 2);
      ctx.fillText(`🏃 ${Math.floor(distance)}м | ⭐ ${score}`, canvas.width / 2, canvas.height / 2 + 36);
      ctx.textAlign = 'left';
    }
  }

  canvas.addEventListener('click', jump);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });

  const loop = setInterval(() => {
    update();
    draw();

    if (gameOver && !finished) {
      finished = true;
      if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
      }
      setTimeout(() => finish(), 2000);
    }
  }, 20);

  function finish() {
    clearInterval(loop);
    window.removeEventListener('resize', resize);
    cleanupAudio();
    document.body.style.transform = '';
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();

    recordGameResult('runner', gameWon, level);
    if (gameWon) {
      updateAchievement('runner_star');
      checkProgressAchievements();
    }
    trackEvent(gameWon ? 'runner_won' : 'runner_lost', { level, score, distance: Math.floor(distance) });
    speak(gameWon ? 'Победа! Молодец!' : 'Попробуй ещё раз!');

    const resultStars = distance >= WIN_DISTANCE ? 3 : (distance >= WIN_DISTANCE * 0.5 ? 2 : 1);

    const result = document.createElement('div');
    result.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      z-index: 2000;
      display: flex; align-items: center; justify-content: center;
      font-family: sans-serif;
    `;
    result.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #fff, #f0f0f0);
        border-radius: 20px;
        padding: clamp(20px, 5vw, 40px);
        text-align: center;
        max-width: 90vw;
        width: 320px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      ">
        <div style="font-size: clamp(40px, 10vw, 64px);">${gameWon ? '🎉' : '😅'}</div>
        <h2 style="margin:12px 0;font-size:clamp(18px,4vw,24px);color:#333;">${gameWon ? 'Победа!' : 'Почти получилось!'}</h2>
        <div style="font-size:clamp(24px,6vw,36px);margin:8px 0;">${'⭐'.repeat(resultStars)}</div>
        <p style="font-size:16px;color:#666;">Дистанция: ${Math.floor(distance)}м | ⭐ ${score}</p>
        <button id="restartRunner" style="
          margin:8px;padding:clamp(10px,2vw,14px) clamp(20px,5vw,32px);
          border-radius:12px;border:none;background:#FFD700;color:#333;
          font-size:clamp(14px,3vw,18px);cursor:pointer;width:80%;
        ">🔄 ${gameWon ? 'Дальше' : 'Ещё раз'}</button>
        <button id="exitRunner" style="
          margin:8px;padding:clamp(10px,2vw,14px) clamp(20px,5vw,32px);
          border-radius:12px;border:2px solid #ddd;background:#fff;color:#666;
          font-size:clamp(14px,3vw,18px);cursor:pointer;width:80%;
        ">🚪 Выйти</button>
      </div>
    `;
    document.body.appendChild(result);

    result.querySelector('#restartRunner').onclick = () => { result.remove(); startRunnerGame(gameWon ? level + 1 : level); };
    result.querySelector('#exitRunner').onclick = () => { result.remove(); if (typeof showGamesMenu === 'function') showGamesMenu(); };

    if (gameWon && window.leaderboard) window.leaderboard.submitScore('runner', Math.floor(distance));
  }

  document.getElementById('runnerMusic').onclick = function () {
    const on = toggleMusic();
    this.textContent = on ? '🔊' : '🔇';
  };

  document.getElementById('runnerClose').onclick = () => {
    clearInterval(loop);
    window.removeEventListener('resize', resize);
    cleanupAudio();
    document.body.style.transform = '';
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  startMusic();
  trackEvent('runner_started', { level });
}

export default { startRunnerGame };
