import { appState } from '../core.js';
import { ttsEngine } from '../audio.js';
import { updateAchievement } from '../achievements.js';
import { createGameScreen, getGameLevel, resetGameSession, showGameResult, recordGameWin } from './game-ui.js';

const PALETTE = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8C00', '#A8E6CF', '#FF6B9D', '#333333'];

const DRAWING_TASKS = {
  1: { prompt: 'солнышко', hint: 'Нарисуй солнышко! ☀️', check: (desc) => /жёлт|желт|солнц|круг/i.test(desc) },
  2: { prompt: 'домик', hint: 'Нарисуй домик! 🏠', check: (desc) => /квадрат|крыш|дом/i.test(desc) },
  3: { prompt: 'котик', hint: 'Нарисуй котика! 🐱', check: (desc) => /круг|уш|кот/i.test(desc) },
  4: { prompt: 'дерево', hint: 'Нарисуй дерево! 🌳', check: (desc) => /зелён|зелен|ствол|дерев/i.test(desc) },
  5: { prompt: 'машина', hint: 'Нарисуй машину! 🚗', check: (desc) => /прямоуг|колёс|колес|машин|авто/i.test(desc) }
};

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

  const taskHint = document.createElement('p');
  taskHint.id = 'taskHint';
  taskHint.className = 'draw-pixar-task';
  taskHint.style.cssText = 'text-align:center;font-weight:600;margin:0 0 8px;';

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

  wrap.append(taskHint, easel, palette, btnRow, resultEl);
  body.appendChild(wrap);

  return { wrap, canvas, guessBtn, clearBtn, resultEl, palette, taskHint };
}

export function startDrawAIGame(level) {
  resetGameSession();
  level = level || getGameLevel('drawAi');

  const task = DRAWING_TASKS[level] || DRAWING_TASKS[1];
  const { body, close } = createGameScreen({ gameId: 'drawAi', title: 'Рисовалка', emoji: '🎨', level });
  const { canvas, guessBtn, clearBtn, resultEl, palette, taskHint } = setupPixarCanvas(body);
  taskHint.textContent = task.hint;

  const ctx = canvas.getContext('2d');
  let won = false;

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
    if (won) return;
    resultEl.textContent = '🤔 Думаю...';
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Посмотри на картинку. Ребёнок рисовал: ${task.prompt}. Опиши что видишь одним-двумя словами по-русски.`,
          requestType: 'draw_guess',
          image: dataUrl
        })
      });
      const data = await res.json();
      const desc = (data.reply || data.message || '').toLowerCase();
      const guess = desc.split(/[\s,.!?«»"]+/)[0] || 'не знаю';
      resultEl.textContent = `🤔 Это ${guess}?`;
      ttsEngine.speak(`Мне кажется, это ${guess}. Правильно?`).catch(() => {});

      if (task.check(desc)) {
        won = true;
        appState.gameActive = false;
        close();
        recordGameWin('drawAi', level);
        updateAchievement('artist');
        showGameResult({
          won: true,
          level,
          scoreText: `Задание «${task.prompt}» выполнено!`,
          onNext: () => startDrawAIGame(level + 1)
        });
      }
    } catch {
      resultEl.textContent = 'Не удалось угадать. Попробуй ещё раз!';
    }
  });
}

export default { startDrawAIGame };
