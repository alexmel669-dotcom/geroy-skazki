import { appState } from '../core.js';
import { createGameScreen, getGameLevel } from './game-ui.js';
import { avatarUrl } from '../config.js';

const OBSTACLE_TYPES = [
  {
    name: 'камень',
    w: 35,
    h: 35,
    draw(ctx, x, y) {
      const grad = ctx.createRadialGradient(x + 17, y + 17, 4, x + 17, y + 17, 18);
      grad.addColorStop(0, '#aaa');
      grad.addColorStop(1, '#666');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x + 17, y + 17, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x + 12, y + 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  {
    name: 'пенёк',
    w: 40,
    h: 30,
    draw(ctx, x, y) {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x + 5, y + 8, 30, 22);
      ctx.fillStyle = '#A0522D';
      ctx.beginPath();
      ctx.arc(x + 20, y + 8, 15, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(139,69,19,0.5)';
      ctx.fillRect(x + 8, y + 12, 24, 4);
    }
  },
  {
    name: 'лужа',
    w: 50,
    h: 15,
    draw(ctx, x, y) {
      ctx.fillStyle = 'rgba(30, 58, 95, 0.65)';
      ctx.beginPath();
      ctx.ellipse(x + 25, y + 8, 25, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x + 18, y + 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
];

function drawCloud(ctx, x, y, scale) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x, y, 30 * scale, 0, Math.PI * 2);
  ctx.arc(x + 25 * scale, y - 10 * scale, 25 * scale, 0, Math.PI * 2);
  ctx.arc(x + 50 * scale, y, 28 * scale, 0, Math.PI * 2);
  ctx.arc(x + 30 * scale, y + 10 * scale, 22 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(ctx, canvas, groundY, speed, frame, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let x = 0; x <= canvas.width; x += 40) {
    const y = groundY - 50 - Math.sin((x + frame * speed) * 0.015) * 35;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.fill();
}

function drawBackground(ctx, canvas, groundY, frame) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(0.6, '#B0E0E6');
  skyGrad.addColorStop(1, '#E8F5E9');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, groundY);

  const sunX = canvas.width * 0.82;
  const sunY = canvas.height * 0.12;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 90);
  sunGrad.addColorStop(0, 'rgba(255,255,200,0.95)');
  sunGrad.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(sunX - 90, sunY - 90, 180, 180);

  drawCloud(ctx, 80 + (frame * 0.3) % 40, 50, 1.1);
  drawCloud(ctx, canvas.width * 0.45, 35, 0.85);
  drawCloud(ctx, canvas.width * 0.72, 65, 1.0);

  drawHills(ctx, canvas, groundY, 0.8, frame, '#2d1b69');
  drawHills(ctx, canvas, groundY, 1.4, frame, '#4a3a8a');

  const grassGrad = ctx.createLinearGradient(0, groundY, 0, canvas.height);
  grassGrad.addColorStop(0, '#4CAF50');
  grassGrad.addColorStop(1, '#2E7D32');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
}

function crashEffect(particles, x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 5,
      life: 1,
      color: ['#FF8C00', '#FFD700', '#FF6B9D'][i % 3]
    });
  }
}

function drawPixarStar(ctx, s, frame) {
  const pulse = 1 + Math.sin(frame * 0.15 + s.x * 0.01) * 0.15;
  const r = s.r * pulse;
  const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2);
  grad.addColorStop(0, '#FFFDE7');
  grad.addColorStop(0.5, '#FFD700');
  grad.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r * 1.5, 0, Math.PI * 2);
  ctx.fill();
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
  const lucikImg = new Image();
  lucikImg.src = avatarUrl('lucik', 'png');
  let lucikReady = false;
  lucikImg.onload = () => { lucikReady = true; };

  const resize = () => {
    canvas.width = Math.min(window.innerWidth - 32, 520);
    canvas.height = Math.min(window.innerHeight - 180, 420);
  };
  resize();
  window.addEventListener('resize', resize);

  const lucik = { x: 60, y: 0, vy: 0, jumping: false, frame: 0 };
  let obstacles = [];
  let stars = [];
  let particles = [];
  let score = 0;
  let speed = 4 + Math.min(level, 5) * 0.3;
  let gameOver = false;
  let gameOverAt = 0;
  let loopId = null;
  let frame = 0;

  function groundY() { return canvas.height - 80; }

  function spawnObstacle() {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    obstacles.push({
      x: canvas.width,
      y: groundY() - type.h,
      type,
      wobble: Math.random() * Math.PI * 2
    });
  }

  function spawnStar() {
    stars.push({ x: canvas.width, y: groundY() - 55 - Math.random() * 30, r: 12 });
  }

  function jump() {
    if (!lucik.jumping && !gameOver) {
      lucik.vy = -11;
      lucik.jumping = true;
    }
  }

  function update() {
    if (gameOver) {
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.life -= 0.04;
      });
      particles = particles.filter((p) => p.life > 0);
      return;
    }

    frame++;
    lucik.frame++;
    lucik.vy += 0.52;
    lucik.y += lucik.vy;
    if (lucik.y >= groundY()) {
      lucik.y = groundY();
      lucik.vy = 0;
      lucik.jumping = false;
    }

    obstacles.forEach((o) => {
      o.x -= speed;
      o.wobble += 0.08;
    });
    stars.forEach((s) => { s.x -= speed; });
    obstacles = obstacles.filter((o) => o.x > -60);
    stars = stars.filter((s) => s.x > -20);

    const lucikHitbox = { x: lucik.x - 18, y: lucik.y - 40, w: 36, h: 45 };

    for (const o of obstacles) {
      const t = o.type;
      const ox = o.x;
      const oy = o.y + Math.sin(o.wobble) * 2;
      if (
        lucikHitbox.x < ox + t.w &&
        lucikHitbox.x + lucikHitbox.w > ox &&
        lucikHitbox.y < oy + t.h &&
        lucikHitbox.y + lucikHitbox.h > oy
      ) {
        gameOver = true;
        gameOverAt = Date.now();
        crashEffect(particles, lucik.x, lucik.y - 20);
        break;
      }
    }

    for (const s of [...stars]) {
      if (Math.abs(lucik.x - s.x) < 28 && Math.abs(lucik.y - 40 - s.y) < 28) {
        score += 10;
        stars = stars.filter((x) => x !== s);
      }
    }

    if (Math.random() < 0.018) spawnObstacle();
    if (Math.random() < 0.028) spawnStar();

    // Плавное ускорение
    speed = Math.min(4 + Math.min(level, 5) * 0.3 + frame * 0.0008, 12);
  }

  function drawLucik() {
    const drawX = lucik.x - 22;
    const drawY = lucik.y - 44;
    const bounce = lucik.jumping ? 0 : Math.sin(lucik.frame * 0.25) * 3;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(lucik.x, lucik.y + 4, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (lucikReady) {
      ctx.save();
      ctx.translate(0, bounce);
      ctx.drawImage(lucikImg, drawX, drawY, 44, 44);
      ctx.restore();
    } else {
      ctx.fillStyle = '#FF8C00';
      ctx.beginPath();
      ctx.arc(lucik.x, lucik.y - 20 + bounce, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(ctx, canvas, groundY(), frame);

    stars.forEach((s) => drawPixarStar(ctx, s, frame));

    obstacles.forEach((o) => {
      o.type.draw(ctx, o.x, o.y + Math.sin(o.wobble) * 2);
    });

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (!gameOver) drawLucik();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
    ctx.fillText(`⭐ ${score}`, 16, 32);
    ctx.shadowBlur = 0;

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 26px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Игра окончена!', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '18px Georgia, serif';
      ctx.fillText(`Счёт: ${score}`, canvas.width / 2, canvas.height / 2 + 24);
      ctx.textAlign = 'left';
    }
  }

  canvas.addEventListener('click', jump);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });

  lucik.y = groundY();
  loopId = setInterval(() => {
    update();
    draw();
    if (gameOverAt && Date.now() - gameOverAt > 2500) {
      clearInterval(loopId);
      appState.gameActive = false;
      close();
    }
  }, 20);

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    clearInterval(loopId);
    appState.gameActive = false;
  }, { once: true });
}

export default { startRunnerGame };
