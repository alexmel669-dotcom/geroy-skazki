import { appState, incrementGames, getActiveChild } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getChildGender, applyGenderToText } from '../gender.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Рекурсивный backtracking — гарантированный путь на любом уровне */
function generateMaze(size) {
  const maze = Array(size).fill(null).map(() => Array(size).fill(1));
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));

  function carve(x, y) {
    visited[y][x] = true;
    maze[y][x] = 0;

    for (const [dx, dy] of shuffle([[0, -2], [2, 0], [0, 2], [-2, 0]])) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx]) {
        maze[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  carve(1, 1);
  maze[1][0] = 0;
  maze[size - 2][size - 1] = 0;

  if (maze[size - 2][size - 2] === 1 && maze[size - 3]?.[size - 1] === 1) {
    maze[size - 2][size - 2] = 0;
  }

  return maze;
}

function buildVines(maze, cellSize) {
  const vines = [];
  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[0].length; x++) {
      if (maze[y][x] === 1 && ((x * 7 + y * 13) % 5 === 0)) {
        vines.push({
          x: x * cellSize,
          y: y * cellSize,
          cx: x * cellSize + cellSize * 0.5,
          cy: y * cellSize + cellSize * 0.5,
          tipX: x * cellSize + cellSize * ((x + y) % 3) / 3,
          tipY: y * cellSize
        });
      }
    }
  }
  return vines;
}

function drawMaze(ctx, maze, cellSize, px, py, vines, exit) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  const bgGrad = ctx.createRadialGradient(
    px * cellSize + cellSize / 2,
    py * cellSize + cellSize / 2,
    30,
    cw / 2,
    ch / 2,
    Math.max(cw, ch)
  );
  bgGrad.addColorStop(0, 'rgba(30,30,50,0.85)');
  bgGrad.addColorStop(1, 'rgba(10,10,20,0.98)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, cw, ch);

  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[0].length; x++) {
      if (maze[y][x] === 1) {
        const wallGrad = ctx.createLinearGradient(
          x * cellSize, y * cellSize,
          (x + 1) * cellSize, (y + 1) * cellSize
        );
        wallGrad.addColorStop(0, '#5c4033');
        wallGrad.addColorStop(1, '#3e2723');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      } else {
        ctx.fillStyle = 'rgba(20,30,20,0.4)';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  ctx.strokeStyle = '#2d5a27';
  ctx.lineWidth = 1.5;
  vines.forEach((v) => {
    ctx.beginPath();
    ctx.moveTo(v.cx, v.y + cellSize);
    ctx.quadraticCurveTo(v.cx, v.cy, v.tipX, v.tipY);
    ctx.stroke();
  });

  const exitX = exit.x;
  const exitY = exit.y;
  const exitGlow = ctx.createRadialGradient(
    exitX * cellSize + cellSize / 2,
    exitY * cellSize + cellSize / 2,
    5,
    exitX * cellSize + cellSize / 2,
    exitY * cellSize + cellSize / 2,
    cellSize * 1.2
  );
  exitGlow.addColorStop(0, 'rgba(255,255,255,0.95)');
  exitGlow.addColorStop(0.3, 'rgba(255,255,200,0.5)');
  exitGlow.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = exitGlow;
  ctx.beginPath();
  ctx.arc(
    exitX * cellSize + cellSize / 2,
    exitY * cellSize + cellSize / 2,
    cellSize * 0.55,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const glowGrad = ctx.createRadialGradient(
    px * cellSize + cellSize / 2,
    py * cellSize + cellSize / 2,
    4,
    px * cellSize + cellSize / 2,
    py * cellSize + cellSize / 2,
    cellSize * 0.9
  );
  glowGrad.addColorStop(0, 'rgba(255,215,0,1)');
  glowGrad.addColorStop(0.35, 'rgba(255,215,0,0.5)');
  glowGrad.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(px * cellSize + cellSize / 2, py * cellSize + cellSize / 2, cellSize * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FF8C00';
  ctx.beginPath();
  ctx.arc(px * cellSize + cellSize / 2, py * cellSize + cellSize / 2, cellSize / 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `${cellSize * 0.5}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⭐', exitX * cellSize + cellSize / 2, exitY * cellSize + cellSize / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function mazeSizeForLevel(level) {
  const sizes = [7, 11, 15];
  return sizes[Math.min(Math.max(level, 1), sizes.length) - 1] || 15;
}

export function startMazeGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('maze');

  const size = mazeSizeForLevel(level);
  const grid = generateMaze(size);
  const rows = grid.length;
  const cols = grid[0].length;

  let px = 0;
  let py = 1;
  const exit = { x: cols - 1, y: rows - 2 };
  let steps = 0;

  appState.gameActive = true;
  const cell = Math.min(36, Math.floor(Math.min(window.innerWidth * 0.9, 380) / cols));

  const { body, close } = createGameScreen({
    gameId: 'maze',
    title: 'Лабиринт',
    emoji: '🌀',
    level
  });

  const hint = document.createElement('p');
  hint.className = 'maze-hint';
  hint.textContent = 'Свайпай или стрелки — веди огонёк к ⭐';

  const wrap = document.createElement('div');
  wrap.className = 'maze-canvas-wrap';
  const canvas = document.createElement('canvas');
  canvas.id = 'mazeCanvas';
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  canvas.style.cssText = 'display:block;touch-action:none;max-width:100%;border-radius:12px;';
  wrap.appendChild(canvas);

  const stepsEl = document.createElement('p');
  stepsEl.className = 'maze-steps';
  stepsEl.textContent = 'Шагов: 0';

  body.append(hint, wrap, stepsEl);

  const ctx = canvas.getContext('2d');
  const vines = buildVines(grid, cell);

  function redraw() {
    drawMaze(ctx, grid, cell, px, py, vines, exit);
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
    trackEvent('maze_won', { level, steps, size });
  }

  function tryMove(dx, dy) {
    const nx = px + dx;
    const ny = py + dy;
    if (grid[ny]?.[nx] === 0) {
      px = nx;
      py = ny;
      steps++;
      stepsEl.textContent = `Шагов: ${steps}`;
      redraw();
      if (px === exit.x && py === exit.y) {
        canvas.style.animation = 'pulse 0.4s ease';
        setTimeout(winGame, 450);
      }
    }
  }

  let startX = 0;
  let startY = 0;

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

  function onKey(e) {
    if (!appState.gameActive) return;
    const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      tryMove(d[0], d[1]);
    }
  }

  document.addEventListener('keydown', onKey);
  overlay?.querySelector('.game-close-btn')?.addEventListener('click', () => {
    document.removeEventListener('keydown', onKey);
  }, { once: true });

  redraw();
  trackEvent('maze_started', { level, size });
}

export default { startMazeGame };
