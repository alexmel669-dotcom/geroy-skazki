import { appState } from '../core.js';
import { ttsEngine } from '../audio.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

export function startDrawAIGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('drawAi');

  const { body, close } = createGameScreen({ gameId: 'drawAi', title: 'Рисовалка', emoji: '🎨', level });

  const wrap = document.createElement('div');
  wrap.style.textAlign = 'center';
  wrap.innerHTML = `
    <canvas id="drawCanvas" width="300" height="300" style="border-radius:12px;touch-action:none;max-width:100%;"></canvas>
    <br>
    <button type="button" class="modal-btn" id="guessBtn" style="margin-top:12px;">🤔 Угадай что это?</button>
    <p id="guessResult" style="margin-top:8px;opacity:0.85;"></p>
  `;
  body.appendChild(wrap);

  const canvas = wrap.querySelector('#drawCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5e6c8';
  ctx.fillRect(0, 0, 300, 300);
  let drawing = false;

  const drawAt = (x, y) => {
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  };

  canvas.addEventListener('mousedown', () => { drawing = true; });
  canvas.addEventListener('mouseup', () => { drawing = false; });
  canvas.addEventListener('mouseleave', () => { drawing = false; });
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const r = canvas.getBoundingClientRect();
    drawAt(e.clientX - r.left, e.clientY - r.top);
  });

  canvas.addEventListener('touchstart', (e) => {
    drawing = true;
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    drawAt(t.clientX - r.left, t.clientY - r.top);
  }, { passive: true });
  canvas.addEventListener('touchend', () => { drawing = false; });
  canvas.addEventListener('touchmove', (e) => {
    if (!drawing) return;
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    drawAt(t.clientX - r.left, t.clientY - r.top);
  }, { passive: true });

  wrap.querySelector('#guessBtn').addEventListener('click', async () => {
    const resultEl = wrap.querySelector('#guessResult');
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
