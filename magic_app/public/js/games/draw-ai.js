import { appState } from '../core.js';
import { ttsEngine } from '../audio.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

const PALETTE = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8C00', '#A8E6CF', '#FF6B9D', '#333333'];

function analyzePixels(canvas) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0, g = 0, b = 0, count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] < 700) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }

  if (count === 0) return 'пустой холст';
  const avgR = Math.round(r / count);
  const avgG = Math.round(g / count);
  const avgB = Math.round(b / count);
  const color = avgR > avgG && avgR > avgB ? 'красный'
    : avgG > avgR && avgG > avgB ? 'зелёный'
      : avgB > avgR && avgB > avgG ? 'синий' : 'смешанный';
  const fill = Math.round((count / (canvas.width * canvas.height)) * 100);
  return `закрашено ${fill}%, цвет ${color}`;
}

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

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.id = 'clearBtn';
  clearBtn.className = 'modal-btn secondary draw-pixar-clear-btn';
  clearBtn.textContent = '🧹 Очистить';

  const btnRow = document.createElement('div');
  btnRow.className = 'draw-pixar-btns';
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px;';
  btnRow.append(clearBtn, guessBtn);

  const resultEl = document.createElement('p');
  resultEl.id = 'guessResult';
  resultEl.className = 'draw-pixar-result';

  wrap.append(easel, palette, btnRow, resultEl);
  body.appendChild(wrap);

  return { wrap, canvas, guessBtn, clearBtn, resultEl, palette };
}

export function startDrawAIGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('drawAi');

  const { body, close } = createGameScreen({ gameId: 'drawAi', title: 'Рисовалка', emoji: '🎨', level });
  const { canvas, guessBtn, clearBtn, resultEl, palette } = setupPixarCanvas(body);

  const ctx = canvas.getContext('2d');

  function clearCanvas() {
    ctx.fillStyle = '#FFFEF5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    resultEl.textContent = '';
  }

  clearCanvas();

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

  clearBtn.addEventListener('click', clearCanvas);

  guessBtn.addEventListener('click', async () => {
    resultEl.textContent = '🤔 Думаю...';
    try {
      const desc = analyzePixels(canvas);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Ребёнок нарисовал: ${desc}. Угадай ОДНИМ словом на русском.`,
          requestType: 'chat'
        })
      });
      const data = await res.json();
      const guess = (data.reply || data.message || 'не знаю').trim().split(/[\s,.!]+/)[0];
      resultEl.textContent = `🤔 Это ${guess}?`;
      ttsEngine.speak(`Мне кажется, это ${guess}. Правильно?`).catch(() => {});
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
