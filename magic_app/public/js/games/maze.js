import { appState, incrementGames, getActiveChild } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getChildGender, applyGenderToText } from '../gender.js';

const MAZES = [
  [[1,1,1,1,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[1,1,1,1,1]],
  [[1,1,1,1,1,1],[1,0,0,1,0,1],[1,0,1,0,0,1],[1,0,1,1,0,1],[1,0,0,0,0,1],[1,1,1,1,1,1]],
  [[1,1,1,1,1,1,1],[1,0,0,0,1,0,1],[1,0,1,0,0,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,0,1,1,0,1,1],[1,1,1,1,1,1,1]],
  [[1,1,1,1,1,1,1,1],[1,0,0,0,1,0,0,1],[1,0,1,1,0,1,0,1],[1,0,0,0,0,1,0,1],[1,1,1,0,1,0,0,1],[1,0,0,0,0,0,1,1],[1,0,1,1,1,0,0,1],[1,1,1,1,1,1,1,1]],
  [[1,1,1,1,1,1,1,1,1],[1,0,0,0,1,0,0,0,1],[1,0,1,1,0,1,1,0,1],[1,0,0,0,0,0,1,0,1],[1,1,1,0,1,0,0,0,1],[1,0,0,0,1,1,1,0,1],[1,0,1,1,0,0,0,0,1],[1,0,0,0,0,1,1,0,1],[1,1,1,1,1,1,1,1,1]]
];

export function startMazeGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('maze');
  const idx = Math.min(Math.max(level, 1), MAZES.length) - 1;
  const grid = MAZES[idx];
  const rows = grid.length;
  const cols = grid[0].length;
  let px = 1;
  let py = 1;
  const exit = { x: cols - 2, y: rows - 2 };
  let steps = 0;

  appState.gameActive = true;
  const cell = Math.min(42, Math.floor(Math.min(window.innerWidth * 0.88, 360) / cols));

  const { body, close } = createGameScreen({
    gameId: 'maze',
    title: 'Лабиринт',
    emoji: '🌀',
    level
  });

  const hint = document.createElement('p');
  hint.style.cssText = 'text-align:center;opacity:0.8;font-size:0.85rem;margin:0 0 8px;';
  hint.textContent = 'Свайпай или стрелки — веди Люцика к ⭐';

  const wrap = document.createElement('div');
  wrap.className = 'maze-canvas-wrap';
  wrap.style.cssText = 'position:relative;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(108,99,255,0.35);';

  const canvas = document.createElement('canvas');
  canvas.id = 'mazeCanvas';
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  canvas.style.cssText = 'display:block;touch-action:none;max-width:100%;';
  wrap.appendChild(canvas);

  const stepsEl = document.createElement('p');
  stepsEl.style.cssText = 'text-align:center;margin-top:10px;font-weight:600;';
  stepsEl.textContent = 'Шагов: 0';

  body.appendChild(hint);
  body.appendChild(wrap);
  body.appendChild(stepsEl);

  const ctx = canvas.getContext('2d');
  let startX = 0;
  let startY = 0;

  function draw() {
    ctx.fillStyle = '#0d1025';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) {
          const grad = ctx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
          grad.addColorStop(0, '#6C63FF');
          grad.addColorStop(1, '#4a42c4');
          ctx.fillStyle = grad;
          ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
    ctx.fillStyle = '#ffb800';
    ctx.shadowColor = '#ffb800';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(exit.x * cell + cell / 2, exit.y * cell + cell / 2, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = `${cell * 0.65}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐱', px * cell + cell / 2, py * cell + cell / 2);
    ctx.fillText('⭐', exit.x * cell + cell / 2, exit.y * cell + cell / 2 + cell * 0.35);
  }

  function winGame() {
    const gender = getChildGender(getActiveChild());
    speak(applyGenderToText('Ура! Ты провёл меня через лабиринт!', gender));
    incrementGames();
    appState.gameActive = false;
    close();
    recordGameWin('maze', level);
    showGameResult({
      won: true,
      level,
      scoreText: `Выход найден за ${steps} шагов!`,
      onNext: () => startMazeGame(level + 1)
    });
    trackEvent('maze_won', { level, steps });
  }

  function tryMove(dx, dy) {
    const nx = px + dx;
    const ny = py + dy;
    if (grid[ny]?.[nx] === 0) {
      px = nx;
      py = ny;
      steps++;
      stepsEl.textContent = `Шагов: ${steps}`;
      draw();
      if (px === exit.x && py === exit.y) {
        canvas.style.animation = 'pulse 0.4s ease';
        setTimeout(winGame, 500);
      }
    }
  }

  canvas.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
    else tryMove(0, dy > 0 ? 1 : -1);
  });

  const overlay = body.closest('.game-screen');
  document.addEventListener('keydown', onKey);
  overlay?.querySelector('.game-close-btn')?.addEventListener('click', () => {
    document.removeEventListener('keydown', onKey);
  }, { once: true });

  function onKey(e) {
    if (!appState.gameActive) return;
    const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      tryMove(d[0], d[1]);
    }
  }

  draw();
  trackEvent('maze_started', { level });
}

export default { startMazeGame };
