import { appState, saveChildData } from '../core.js';
import { showModal } from '../ui.js';
import { updateAchievement } from '../achievements.js';
import { trackEvent } from '../analytics.js';

export function startMemoryGame() {
  if (appState.gameActive) return;
  
  appState.gameActive = true;
  
  const emojis = ['😊','😢','😨','😡','😴','😍','🥳','🤗'];
  appState.memoryCards = [...emojis, ...emojis]
    .sort(() => Math.random() - 0.5);
  appState.memoryFlipped = new Array(16).fill(false);
  appState.memoryMatches = 0;
  appState.memoryLocked = false;
  
  let attempts = 0;
  let firstCardIndex = null;
  let firstCardElement = null;
  
  const container = document.createElement('div');
  container.className = 'game-overlay';
  container.setAttribute('aria-label', 'Игра Мемори');
  
  const title = document.createElement('h2');
  title.textContent = '🧠 Найди пару';
  title.style.cssText = 'color:white;margin:10px 0;';
  
  const board = document.createElement('div');
  board.className = 'memory-board';
  board.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:360px;margin:16px auto;';
  
  const info = document.createElement('div');
  info.style.cssText = 'margin:15px 0;font-size:1.2rem;color:white;';
  info.textContent = 'Найдено пар: 0 / 8 | Попытки: 0';
  
  // Создаем карточки
  for (let i = 0; i < 16; i++) {
    const card = document.createElement('div');
    card.style.cssText = `
      aspect-ratio: 1;
      background: linear-gradient(135deg, #4a4a6a, #6c6caa);
      border-radius: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      cursor: pointer;
      transition: transform 0.3s, background 0.3s;
      transform-style: preserve-3d;
    `;
    card.textContent = '?';
    card.dataset.index = i;
    
    card.onclick = () => {
      if (appState.memoryLocked || 
          appState.memoryFlipped[i] || 
          firstCardIndex === i) return;
      
      // Переворачиваем карточку
      flipCard(card, i);
      
      if (firstCardIndex === null) {
        // Первая карточка
        firstCardIndex = i;
        firstCardElement = card;
      } else {
        // Вторая карточка
        attempts++;
        info.textContent = `Найдено пар: ${appState.memoryMatches} / 8 | Попытки: ${attempts}`;
        
        appState.memoryLocked = true;
        
        // Проверяем совпадение
        if (appState.memoryCards[firstCardIndex] === appState.memoryCards[i]) {
          // Нашли пару!
          appState.memoryMatches++;
          
          setTimeout(() => {
            card.style.animation = 'pulse 0.3s';
            firstCardElement.style.animation = 'pulse 0.3s';
            
            setTimeout(() => {
              card.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
              firstCardElement.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
              
              firstCardIndex = null;
              firstCardElement = null;
              appState.memoryLocked = false;
              
              info.textContent = `Найдено пар: ${appState.memoryMatches} / 8 | Попытки: ${attempts}`;
              
              // Проверка победы
              if (appState.memoryMatches === 8) {
                updateAchievement('memory_champion');
                trackEvent('memory_game_won', { attempts });
                
                setTimeout(() => {
                  showModal(
                    '🎉 Победа!', 
                    `Ты нашёл все пары за ${attempts} попыток! Отличная память!`
                  );
                  container.remove();
                  appState.gameActive = false;
                }, 500);
              }
            }, 300);
          }, 500);
        } else {
          // Не совпали
          setTimeout(() => {
            unflipCard(card, i);
            unflipCard(firstCardElement, firstCardIndex);
            
            firstCardIndex = null;
            firstCardElement = null;
            appState.memoryLocked = false;
          }, 1000);
        }
      }
    };
    
    card.addEventListener('mouseenter', () => {
      if (!appState.memoryLocked && !appState.memoryFlipped[parseInt(card.dataset.index)]) {
        card.style.transform = 'scale(1.05)';
        card.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
      }
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'scale(1)';
      card.style.boxShadow = 'none';
    });
    
    board.appendChild(card);
  }
  
  function flipCard(card, index) {
    appState.memoryFlipped[index] = true;
    card.textContent = appState.memoryCards[index];
    card.style.background = 'linear-gradient(135deg, #fff, #f0f0f0)';
    card.style.transform = 'scale(1.05)';
  }
  
  function unflipCard(card, index) {
    appState.memoryFlipped[index] = false;
    card.textContent = '?';
    card.style.background = 'linear-gradient(135deg, #4a4a6a, #6c6caa)';
    card.style.transform = 'scale(1)';
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
  closeBtn.onclick = () => {
    container.remove();
    appState.gameActive = false;
    appState.memoryLocked = false;
    saveChildData(appState.currentChildIndex);
    trackEvent('memory_game_exited', { matches: appState.memoryMatches, attempts });
  };
  
  container.appendChild(title);
  container.appendChild(board);
  container.appendChild(info);
  container.appendChild(closeBtn);
  document.body.appendChild(container);
  
  trackEvent('memory_game_started');
}
