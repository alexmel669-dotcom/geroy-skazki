import { appState, getActiveChildName } from '../core.js';
import { updateAchievement } from '../achievements.js';
import { recordPuzzleWin } from '../game-progress.js';
import { setAvatarState } from '../ui.js';
import { trackEvent } from '../analytics.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const GRID_BY_LEVEL = {
  1: 3,
  2: 3,
  3: 4,
  4: 4,
  5: 5
};

const PIECES = {
  3: ['🌟', '🌈', '🦁', '🐱', '🎨', '🎮', '🧩', '🍎', ''],
  4: ['🌟', '🌈', '🦁', '🐱', '🎨', '🎮', '🧩', '🍎', '🚀', '⭐', '🎵', '🌸', '🐶', '🦋', '🐸', ''],
  5: ['🌟', '🌈', '🦁', '🐱', '🎨', '🎮', '🧩', '🍎', '🚀', '⭐', '🎵', '🌸', '🐶', '🦋', '🐸', '🦄', '🎪', '🍭', '🎁', '🏆', '🌙', '☀️', '🍀', '🎈', '']
};

export function startPuzzleGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('puzzle');
  runPuzzle(level);
}

function runPuzzle(level) {
  const gridSize = GRID_BY_LEVEL[level] || 3;
  const correctOrder = PIECES[gridSize] || PIECES[3];

  appState.gameActive = true;
  let moves = 0;

  const { body, close } = createGameScreen({
    gameId: 'puzzle',
    title: `Пазл ${gridSize}×${gridSize}`,
    emoji: '🧩',
    level
  });

  const hud = document.createElement('p');
  hud.style.cssText = 'text-align:center;opacity:0.85;margin:0 0 8px;';
  hud.textContent = `Сдвигай плитки · ходов: 0`;

  const board = document.createElement('div');
  board.className = 'puzzle-board puzzle-board-animated';
  board.style.cssText = `display:grid;grid-template-columns:repeat(${gridSize},1fr);gap:6px;max-width:min(92vw,380px);width:100%;margin:0 auto;`;

  let pieces = [...correctOrder];
  if (gridSize <= 4) {
    do {
      pieces = [...correctOrder].sort(() => Math.random() - 0.5);
    } while (!isPuzzleSolvable(pieces, gridSize) || JSON.stringify(pieces) === JSON.stringify(correctOrder));
  } else {
    pieces = [...correctOrder].sort(() => Math.random() - 0.5);
  }

  function renderBoard() {
    board.innerHTML = '';
    pieces.forEach((piece, idx) => {
      const cell = document.createElement('div');
      cell.className = 'puzzle-cell';
      cell.style.cssText = `
        aspect-ratio: 1;
        background: ${piece ? 'linear-gradient(135deg,#5a5a8a,#7a7ab0)' : 'rgba(0,0,0,0.25)'};
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${gridSize >= 5 ? '1.1rem' : '1.45rem'};
        cursor: ${piece ? 'pointer' : 'default'};
        transition: transform 0.2s, background 0.2s;
        box-shadow: ${piece ? '0 4px 12px rgba(0,0,0,0.25)' : 'none'};
      `;
      cell.textContent = piece;
      cell.dataset.index = String(idx);
      if (piece) {
        cell.onmouseenter = () => { cell.style.transform = 'scale(1.05)'; };
        cell.onmouseleave = () => { cell.style.transform = 'scale(1)'; };
      }
      board.appendChild(cell);
    });
  }

  function findEmptyIndex() {
    return pieces.findIndex((p) => p === '');
  }

  function canMove(from, to, size) {
    const fromRow = Math.floor(from / size);
    const fromCol = from % size;
    const toRow = Math.floor(to / size);
    const toCol = to % size;
    return Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol) === 1;
  }

  function winGame() {
    updateAchievement('puzzle_solver');
    recordPuzzleWin(getActiveChildName());
    recordGameWin('puzzle', level);
    setAvatarState('happy');
    appState.gameActive = false;
    close();
    setTimeout(() => setAvatarState(null), 800);
    showGameResult({
      won: true,
      level,
      scoreText: `Собрано за ${moves} ходов!`,
      onNext: () => startPuzzleGame(level + 1)
    });
    trackEvent('puzzle_won', { level, moves, gridSize });
  }

  board.addEventListener('click', (e) => {
    const cell = e.target.closest('.puzzle-cell');
    if (!cell) return;
    const clickedIndex = parseInt(cell.dataset.index, 10);
    if (!pieces[clickedIndex]) return;
    const emptyIndex = findEmptyIndex();
    if (emptyIndex === -1 || !canMove(clickedIndex, emptyIndex, gridSize)) return;
    [pieces[clickedIndex], pieces[emptyIndex]] = [pieces[emptyIndex], pieces[clickedIndex]];
    moves++;
    hud.textContent = `Сдвигай плитки · ходов: ${moves}`;
    renderBoard();
    if (pieces.every((p, i) => p === correctOrder[i])) {
      board.style.animation = 'gameResultBounce 0.5s ease';
      setTimeout(winGame, 400);
    }
  });

  body.appendChild(hud);
  body.appendChild(board);
  renderBoard();
  trackEvent('puzzle_started', { level, gridSize });
}

function isPuzzleSolvable(pieces, size) {
  const flat = pieces.filter((p) => p !== '');
  let inversions = 0;
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (String(flat[i]) > String(flat[j])) inversions++;
    }
  }
  if (size % 2 === 1) return inversions % 2 === 0;
  const emptyRow = Math.floor(pieces.indexOf('') / size);
  return (inversions + emptyRow) % 2 === 0;
}

export default startPuzzleGame;
