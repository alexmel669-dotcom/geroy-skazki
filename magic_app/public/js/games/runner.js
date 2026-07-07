import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { avatarUrl } from '../config.js';

const WIN_SCORE = 100;

export function startRunnerGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('runner');

  const { body, close } = createGameScreen({ gameId: 'runner', title: '🐱 Люцик-раннер', emoji: '🏃', level });

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;max-width:500px;margin:0 auto;';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;border-radius:16px;';
  wrap.appendChild(canvas);
  body.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = Math.min(480, window.innerWidth - 32); canvas.height = 300; };
  resize();
  window.addEventListener('resize', resize);

  const lucikImg = document.createElement('img');
  lucikImg.src = avatarUrl('lucik', 'svg');
  lucikImg.onerror = () => { lucikImg.src = avatarUrl('lucik', 'png'); };
  lucikImg.style.cssText = 'position:absolute;width:50px;height:50px;z-index:5;pointer-events:none;';
  wrap.appendChild(lucikImg);

  const lucik = { x: 60, y: 0, vy: 0, w: 50, h: 50, jumping: false };
  let obstacles = []; let stars = []; let score = 0; let speed = 3; let frame = 0; let jumpCount = 0;
  let gameOver = false; let gameWon = false; let ended = false;
  const ground = () => canvas.height - 60;
  lucik.y = ground() - lucik.h;

  function spawnObstacle() {
    const types = [{ w: 30, h: 30, color: '#666' }, { w: 40, h: 25, color: '#8B4513' }, { w: 50, h: 15, color: '#1e3a5f' }];
    const t = types[Math.floor(Math.random() * types.length)];
    obstacles.push({ x: canvas.width, y: ground() - t.h, ...t });
  }

  function spawnStar() { stars.push({ x: canvas.width, y: ground() - 70 - Math.random() * 60 }); }

  function jump() { if (jumpCount < 2) { lucik.vy = jumpCount === 0 ? -11 : -8; lucik.jumping = true; jumpCount++; } }

  function update() {
    if (gameOver) return;
    frame++;
    lucik.vy += 0.5; lucik.y += lucik.vy;
    const g = ground();
    if (lucik.y >= g - lucik.h) { lucik.y = g - lucik.h; lucik.vy = 0; lucik.jumping = false; jumpCount = 0; }

    obstacles.forEach((o) => { o.x -= speed; });
    stars.forEach((s) => { s.x -= speed; });
    obstacles = obstacles.filter((o) => o.x > -60);
    stars = stars.filter((s) => s.x > -20);

    for (const o of obstacles) {
      if (lucik.x < o.x + o.w && lucik.x + lucik.w > o.x && lucik.y < o.y + o.h && lucik.y + lucik.h > o.y) {
        gameOver = true;
      }
    }

    for (const s of [...stars]) {
      if (Math.abs(lucik.x + 25 - s.x) < 30 && Math.abs(lucik.y + 25 - s.y) < 30) {
        score += 10; stars = stars.filter((x) => x !== s);
        if (score >= WIN_SCORE) { gameWon = true; gameOver = true; }
      }
    }

    if (Math.random() < 0.02) spawnObstacle();
    if (Math.random() < 0.03) spawnStar();
    speed = Math.min(3 + frame * 0.001, 10);

    lucikImg.style.left = `${lucik.x}px`;
    lucikImg.style.top = `${lucik.y - 60}px`;
    lucikImg.style.transform = lucik.jumping && jumpCount === 2 ? 'rotate(360deg)' : '';
  }

  function draw() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#87CEEB'); grad.addColorStop(0.6, '#B0E0E6'); grad.addColorStop(1, '#2d5a27');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const g = ground();
    ctx.fillStyle = '#4CAF50'; ctx.fillRect(0, g, canvas.width, canvas.height - g);

    obstacles.forEach((o) => { ctx.fillStyle = o.color; ctx.fillRect(o.x, o.y, o.w, o.h); });
    stars.forEach((s) => { ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fill(); });

    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Georgia'; ctx.fillText(`⭐ ${score}`, 16, 32);

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = gameWon ? '#FFD700' : '#fff';
      ctx.font = 'bold 28px Georgia'; ctx.textAlign = 'center';
      ctx.fillText(gameWon ? '🎉 Победа!' : 'Игра окончена', canvas.width / 2, canvas.height / 2);
      ctx.fillText(`⭐ ${score}`, canvas.width / 2, canvas.height / 2 + 36);
      ctx.textAlign = 'left';
    }
  }

  canvas.onclick = jump;
  canvas.ontouchstart = (e) => { e.preventDefault(); jump(); };

  const loop = setInterval(() => { update(); draw(); }, 20);

  const checkEnd = setInterval(() => {
    if (gameOver && !ended) {
      ended = true;
      setTimeout(() => {
        clearInterval(loop); clearInterval(checkEnd);
        window.removeEventListener('resize', resize);
        appState.gameActive = false; close();
        recordGameResult('runner', gameWon, level);
        if (gameWon) { recordGameWin('runner', level); updateAchievement('runner_star'); checkProgressAchievements(); }
        speak(gameWon ? 'Победа!' : 'Попробуй ещё!');
        showGameResult({
          won: gameWon, level,
          scoreText: `Собрано ${score} звёзд`,
          onNext: gameWon ? () => startRunnerGame(level + 1) : null,
          onRestart: () => startRunnerGame(level)
        });
        if (gameWon && window.leaderboard) window.leaderboard.submitScore('runner', score);
      }, 2000);
    }
  }, 100);

  trackEvent('runner_started', { level });
}

export default { startRunnerGame };
