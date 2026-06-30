import { appState } from '../core.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

function drawCloud(ctx, x, y, scale) {
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x, y, 30 * scale, 0, Math.PI * 2);
  ctx.arc(x + 25 * scale, y - 10 * scale, 25 * scale, 0, Math.PI * 2);
  ctx.arc(x + 50 * scale, y, 28 * scale, 0, Math.PI * 2);
  ctx.arc(x + 30 * scale, y + 10 * scale, 22 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawPixarBackground(ctx, canvas) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.6);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(0.5, '#B0E0E6');
  skyGrad.addColorStop(1, '#E8F5E9');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.6);

  const sunX = canvas.width * 0.8;
  const sunY = canvas.height * 0.15;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 120);
  sunGrad.addColorStop(0, 'rgba(255,255,200,1)');
  sunGrad.addColorStop(0.3, 'rgba(255,240,180,0.8)');
  sunGrad.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(sunX - 120, sunY - 120, 240, 240);

  drawCloud(ctx, 100, 60, 1.2);
  drawCloud(ctx, canvas.width * 0.5, 40, 0.8);
  drawCloud(ctx, canvas.width * 0.7, 80, 1.0);

  ctx.fillStyle = '#7BC67E';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.55);
  ctx.quadraticCurveTo(canvas.width * 0.3, canvas.height * 0.45, canvas.width * 0.6, canvas.height * 0.55);
  ctx.quadraticCurveTo(canvas.width * 0.8, canvas.height * 0.5, canvas.width, canvas.height * 0.52);
  ctx.lineTo(canvas.width, canvas.height * 0.7);
  ctx.lineTo(0, canvas.height * 0.7);
  ctx.fill();

  const grassGrad = ctx.createLinearGradient(0, canvas.height * 0.65, 0, canvas.height);
  grassGrad.addColorStop(0, '#4CAF50');
  grassGrad.addColorStop(1, '#2E7D32');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);
}

function drawPixarLucik(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + 5, y + 45, 25, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(x, y, x, y + 60);
  bodyGrad.addColorStop(0, '#FFB347');
  bodyGrad.addColorStop(0.4, '#FF8C00');
  bodyGrad.addColorStop(1, '#E67600');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(x, y + 30, 22, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(x - 8, y + 20, 6, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();

  const headGrad = ctx.createRadialGradient(x - 3, y - 3, 5, x, y, 25);
  headGrad.addColorStop(0, '#FFD699');
  headGrad.addColorStop(0.7, '#FF8C00');
  headGrad.addColorStop(1, '#E67600');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 8, y - 3, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 8, y - 3, 8, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(x - 7, y - 3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 9, y - 3, 4, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 9, y - 5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 7, y - 5, 2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#FF8C00';
  ctx.beginPath(); ctx.moveTo(x - 18, y - 10); ctx.lineTo(x - 22, y - 28); ctx.lineTo(x - 10, y - 15); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 18, y - 10); ctx.lineTo(x + 22, y - 28); ctx.lineTo(x + 10, y - 15); ctx.fill();

  ctx.fillStyle = '#FF6B9D';
  ctx.beginPath(); ctx.arc(x, y + 2, 3, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y + 8, 6, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

function drawPixarObstacle(ctx, o) {
  const rockGrad = ctx.createRadialGradient(o.x + o.w / 2, o.y + o.h / 2, 2, o.x + o.w / 2, o.y + o.h / 2, o.w);
  rockGrad.addColorStop(0, '#9E9E9E');
  rockGrad.addColorStop(0.6, '#616161');
  rockGrad.addColorStop(1, '#424242');
  ctx.fillStyle = rockGrad;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(o.x, o.y, o.w, o.h, 8);
  } else {
    ctx.rect(o.x, o.y, o.w, o.h);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(o.x + o.w * 0.35, o.y + o.h * 0.3, o.w * 0.15, o.h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPixarStar(ctx, s) {
  const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2);
  grad.addColorStop(0, '#FFFDE7');
  grad.addColorStop(0.5, '#FFD700');
  grad.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFD700';
  ctx.font = `${s.r * 2}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⭐', s.x, s.y);
}

export function startRunnerGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('runner');

  const { body, close } = createGameScreen({ gameId: 'runner', title: 'Люцик-раннер', emoji: '🏃', level });

  const canvas = document.createElement('canvas');
  canvas.id = 'runnerCanvas';
  canvas.className = 'runner-pixar-canvas';
  canvas.style.cssText = 'width:100%;max-width:520px;border-radius:16px;touch-action:none;box-shadow:0 12px 40px rgba(0,0,0,0.35);';
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
    drawPixarBackground(ctx, canvas);

    obstacles.forEach((o) => drawPixarObstacle(ctx, o));
    stars.forEach((s) => drawPixarStar(ctx, s));
    drawPixarLucik(ctx, lucik.x, lucik.y - 15);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
    ctx.fillText(`⭐ ${score}`, 16, 32);
    ctx.shadowBlur = 0;

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 28px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Игра окончена!', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'left';
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
