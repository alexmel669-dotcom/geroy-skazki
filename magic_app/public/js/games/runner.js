import { appState } from '../core.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

export function startRunnerGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('runner');

  const { body, close } = createGameScreen({ gameId: 'runner', title: 'Люцик-раннер', emoji: '🏃', level });

  const canvas = document.createElement('canvas');
  canvas.id = 'runnerCanvas';
  canvas.style.cssText = 'width:100%;max-width:520px;border-radius:12px;touch-action:none;';
  body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const resize = () => {
    canvas.width = Math.min(window.innerWidth - 32, 520);
    canvas.height = Math.min(window.innerHeight - 180, 420);
  };
  resize();
  window.addEventListener('resize', resize);

  const lucik = { x: 60, y: 0, vy: 0, jumping: false };
  let obstacles = [];
  let stars = [];
  let score = 0;
  let speed = 4;
  let gameOver = false;
  let loopId = null;

  function groundY() { return canvas.height - 80; }

  function spawnObstacle() {
    obstacles.push({ x: canvas.width, y: groundY() - 30, w: 30, h: 30 });
  }

  function spawnStar() {
    stars.push({ x: canvas.width, y: groundY() - 50, r: 12 });
  }

  function jump() {
    if (!lucik.jumping && !gameOver) {
      lucik.vy = -10;
      lucik.jumping = true;
    }
  }

  function update() {
    if (gameOver) return;
    lucik.vy += 0.5;
    lucik.y += lucik.vy;
    if (lucik.y >= groundY()) {
      lucik.y = groundY();
      lucik.jumping = false;
    }

    obstacles.forEach((o) => { o.x -= speed; });
    stars.forEach((s) => { s.x -= speed; });
    obstacles = obstacles.filter((o) => o.x > -50);
    stars = stars.filter((s) => s.x > -20);

    for (const o of obstacles) {
      if (Math.abs(lucik.x - o.x) < 35 && Math.abs(lucik.y - o.y) < 35) gameOver = true;
    }
    for (const s of [...stars]) {
      if (Math.abs(lucik.x - s.x) < 30 && Math.abs(lucik.y - s.y) < 30) {
        score += 10;
        stars = stars.filter((x) => x !== s);
      }
    }

    if (Math.random() < 0.02) spawnObstacle();
    if (Math.random() < 0.03) spawnStar();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0d1b2a');
    grad.addColorStop(0.5, '#1b2838');
    grad.addColorStop(1, '#2d5a27');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FF8C00';
    ctx.beginPath();
    ctx.arc(lucik.x, lucik.y - 15, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#555';
    obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.w, o.h));

    ctx.fillStyle = '#FFD700';
    stars.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText(`⭐ ${score}`, 16, 32);

    if (gameOver) {
      ctx.fillStyle = '#fff';
      ctx.font = '28px Arial';
      ctx.fillText('Игра окончена!', canvas.width / 2 - 100, canvas.height / 2);
    }
  }

  canvas.addEventListener('click', jump);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });

  lucik.y = groundY();
  loopId = setInterval(() => {
    update();
    draw();
    if (gameOver) {
      clearInterval(loopId);
      setTimeout(() => { appState.gameActive = false; close(); }, 2500);
    }
  }, 20);

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    clearInterval(loopId);
    appState.gameActive = false;
  }, { once: true });
}

export default { startRunnerGame };
