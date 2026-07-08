// ========================================
// runner.js — Люцик-раннер (v5.5.4)
// ========================================

import { appState, showGamesMenu } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { assetUrl } from '../config.js';

const WIN_SCORE = 100;

export function startRunnerGame(level = 1) {
  document.querySelectorAll('.game-fullscreen, .game-screen').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;

  appState.gameActive = true;
  level = level || 1;

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(0,0,0,0.4);color:#fff;z-index:10;';
  header.innerHTML = '<span style="font-size:18px;">🏃 Люцик-раннер</span><span>⭐ <b id="runnerScore">0</b></span><button id="runnerClose" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'flex:1;display:block;width:100%;';

  overlay.appendChild(header);
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');

  const groundY = () => canvas.height - 60;
  const lucik = { x: 0, y: 0, w: 50, h: 50, vy: 0, jumping: false };
  let obstacles = []; let stars = [];
  let score = 0; let speed = 4; let frame = 0; let jumpCount = 0;
  let gameOver = false; let gameWon = false; let finished = false;

  function resize() {
    canvas.width = overlay.clientWidth;
    canvas.height = overlay.clientHeight - header.offsetHeight;
    lucik.x = canvas.width * 0.4;
    lucik.y = groundY() - lucik.h;
  }
  resize();
  window.addEventListener('resize', resize);

  const lucikFrames = [];
  for (let i = 1; i <= 4; i++) {
    const img = new Image();
    img.src = assetUrl(`lucik-run-${i}.png`);
    lucikFrames.push(img);
  }
  let currentFrame = 0;
  let frameCounter = 0;
  const FRAME_SPEED = 6;

  function spawnObstacle() {
    if (canvas.width <= 0) return;
    const types = [
      { w: 30, h: 30, color: '#666', draw(ctx, x, y) { ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(x + 15, y + 15, 15, 0, Math.PI * 2); ctx.fill(); } },
      { w: 40, h: 25, color: '#8B4513', draw(ctx, x, y) { ctx.fillStyle = '#8B4513'; ctx.fillRect(x + 5, y + 5, 30, 20); ctx.fillStyle = '#A0522D'; ctx.beginPath(); ctx.arc(x + 20, y + 5, 15, Math.PI, 0); ctx.fill(); } }
    ];
    const t = types[Math.floor(Math.random() * types.length)];
    obstacles.push({ x: canvas.width, y: groundY() - t.h, w: t.w, h: t.h, draw: t.draw });
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
  }

  function update() {
    if (gameOver) return;
    frame++;

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
      if (o.x > 0 && lucik.x < o.x + o.w && lucik.x + lucik.w > o.x && lucik.y < o.y + o.h && lucik.y + lucik.h > o.y) {
        gameOver = true;
      }
    }

    for (const s of [...stars]) {
      if (Math.abs(lucik.x + 25 - s.x) < 28 && Math.abs(lucik.y + 25 - s.y) < 28) {
        score += 10;
        stars = stars.filter((x) => x !== s);
        document.getElementById('runnerScore').textContent = score;
        if (score >= WIN_SCORE) { gameWon = true; gameOver = true; }
      }
    }

    if (Math.random() < 0.02) spawnObstacle();
    if (Math.random() < 0.03) spawnStar();
    speed = Math.min(3 + frame * 0.001, 10);

    frameCounter++;
    if (frameCounter >= FRAME_SPEED) {
      frameCounter = 0;
      currentFrame = (currentFrame + 1) % 4;
    }
  }

  function draw() {
    const gy = groundY();
    const grad = ctx.createLinearGradient(0, 0, 0, gy);
    grad.addColorStop(0, '#87CEEB');
    grad.addColorStop(0.6, '#B0E0E6');
    grad.addColorStop(1, '#E8F5E9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, gy);

    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, gy, canvas.width, canvas.height - gy);

    obstacles.forEach((o) => o.draw(ctx, o.x, o.y));

    stars.forEach((s) => {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    const frameImg = lucikFrames[currentFrame];
    if (frameImg?.complete && frameImg.naturalWidth > 0) {
      ctx.drawImage(frameImg, lucik.x, lucik.y, lucik.w, lucik.h);
    } else {
      ctx.fillStyle = '#FF8C00';
      ctx.beginPath();
      ctx.arc(lucik.x + 25, lucik.y + 25, 25, 0, Math.PI * 2);
      ctx.fill();
    }

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = gameWon ? '#FFD700' : '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gameWon ? '🎉 Победа!' : 'Игра окончена', canvas.width / 2, canvas.height / 2);
      ctx.fillText(`⭐ ${score}`, canvas.width / 2, canvas.height / 2 + 36);
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
      setTimeout(() => finish(), 2000);
    }
  }, 20);

  function finish() {
    clearInterval(loop);
    window.removeEventListener('resize', resize);
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();

    recordGameResult('runner', gameWon, level);
    if (gameWon) {
      updateAchievement('runner_star');
      checkProgressAchievements();
    }
    trackEvent(gameWon ? 'runner_won' : 'runner_lost', { level, score });
    speak(gameWon ? 'Победа! Молодец!' : 'Попробуй ещё раз!');

    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:32px;text-align:center;max-width:300px;">
        <div style="font-size:48px;">${gameWon ? '🎉' : '😅'}</div>
        <h2 style="margin:12px 0;">${gameWon ? 'Победа!' : 'Не получилось!'}</h2>
        <p style="font-size:18px;">⭐ ${score}</p>
        <button id="restartRunner" style="margin:8px;padding:12px 24px;border-radius:12px;border:none;background:#FFD700;color:#333;font-size:16px;cursor:pointer;">🔄 Ещё раз</button>
        <button id="exitRunner" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#333;font-size:16px;cursor:pointer;">🚪 Выйти</button>
      </div>
    `;
    document.body.appendChild(result);

    result.querySelector('#restartRunner').onclick = () => { result.remove(); startRunnerGame(gameWon ? level + 1 : level); };
    result.querySelector('#exitRunner').onclick = () => { result.remove(); showGamesMenu(); };

    if (gameWon && window.leaderboard) window.leaderboard.submitScore('runner', score);
  }

  document.getElementById('runnerClose').onclick = () => {
    clearInterval(loop);
    window.removeEventListener('resize', resize);
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('runner_started', { level });
}

export default { startRunnerGame };
