import { showModal } from '../ui.js';
import { updateAchievement } from '../achievements.js';

export function startPuzzleGame() {
  const container = document.createElement('div');
  container.className = 'game-overlay';
  
  const title = document.createElement('h2');
  title.textContent = '🧩 Собери пазл';
  
  const board = document.createElement('div');
  board.className = 'puzzle-board';
  
  // Правильный порядок пазла
  const correctOrder = ['🌟','🌈','🦁','🐱','🎨','🎮','🧩','🍎', ''];
  
  // Перемешиваем пазл (гарантируя решаемость)
  let pieces = [...correctOrder];
  do {
    pieces = [...correctOrder].sort(() => Math.random() - 0.5);
  } while (!isPuzzleSolvable(pieces) || JSON.stringify(pieces) === JSON.stringify(correctOrder));
  
  // Создаем ячейки
  pieces.forEach((piece, index) => {
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
    
    if (piece) {
      cell.onclick = () => {
        const emptyIndex = findEmptyCell();
        const clickedIndex = index;
        
        if (canMove(clickedIndex, emptyIndex)) {
          // Меняем местами
          const emptyCell = board.children[emptyIndex];
          emptyCell.textContent = piece;
          emptyCell.style.background = '#4a4a6a';
          emptyCell.style.cursor = 'pointer';
          
          cell.textContent = '';
          cell.style.background = '#2a2a4a';
          cell.style.cursor = 'default';
          
          // Перемещаем в массиве
          [pieces[clickedIndex], pieces[emptyIndex]] = [pieces[emptyIndex], pieces[clickedIndex]];
          
          // Проверяем победу
          if (checkVictory()) {
            updateAchievement('puzzle_solver');
            setTimeout(() => {
              showModal('Победа!', '🎉 Ты собрал пазл! Молодец!');
              container.remove();
            }, 500);
          }
        }
      };
    }
    
    board.appendChild(cell);
  });
  
  function findEmptyCell() {
    return Array.from(board.children).findIndex(cell => cell.textContent === '');
  }
  
  function canMove(from, to) {
    const fromRow = Math.floor(from / 3);
    const fromCol = from % 3;
    const toRow = Math.floor(to / 3);
    const toCol = to % 3;
    
    // Можно двигать только соседние клетки (манхеттенское расстояние = 1)
    return Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol) === 1;
  }
  
  function checkVictory() {
    return Array.from(board.children).every((cell, i) => 
      cell.textContent === correctOrder[i]
    );
  }
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Закрыть';
  closeBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 30px;
    background: #ff4081;
    color: white;
    border: none;
    cursor: pointer;
    margin-top: 15px;
    font-size: 1rem;
  `;
  closeBtn.onclick = () => container.remove();
  
  container.appendChild(title);
  container.appendChild(board);
  container.appendChild(closeBtn);
  document.body.appendChild(container);
}

// Проверка, можно ли решить пазл
function isPuzzleSolvable(pieces) {
  let inversions = 0;
  const flat = pieces.filter(p => p !== '');
  
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i] > flat[j]) inversions++;
    }
  }
  
  return inversions % 2 === 0;
}
