import { appState, getActiveChildName } from '../core.js';
import { showModal } from '../ui.js';
import { updateAchievement } from '../achievements.js';
import { recordPuzzleWin } from '../game-progress.js';
import { setAvatarState } from '../ui.js';

const LEVELS = {
  3: { label: '3×3 — легко (3–8 лет)', pieces: ['🌟', '🌈', '🦁', '🐱', '🎨', '🎮', '🧩', '🍎', ''] },
  4: { label: '4×4 — средне (8–11 лет)', pieces: ['🌟', '🌈', '🦁', '🐱', '🎨', '🎮', '🧩', '🍎', '🚀', '⭐', '🎵', '🌸', '🐶', '🦋', ''] },
  6: { label: '6×6 — сложно (12–14 лет)', pieces: Array.from({ length: 35 }, (_, i) => (i < 34 ? String((i % 9) + 1) : '')) }
};

export function startPuzzleGame() {
  if (appState.gameActive) return;

  const picker = document.createElement('div');
  picker.className = 'game-overlay';
  picker.innerHTML = `
    <div style="text-align:center;max-width:320px;">
      <h2>🧩 Выбери уровень</h2>
      <div style="display:flex;flex-direction:column;gap:10px;margin:16px 0;">
        ${Object.entries(LEVELS).map(([size, lv]) =>
          `<button class="modal-btn" data-size="${size}">${lv.label}</button>`
        ).join('')}
        <button class="modal-btn secondary" data-size="close">✕ Закрыть</button>
      </div>
    </div>`;

  picker.querySelectorAll('[data-size]').forEach((btn) => {
    btn.onclick = () => {
      const size = btn.dataset.size;
      picker.remove();
      if (size === 'close') return;
      runPuzzle(parseInt(size, 10));
    };
  });
  document.body.appendChild(picker);
}

function runPuzzle(gridSize) {
  appState.gameActive = true;
  const correctOrder = LEVELS[gridSize]?.pieces || LEVELS[3].pieces;

  const container = document.createElement('div');
  container.className = 'game-overlay';

  const title = document.createElement('h2');
  title.textContent = `🧩 Пазл ${gridSize}×${gridSize}`;

  const board = document.createElement('div');
  board.className = 'puzzle-board';
  board.style.cssText = `display:grid;grid-template-columns:repeat(${gridSize},1fr);gap:6px;max-width:min(90vw,360px);margin:16px auto;`;

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
    pieces.forEach((piece) => {
      const cell = document.createElement('div');
      cell.style.cssText = `
        aspect-ratio: 1;
        background: ${piece ? '#4a4a6a' : '#2a2a4a'};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${gridSize >= 6 ? '1rem' : '1.5rem'};
        cursor: ${piece ? 'pointer' : 'default'};
      `;
      cell.textContent = piece;
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

  board.addEventListener('click', (e) => {
    const cell = e.target;
    if (!cell.parentElement || cell.parentElement !== board) return;
    const clickedIndex = Array.from(board.children).indexOf(cell);
    if (clickedIndex === -1 || !pieces[clickedIndex]) return;
    const emptyIndex = findEmptyIndex();
    if (emptyIndex === -1 || !canMove(clickedIndex, emptyIndex, gridSize)) return;
    [pieces[clickedIndex], pieces[emptyIndex]] = [pieces[emptyIndex], pieces[clickedIndex]];
    renderBoard();
    if (pieces.every((p, i) => p === correctOrder[i])) {
      updateAchievement('puzzle_solver');
      recordPuzzleWin(getActiveChildName());
      setAvatarState('happy');
      setTimeout(() => {
        setAvatarState(null);
        showModal('Победа!', '🎉 Ты собрал пазл! Молодец!');
        container.remove();
        appState.gameActive = false;
      }, 300);
    }
  });

  renderBoard();

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn secondary';
  closeBtn.textContent = 'Закрыть';
  closeBtn.onclick = () => {
    container.remove();
    appState.gameActive = false;
  };

  container.append(title, board, closeBtn);
  document.body.appendChild(container);
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
