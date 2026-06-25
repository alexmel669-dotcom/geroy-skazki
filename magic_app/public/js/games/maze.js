import { appState, incrementGames, getActiveChildName } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';

const MAZES = [
  [[1,1,1,1,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[1,1,1,1,1]],
  [[1,1,1,1,1,1],[1,0,0,1,0,1],[1,0,1,0,0,1],[1,0,1,1,0,1],[1,0,0,0,0,1],[1,1,1,1,1,1]],
  [[1,1,1,1,1,1,1],[1,0,0,0,1,0,1],[1,0,1,0,0,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,0,1,1,0,1,1],[1,1,1,1,1,1,1]]
];

export function startMazeGame(level = 1) {
  if (appState.gameActive) return;
  const idx = Math.min(Math.max(level, 1), 3) - 1;
  const grid = MAZES[idx];
  const rows = grid.length;
  const cols = grid[0].length;
  let px = 1;
  let py = 1;
  const exit = { x: cols - 2, y: rows - 2 };

  appState.gameActive = true;
  const cell = Math.min(44, Math.floor(280 / cols));

  const overlay = document.createElement('div');
  overlay.className = 'game-overlay';
  overlay.innerHTML = `
    <div style="text-align:center;padding:16px;">
      <h2>🌀 Лабиринт — уровень ${idx + 1}</h2>
      <p style="opacity:0.7;font-size:0.85rem;">Свайпай, чтобы вести Люцика к выходу ⭐</p>
      <canvas id="mazeCanvas" width="${cols * cell}" height="${rows * cell}" style="border-radius:12px;margin:12px 0;touch-action:none;"></canvas>
      <button class="modal-btn secondary" id="mazeClose">✕ Закрыть</button>
    </div>`;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('#mazeCanvas');
  const ctx = canvas.getContext('2d');
  let startX = 0;
  let startY = 0;

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) {
          ctx.fillStyle = '#6C63FF';
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
    ctx.fillStyle = '#ffb800';
    ctx.beginPath();
    ctx.arc(exit.x * cell + cell / 2, exit.y * cell + cell / 2, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${cell * 0.7}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐱', px * cell + cell / 2, py * cell + cell / 2);
  }

  function tryMove(dx, dy) {
    const nx = px + dx;
    const ny = py + dy;
    if (grid[ny]?.[nx] === 0) {
      px = nx;
      py = ny;
      draw();
      if (px === exit.x && py === exit.y) {
        speak('Ура! Ты провёл меня через лабиринт!');
        trackEvent('game_complete', 'maze');
        incrementGames();
        setTimeout(close, 1200);
      }
    }
  }

  function close() {
    appState.gameActive = false;
    overlay.remove();
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

  overlay.querySelector('#mazeClose').onclick = close;
  draw();
  trackEvent('game_selected', 'maze');
}

export default { startMazeGame };
