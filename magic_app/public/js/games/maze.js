import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { avatarUrl } from '../config.js';

const SIZES = [7, 11, 15];
const MAX_STEPS = [50, 80, 120];

function generate(size) {
  const m = Array(size).fill().map(() => Array(size).fill(1));
  const v = Array(size).fill().map(() => Array(size).fill(false));

  function carve(x, y) {
    v[y][x] = true; m[y][x] = 0;
    const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && !v[ny][nx]) {
        m[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  carve(1, 1);
  m[1][0] = 0;
  m[size - 2][size - 1] = 0;
  if (m[size - 2][size - 2] === 1) m[size - 2][size - 2] = 0;
  return m;
}

export function startMazeGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('maze');
  const size = SIZES[Math.min(level, 3) - 1] || 7;
  const maxSteps = MAX_STEPS[Math.min(level, 3) - 1] || 50;
  const maze = generate(size);

  let px = 0; let py = 1; let steps = 0; let ended = false;
  const exitX = size - 1; const exitY = size - 2;

  const { body, close } = createGameScreen({ gameId: 'maze', title: '🌀 Лабиринт', emoji: '🌀', level });

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;max-width:100%;border-radius:12px;';
  body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const cs = Math.min(400, window.innerWidth - 32) / size;
  canvas.width = cs * size;
  canvas.height = cs * size;

  const playerImg = new Image();
  playerImg.src = avatarUrl('lucik', 'svg');
  playerImg.onerror = () => { playerImg.src = avatarUrl('lucik', 'png'); };

  function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (maze[y][x] === 1) {
          ctx.fillStyle = '#3e2723';
          ctx.fillRect(x * cs, y * cs, cs, cs);
          ctx.fillStyle = '#5c4033';
          ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
        }
      }
    }

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(exitX * cs + cs / 2, exitY * cs + cs / 2, cs * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${cs * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⭐', exitX * cs + cs / 2, exitY * cs + cs / 2 + cs * 0.15);

    if (playerImg.complete && playerImg.naturalWidth > 0) {
      ctx.drawImage(playerImg, px * cs + 2, py * cs + 2, cs - 4, cs - 4);
    } else {
      ctx.fillStyle = '#FF8C00';
      ctx.beginPath();
      ctx.arc(px * cs + cs / 2, py * cs + cs / 2, cs / 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Шаги: ${steps}/${maxSteps}`, 8, canvas.height - 8);
  }

  function move(dx, dy) {
    if (ended) return;
    const nx = px + dx; const ny = py + dy;
    if (nx >= 0 && nx < size && ny >= 0 && ny < size && maze[ny][nx] === 0) {
      px = nx; py = ny; steps++;
      draw();
      if (px === exitX && py === exitY) endGame(true);
      else if (steps >= maxSteps) endGame(false);
    }
  }

  const onKey = (e) => {
    const keys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (keys[e.key]) { e.preventDefault(); move(...keys[e.key]); }
  };
  document.addEventListener('keydown', onKey);

  let touchX = 0; let touchY = 0;
  canvas.onpointerdown = (e) => { touchX = e.clientX; touchY = e.clientY; };
  canvas.onpointerup = (e) => {
    const dx = e.clientX - touchX; const dy = e.clientY - touchY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
  };

  function endGame(won) {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    document.removeEventListener('keydown', onKey);
    close();
    recordGameResult('maze', won, level);
    if (won) { recordGameWin('maze', level); updateAchievement('maze_runner'); checkProgressAchievements(); }
    trackEvent(won ? 'maze_won' : 'maze_lost', { level, steps });
    speak(won ? 'Выход найден!' : 'Слишком много шагов!');
    showGameResult({
      won, level,
      scoreText: `Пройдено за ${steps} шагов`,
      onNext: won ? () => startMazeGame(level + 1) : null,
      onRestart: () => startMazeGame(level)
    });
  }

  playerImg.onload = () => draw();
  draw();
  trackEvent('maze_started', { level });
}

export default { startMazeGame };
