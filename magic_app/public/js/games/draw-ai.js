import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const TASKS = {
  1: { hint: 'Нарисуй солнышко ☀️', check: (d) => d.includes('жёлт') || d.includes('желт') || d.includes('круг') },
  2: { hint: 'Нарисуй домик 🏠', check: (d) => d.includes('квадрат') || d.includes('крыш') },
  3: { hint: 'Нарисуй котика 🐱', check: (d) => d.includes('круг') || d.includes('уш') },
  4: { hint: 'Нарисуй дерево 🌳', check: (d) => d.includes('зелён') || d.includes('зелен') || d.includes('ствол') },
  5: { hint: 'Нарисуй машину 🚗', check: (d) => d.includes('прямоуг') || d.includes('колёс') || d.includes('колес') }
};

export function startDrawAIGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('drawAi');
  const task = TASKS[Math.min(level, 5)] || TASKS[1];

  const { body, close } = createGameScreen({ gameId: 'drawAi', title: '🎨 Рисовалка', emoji: '🎨', level });

  const hintEl = document.createElement('p');
  hintEl.style.cssText = 'text-align:center;color:#FFD700;font-size:18px;margin:8px 0;';
  hintEl.textContent = task.hint;

  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 300;
  canvas.style.cssText = 'display:block;margin:0 auto;background:#FFFEF5;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);cursor:crosshair;';

  const palette = document.createElement('div');
  palette.style.cssText = 'display:flex;gap:6px;justify-content:center;margin:8px 0;';
  ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8C00', '#A8E6CF', '#FF6B9D', '#333'].forEach((c) => {
    const s = document.createElement('div');
    s.style.cssText = `width:30px;height:30px;border-radius:50%;background:${c};border:3px solid #fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
    s.onclick = () => { currentColor = c; };
    palette.appendChild(s);
  });

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin:8px 0;';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = '🧹 Очистить';
  clearBtn.style.cssText = 'padding:10px 20px;border-radius:8px;border:none;background:#FF6B6B;color:#fff;cursor:pointer;';
  clearBtn.onclick = () => { ctx.fillStyle = '#FFFEF5'; ctx.fillRect(0, 0, 300, 300); };

  const guessBtn = document.createElement('button');
  guessBtn.textContent = '🤔 Угадай!';
  guessBtn.style.cssText = 'padding:10px 20px;border-radius:8px;border:none;background:#FFD700;color:#333;cursor:pointer;';

  const resultEl = document.createElement('p');
  resultEl.style.cssText = 'text-align:center;color:#fff;min-height:24px;';

  btnRow.append(clearBtn, guessBtn);
  body.append(hintEl, canvas, palette, btnRow, resultEl);

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFEF5'; ctx.fillRect(0, 0, 300, 300);
  let currentColor = '#333'; let drawing = false; let won = false;

  canvas.onmousedown = () => { drawing = true; };
  canvas.onmouseup = () => { drawing = false; };
  canvas.onmousemove = (e) => {
    if (!drawing) return;
    const r = canvas.getBoundingClientRect();
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc((e.clientX - r.left) * (300 / r.width), (e.clientY - r.top) * (300 / r.height), 6, 0, Math.PI * 2);
    ctx.fill();
  };

  canvas.ontouchstart = (e) => { drawing = true; const t = e.touches[0]; const r = canvas.getBoundingClientRect(); ctx.fillStyle = currentColor; ctx.beginPath(); ctx.arc((t.clientX - r.left) * (300 / r.width), (t.clientY - r.top) * (300 / r.height), 6, 0, Math.PI * 2); ctx.fill(); };
  canvas.ontouchend = () => { drawing = false; };
  canvas.ontouchmove = (e) => {
    if (!drawing) return;
    const t = e.touches[0]; const r = canvas.getBoundingClientRect();
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc((t.clientX - r.left) * (300 / r.width), (t.clientY - r.top) * (300 / r.height), 6, 0, Math.PI * 2);
    ctx.fill();
  };

  guessBtn.onclick = async () => {
    if (won) return;
    resultEl.textContent = '🤔 Думаю...';
    const dataUrl = canvas.toDataURL('image/png');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Посмотри на картинку. Ответь ОДНИМ словом что нарисовано.', type: 'chat', image: dataUrl })
      });

      const data = await res.json();
      const guess = (data.reply || data.message || 'не знаю').toLowerCase().trim();
      resultEl.textContent = `🤔 Это ${guess}?`;
      speak(`Мне кажется, это ${guess}. Правильно?`);

      if (task.check(guess)) {
        won = true;
        appState.gameActive = false;
        close();
        recordGameResult('drawAi', true, level);
        recordGameWin('drawAi', level);
        updateAchievement('artist');
        checkProgressAchievements();
        speak('Угадал! Молодец!');
        showGameResult({ won: true, level, onNext: () => startDrawAIGame(level + 1), onRestart: () => startDrawAIGame(level) });
      }
    } catch {
      resultEl.textContent = 'Не удалось угадать. Попробуй ещё раз!';
    }
  };

  trackEvent('drawAi_started', { level });
}

export default { startDrawAIGame };
