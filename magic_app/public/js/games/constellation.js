import { appState } from '../core.js';
import { ttsEngine } from '../audio.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

export function startConstellationGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('constellation');

  const { body, close } = createGameScreen({ gameId: 'constellation', title: 'Созвездия', emoji: '🌟', level });

  const canvas = document.createElement('canvas');
  canvas.id = 'constCanvas';
  canvas.style.cssText = 'width:100%;max-width:520px;border-radius:12px;';
  const label = document.createElement('p');
  label.id = 'constName';
  label.style.textAlign = 'center';
  body.appendChild(canvas);
  body.appendChild(label);

  const ctx = canvas.getContext('2d');
  canvas.width = Math.min(window.innerWidth - 32, 520);
  canvas.height = Math.min(window.innerHeight - 200, 400);

  const stars = Array.from({ length: 15 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 3 + Math.random() * 5,
    active: false
  }));
  const selected = [];
  let lines = [];

  function draw() {
    ctx.fillStyle = '#0d0618';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stars.forEach((s) => {
      ctx.fillStyle = s.active ? '#FFD700' : '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    lines.forEach((l) => {
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    });
  }

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const hit = stars.find((s) => Math.hypot(s.x - mx, s.y - my) < 20);
    if (!hit) return;
    hit.active = true;
    if (selected.length > 0) {
      const prev = selected[selected.length - 1];
      lines.push({ x1: prev.x, y1: prev.y, x2: hit.x, y2: hit.y });
    }
    selected.push(hit);
    if (selected.length >= 5) {
      label.textContent = '✨ Созвездие собрано!';
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
