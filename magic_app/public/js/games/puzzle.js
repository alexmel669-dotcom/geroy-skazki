import { appState } from '../core.js';
import { showModal } from '../ui.js';
import { updateAchievement } from '../achievements.js';

export function startPuzzleGame() {
  if (appState.gameActive) return;
  appState.gameActive = true;

  const container = document.createElement('div');
  container.className = 'game-overlay';

  const title = document.createElement('h2');
  title.textContent = '🧩 Собери пазл';

  const board = document.createElement('div');
  board.className = 'puzzle-board';
  board.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:300px;margin:16px auto;';

  const correctOrder = ['🌟', '🌈', '🦁', '🐱', '🎨', '🎮', '🧩', '🍎', ''];

  let pieces = [...correctOrder];
  do {
    pieces = [...correctOrder].sort(() => Math.random() - 0.5);
  } while (!isPuzzleSolvable(pieces) || JSON.stringify(pieces) === JSON.stringify(correctOrder));

  function renderBoard() {
    board.innerHTML = '';
    pieces.forEach((piece) => {
      const cell = document.createElement('div');
      cell.style.cssText = `
        aspect-ratio: 1;
        background: ${piece ? '#4a4a6a' : '#2a2a4a'};
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        cursor: ${piece ? 'pointer' : 'default'};
        transition: background 0.2s;
      `;
      cell.textContent = piece;
      board.appendChild(cell);
    });
  }

  function findEmptyIndex() {
    return pieces.findIndex(p => p === '');
  }

  function canMove(from, to) {
    const fromRow = Math.floor(from / 3);
    const fromCol = from % 3;
    const toRow = Math.floor(to / 3);
    const toCol = to % 3;
    return Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol) === 1;
  }

  function checkVictory() {
    return pieces.every((piece, i) => piece === correctOrder[i]);
  }

  board.addEventListener('click', (e) => {
    const cell = e.target;
    if (!cell.parentElement || cell.parentElement !== board) return;

    const clickedIndex = Array.from(board.children).indexOf(cell);
    if (clickedIndex === -1 || !pieces[clickedIndex]) return;

    const emptyIndex = findEmptyIndex();
    if (emptyIndex === -1 || !canMove(clickedIndex, emptyIndex)) return;

    [pieces[clickedIndex], pieces[emptyIndex]] = [pieces[emptyIndex], pieces[clickedIndex]];
    renderBoard();

    if (checkVictory()) {
      updateAchievement('puzzle_solver');
      setTimeout(() => {
        showModal('Победа!', '🎉 Ты собрал пазл! Молодец!');
        container.remove();
        appState.gameActive = false;
      }, 300);
    }
  });

  renderBoard();

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Закрыть';
  closeBtn.style.cssText = `
    padding: 10px 20px; border-radius: 30px; background: #ff4081;
    color: white; border: none; cursor: pointer; margin-top: 15px; font-size: 1rem;
  `;
  closeBtn.onclick = () => {
    container.remove();
    appState.gameActive = false;
  };

  container.appendChild(title);
  container.appendChild(board);
  container.appendChild(closeBtn);
  document.body.appendChild(container);
}

function isPuzzleSolvable(pieces) {
  const order = ['🌟', '🌈', '🦁', '🐱', '🎨', '🎮', '🧩', '🍎'];
  let inversions = 0;
  const flat = pieces.filter(p => p !== '');

  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (order.indexOf(flat[i]) > order.indexOf(flat[j])) inversions++;
    }
  }

  return inversions % 2 === 0;
}
