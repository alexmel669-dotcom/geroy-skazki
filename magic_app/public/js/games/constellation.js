import { appState } from '../core.js';
import { ttsEngine } from '../audio.js';
import { createGameScreen, getGameLevel, triggerGameWin } from './game-ui.js';

let bgStarsCache = [];

function drawPixarSpace(ctx, canvas, bgStars) {
  const spaceGrad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 50,
    canvas.width / 2, canvas.height / 2, canvas.width
  );
  spaceGrad.addColorStop(0, '#1a0533');
  spaceGrad.addColorStop(0.3, '#0d0221');
  spaceGrad.addColorStop(0.6, '#050011');
  spaceGrad.addColorStop(1, '#000008');
  ctx.fillStyle = spaceGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const nebulaGrad = ctx.createRadialGradient(
    canvas.width * 0.3, canvas.height * 0.4, 30,
    canvas.width * 0.3, canvas.height * 0.4, 200
  );
  nebulaGrad.addColorStop(0, 'rgba(123,104,238,0.3)');
  nebulaGrad.addColorStop(0.5, 'rgba(255,105,180,0.15)');
  nebulaGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = nebulaGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  bgStars.forEach(({ x, y, r }) => {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,220,0.8)');
    grad.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawConstellationReveal(ctx, points) {
  if (points.length < 2) return;
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawInteractiveStar(ctx, s) {
  const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3);
  grad.addColorStop(0, s.active ? '#FFFDE7' : '#ffffff');
  grad.addColorStop(0.5, s.active ? '#FFD700' : 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (s.active) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function startConstellationGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('constellation');

  const { body, close, overlay } = createGameScreen({ gameId: 'constellation', title: 'Созвездия', emoji: '🌟', level });

  const canvas = document.createElement('canvas');
  canvas.id = 'constCanvas';
  canvas.className = 'constellation-pixar-canvas';
  const label = document.createElement('p');
  label.id = 'constName';
  label.className = 'constellation-pixar-label';
  body.appendChild(canvas);
  body.appendChild(label);

  const ctx = canvas.getContext('2d');
  const resize = () => {
    canvas.width = Math.min(window.innerWidth - 32, 520);
    canvas.height = Math.min(window.innerHeight - 200, 400);
    bgStarsCache = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.5 + 0.5
    }));
  };
  resize();

  const stars = Array.from({ length: 15 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 3 + Math.random() * 5,
    active: false
  }));
  const selected = [];
  let completed = false;

  function draw() {
    drawPixarSpace(ctx, canvas, bgStarsCache);
    drawConstellationReveal(ctx, selected);
    stars.forEach((s) => drawInteractiveStar(ctx, s));
  }

  canvas.addEventListener('click', (e) => {
    if (completed) return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width / r.width);
    const my = (e.clientY - r.top) * (canvas.height / r.height);
    const hit = stars.find((s) => Math.hypot(s.x - mx, s.y - my) < 20);
    if (!hit || hit.active) return;
    hit.active = true;
    selected.push(hit);
    if (selected.length >= 5) {
      completed = true;
      label.textContent = '✨ Созвездие собрано!';
      triggerGameWin(overlay);
      ttsEngine.speak('Какое красивое созвездие! Ты настоящий звездочёт!').catch(() => {});
    }
    draw();
  });

  draw();

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    appState.gameActive = false;
  }, { once: true });
}

export default { startConstellationGame };
