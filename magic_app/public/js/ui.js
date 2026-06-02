import { appState, saveChildData, saveHistory, updateStatsUI } from './core.js';
import { speak } from './audio.js';
import { sendAnalytics } from './analytics.js';
import { updateAchievement } from './achievements.js';
import { startFishGame } from './games/fish.js';
import { startMemoryGame } from './games/memory.js';
import { startPuzzleGame } from './games/puzzle.js';
import { startColoringGame } from './games/coloring.js';
import { startEmotionGame } from './games/emotion.js';

// Создание модального окна
export function showModal(title, message, buttons = [{ text: 'OK', value: true }]) {
  return new Promise((resolve) => {
    // Удаляем предыдущие модальные окна
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);
    
    const box = document.createElement('div');
    box.className = 'modal-box';
    
    // Заголовок
    const h2 = document.createElement('h2');
    h2.textContent = title;
    
    // Сообщение
    const p = document.createElement('p');
    p.textContent = message;
    
    // Кнопки
    const btnContainer = document.createElement('div');
    btnContainer.className = 'modal-buttons';
    
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = `modal-btn ${btn.secondary ? 'secondary' : ''}`;
      button.textContent = btn.text;
      button.setAttribute('role', 'button');
      
      button.onclick = () => {
        overlay.remove();
        resolve(btn.value);
      };
      
      btnContainer.appendChild(button);
    });
    
    box.appendChild(h2);
    box.appendChild(p);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    
    // Закрытие по клику вне окна
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });
    
    // Закрытие по Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        resolve(null);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    document.body.appendChild(overlay);
    
    // Фокус на первой кнопке
    setTimeout(() => {
      const firstButton = btnContainer.querySelector('button');
      if (firstButton) firstButton.focus();
    }, 100);
  });
}

// Запрос ввода (PIN, имя и т.д.)
export function showPrompt(title, message, type = 'password') {
  return new Promise((resolve) => {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    
    const box = document.createElement('div');
    box.className = 'modal-box';
    
    const h2 = document.createElement('h2');
    h2.textContent = title;
    
    const p = document.createElement('p');
    p.textContent = message;
    
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = type === 'password' ? '****' : 'Введите текст';
    input.setAttribute('aria-label', title);
    
    const btnContainer = document.createElement('div');
    btnContainer.className = 'modal-buttons';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn secondary';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.onclick = () => {
      overlay.remove();
      resolve(null);
    };
    
    const okBtn = document.createElement('button');
    okBtn.className = 'modal-btn';
    okBtn.textContent = 'OK';
    okBtn.onclick = () => {
      const value = input.value.trim();
      overlay.remove();
      resolve(value || null);
    };
    
    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(okBtn);
    
    box.appendChild(h2);
    box.appendChild(p);
    box.appendChild(input);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    
    // Обработка Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        okBtn.click();
      }
    });
    
    // Закрытие по Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        resolve(null);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    document.body.appendChild(overlay);
    input.focus();
  });
}

// Тост с достижением
export function showAchievementToast(name) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.setAttribute('role', 'alert');
  toast.textContent = '🏆 ' + name;
  
  // Удаляем старые тосты
  const existing = document.querySelector('.achievement-toast');
  if (existing) existing.remove();
  
  document.body.appendChild(toast);
  
  // Анимация появления
  toast.style.animation = 'slideDown 0.3s ease-out';
  
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Меню выбора игры
export function showGameMenu() {
  sendAnalytics('game_menu_opened');
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Выбор игры');
  
  const box = document.createElement('div');
  box.className = 'modal-box';
  box.style.maxWidth = '400px';
  
  const h2 = document.createElement('h2');
  h2.textContent = '🎮 Выбери игру';
  
  const gamesContainer = document.createElement('div');
  gamesContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:15px 0;';
  
  const games = [
    { 
      text: '🐟 Рыбалка', 
      color: '#4aa3df',
      description: 'Лови рыбок!',
      fn: () => { 
        overlay.remove(); 
        startFishGame(1); 
        sendAnalytics('game_started', { game: 'fish' });
      } 
    },
    { 
      text: '🧠 Мемори', 
      color: '#9b59b6',
      description: 'Найди пару',
      fn: () => { 
        overlay.remove(); 
        startMemoryGame(); 
        sendAnalytics('game_started', { game: 'memory' });
      } 
    },
    { 
      text: '🧩 Пазл', 
      color: '#e67e22',
      description: 'Собери картинку',
      fn: () => { 
        overlay.remove(); 
        startPuzzleGame(); 
        sendAnalytics('game_started', { game: 'puzzle' });
      } 
    },
    { 
      text: '🎨 Раскраска', 
      color: '#2ecc71',
      description: 'Раскрась Люцика',
      fn: () => { 
        overlay.remove(); 
        startColoringGame(); 
        sendAnalytics('game_started', { game: 'coloring' });
      } 
    },
    { 
      text: '😊 Эмоции', 
      color: '#f1c40f',
      description: 'Угадай эмоцию',
      fn: () => { 
        overlay.remove(); 
        startEmotionGame(); 
        sendAnalytics('game_started', { game: 'emotion' });
      } 
    }
  ];
  
  games.forEach(game => {
    const btn = document.createElement('button');
    btn.textContent = game.text;
    btn.title = game.description;
    btn.style.cssText = `
      padding: 15px 25px;
      border-radius: 20px;
      background: ${game.color};
      color: white;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      min-width: 140px;
    `;
    
    btn.onmouseenter = () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = `0 8px 25px ${game.color}80`;
    };
    
    btn.onmouseleave = () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    };
    
    btn.onclick = game.fn;
    gamesContainer.appendChild(btn);
  });
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn secondary';
  closeBtn.textContent = 'Закрыть';
  closeBtn.style.marginTop = '15px';
  closeBtn.onclick = () => overlay.remove();
  
  box.appendChild(h2);
  box.appendChild(gamesContainer);
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  document.body.appendChild(overlay);
}

// Меню комнаты
export function showRoomMenu() {
  sendAnalytics('room_opened');
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const box = document.createElement('div');
  box.className = 'modal-box';
  
  const h2 = document.createElement('h2');
  h2.textContent = '🏠 Моя комната';
  
  const status = document.createElement('p');
  status.style.cssText = 'margin:10px 0;opacity:0.8;';
  status.textContent = getRoomStatus();
  
  const actionsContainer = document.createElement('div');
  actionsContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:15px 0;';
  
  const actions = [
    {
      text: '🧸 Уборка',
      color: '#4CAF50',
      fn: () => {
        overlay.remove();
        doRoomAction('clean');
      }
    },
    {
      text: '📚 Почитать',
      color: '#2196F3',
      fn: () => {
        overlay.remove();
        doRoomAction('read');
      }
    },
    {
      text: '😴 Спать',
      color: '#9C27B0',
      fn: () => {
        overlay.remove();
        doRoomAction('sleep');
      }
    }
  ];
  
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.textContent = action.text;
    btn.style.cssText = `
      padding: 12px 20px;
      border-radius: 20px;
      background: ${action.color};
      color: white;
      border: none;
      font-size: 1rem;
      cursor: pointer;
      transition: transform 0.2s;
      min-width: 130px;
    `;
    btn.onmouseenter = () => btn.style.transform = 'scale(1.05)';
    btn.onmouseleave = () => btn.style.transform = 'scale(1)';
    btn.onclick = action.fn;
    actionsContainer.appendChild(btn);
  });
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn secondary';
  closeBtn.textContent = 'Закрыть';
  closeBtn.onclick = () => overlay.remove();
  
  box.appendChild(h2);
  box.appendChild(status);
  box.appendChild(actionsContainer);
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  document.body.appendChild(overlay);
}

// Получение статуса комнаты
function getRoomStatus() {
  const { mood, hunger, energy, bravery } = appState;
  
  if (energy < 20) return 'Люцик очень устал... 😴';
  if (hunger < 30) return 'Люцик хочет кушать! 🍎';
  if (mood < 30) return 'Люцику грустно... 😢';
  if (bravery > 80) return 'Люцик очень смелый! 🦁';
  
  return 'В комнате уютно и чисто ✨';
}

// Действия в комнате
function doRoomAction(action) {
  switch (action) {
    case 'clean':
      appState.energy = Math.min(100, appState.energy + 10);
      appState.mood = Math.min(100, appState.mood + 5);
      updateStatsUI();
      saveHistory('assistant', 'Мурр! Как чисто стало! ✨');
      saveChildData(appState.currentChildIndex);
      speak('Мурр! Как чисто стало!');
      sendAnalytics('room_action', { action: 'clean' });
      break;
      
    case 'read':
      appState.mood = Math.min(100, appState.mood + 15);
      appState.energy = Math.max(0, appState.energy - 5);
      appState.storyCount++;
      updateStatsUI();
      saveHistory('assistant', 'Отличная сказка! 📚');
      saveChildData(appState.currentChildIndex);
      speak('Как интересно! Давай почитаем ещё!');
      sendAnalytics('room_action', { action: 'read' });
      updateAchievement('story_lover', 1);
      break;
      
    case 'sleep':
      appState.energy = 100;
      appState.mood = Math.min(100, appState.mood + 10);
      updateStatsUI();
      saveHistory('assistant', 'Сладких снов... 😴');
      saveChildData(appState.currentChildIndex);
      speak('Сладких снов! Увидимся утром!');
      sendAnalytics('room_action', { action: 'sleep' });
      
      // Темная тема для сна
      document.body.style.background = 'linear-gradient(180deg, #0a0a14, #12122a)';
      break;
  }
}

// Показ прогресса достижений
export function showAchievements() {
  const key = `achievements_${appState.currentChildIndex}`;
  const achievements = JSON.parse(localStorage.getItem(key) || '{}');
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const box = document.createElement('div');
  box.className = 'modal-box';
  box.style.maxWidth = '400px';
  
  const h2 = document.createElement('h2');
  h2.textContent = '🏆 Достижения';
  
  const list = document.createElement('div');
  list.style.cssText = 'max-height: 400px;overflow-y: auto;text-align: left;';
  
  Object.entries(achievements).forEach(([id, achievement]) => {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 10px;
      margin: 5px 0;
      border-radius: 10px;
      background: ${achievement.earned ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.05)'};
      opacity: ${achievement.earned ? '1' : '0.5'};
    `;
    item.textContent = `${achievement.earned ? '✅' : '🔒'} ${achievement.name}`;
    if (achievement.progress !== undefined) {
      item.textContent += ` (${achievement.progress}/${achievement.target})`;
    }
    list.appendChild(item);
  });
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn';
  closeBtn.textContent = 'Закрыть';
  closeBtn.onclick = () => overlay.remove();
  
  box.appendChild(h2);
  box.appendChild(list);
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  document.body.appendChild(overlay);
}
