import { appState } from '../core.js';
import { ttsEngine } from '../audio.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

const PALETTE = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8C00', '#A8E6CF', '#FF6B9D', '#333333'];

function drawWithSparkle(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function setupPixarCanvas(body) {
  const wrap = document.createElement('div');
  wrap.className = 'draw-pixar-wrap';

  const easel = document.createElement('div');
  easel.className = 'draw-pixar-easel';

  const canvas = document.createElement('canvas');
  canvas.id = 'drawCanvas';
  canvas.width = 300;
  canvas.height = 300;
  canvas.className = 'draw-pixar-canvas';
  easel.appendChild(canvas);

  const palette = document.createElement('div');
  palette.className = 'draw-pixar-palette';
  PALETTE.forEach((c, i) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'draw-color-swatch' + (i === 7 ? ' active' : '');
    swatch.style.background = c;
    swatch.dataset.color = c;
    swatch.setAttribute('aria-label', `Цвет ${c}`);
    palette.appendChild(swatch);
  });

  const guessBtn = document.createElement('button');
  guessBtn.type = 'button';
  guessBtn.id = 'guessBtn';
  guessBtn.className = 'draw-pixar-guess-btn';
  guessBtn.textContent = '🤔 Угадай!';

  const resultEl = document.createElement('p');
  resultEl.id = 'guessResult';
  resultEl.className = 'draw-pixar-result';

  wrap.append(easel, palette, guessBtn, resultEl);
  body.appendChild(wrap);

  return { wrap, canvas, guessBtn, resultEl, palette };
}

export function startDrawAIGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('drawAi');

  const { body, close } = createGameScreen({ gameId: 'drawAi', title: 'Рисовалка', emoji: '🎨', level });
  const { canvas, guessBtn, resultEl, palette } = setupPixarCanvas(body);

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFEF5';
  ctx.fillRect(0, 0, 300, 300);

  let drawing = false;
  let currentColor = '#333333';

  palette.querySelectorAll('.draw-color-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      currentColor = swatch.dataset.color;
      palette.querySelectorAll('.draw-color-swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
    });
  });

  const scalePoint = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (canvas.width / r.width),
      y: (clientY - r.top) * (canvas.height / r.height)
    };
  };

  const drawAt = (clientX, clientY) => {
    const { x, y } = scalePoint(clientX, clientY);
    drawWithSparkle(ctx, x, y, currentColor);
  };

  canvas.addEventListener('mousedown', () => { drawing = true; });
  canvas.addEventListener('mouseup', () => { drawing = false; });
  canvas.addEventListener('mouseleave', () => { drawing = false; });
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    drawAt(e.clientX, e.clientY);
  });

  canvas.addEventListener('touchstart', (e) => {
    drawing = true;
    const t = e.touches[0];
    drawAt(t.clientX, t.clientY);
  }, { passive: true });
  canvas.addEventListener('touchend', () => { drawing = false; });
  canvas.addEventListener('touchmove', (e) => {
    if (!drawing) return;
    const t = e.touches[0];
    drawAt(t.clientX, t.clientY);
  }, { passive: true });

  guessBtn.addEventListener('click', async () => {
    resultEl.textContent = '🤔 Думаю...';
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Ребёнок нарисовал картинку. Угадай одним-двумя словами, что это может быть (животное, предмет, персонаж). Ответь дружелюбно.',
          requestType: 'chat'
        })
      });
      const data = await res.json();
      const text = data.reply || data.message || 'Красивый рисунок!';
      resultEl.textContent = text;
      ttsEngine.speak(text).catch(() => {});
    } catch {
      resultEl.textContent = 'Не удалось угадать. Попробуй ещё раз!';
    }
  });

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    appState.gameActive = false;
  }, { once: true });

  const origClose = close;
  return { close: () => { appState.gameActive = false; origClose(); } };
}

export default { startDrawAIGame };
