import { appState, getCurrentChild, loadChildData, saveChildData, updateStatsUI, updateChildNameLabel } from './core.js';
import { CHARACTERS } from './config.js';
import { createPin, verifyPin } from './security.js';
import { unlockAudio, speak } from './audio.js';
import { showModal, showPrompt, showGameMenu, showRoomMenu } from './ui.js';
import { initAchievements } from './achievements.js';
import { initMic } from './mic.js';
import { sendAnalytics } from './analytics.js';
import { checkAuth, logout } from './auth.js';

async function init() {
  try {
    const isAuth = await checkAuth();
    
    // Настройка кнопки выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && isAuth && localStorage.getItem('guestMode') !== 'true') {
      logoutBtn.style.display = 'flex';
      logoutBtn.onclick = logout;
    }
    
    // Загрузка данных
    loadChildData(appState.currentChildIndex);
    const curChild = getCurrentChild();
    appState.childName = curChild.name;
    appState.childAge = curChild.age;
    appState.currentChar = localStorage.getItem('currentCharacter') || 'lucik';
    
    const avatar = document.getElementById('avatar');
    if (avatar) {
      const char = CHARACTERS[appState.currentChar];
      if (char && char.icon) {
        avatar.style.backgroundImage = `url('${char.icon}')`;
      }
    }
    
    initAchievements();
    updateChildNameLabel();
    updateStatsUI();
    
    // Временная тема (день/ночь)
    function updateTimeTheme() {
      const hour = new Date().getHours();
      document.body.style.background = (hour >= 18 || hour < 6) 
        ? 'linear-gradient(180deg, #0a0a14, #12122a)' 
        : 'linear-gradient(180deg, #141420, #1d1d30)';
    }
    updateTimeTheme();
    setInterval(updateTimeTheme, 60000);
    
    // Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showModal(
                '🔄 Обновление', 
                'Доступна новая версия приложения. Обновить сейчас?',
                [
                  { 
                    text: 'Обновить', 
                    value: true,
                    handler: () => {
                      newWorker.postMessage('skipWaiting');
                      window.location.reload();
                    }
                  },
                  { text: 'Позже', value: false, secondary: true }
                ]
              );
            }
          });
        });
        
        console.log('Service Worker registered:', registration.scope);
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    }
    
    // Разблокировка аудио
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    
    // Обработчики кнопок
    document.getElementById('feedBtn').onclick = () => {
      appState.hunger = Math.min(100, appState.hunger + 15);
      appState.mood = Math.min(100, appState.mood + 5);
      updateStatsUI();
      saveChildData(appState.currentChildIndex);
      import('./core.js').then(({ saveHistory }) => {
        saveHistory('user', '🍎 Покормил');
      });
      sendAnalytics('feed');
    };
    
    document.getElementById('gamesBtn').onclick = () => showGameMenu();
    document.getElementById('roomBtn').onclick = () => showRoomMenu();
    
    // Родительский раздел
    document.getElementById('parentBtn').onclick = async () => {
      const savedPin = localStorage.getItem('parentPinHash');
      
      if (!savedPin) {
        const pin = await showPrompt(
          '🔒 Создайте пароль', 
          'Придумайте 4-6 цифр для доступа к родительскому разделу'
        );
        
        if (pin && pin.length >= 4 && /^\d+$/.test(pin)) {
          await createPin(pin);
          await showModal('✅ Готово', 'Пароль создан! Теперь вы можете войти в родительский кабинет.');
          window.location.href = '/parent.html';
        } else if (pin) {
          await showModal('❌ Ошибка', 'Пароль должен содержать только цифры (4-6 символов)');
        }
      } else {
        const pin = await showPrompt('🔒 Введите пароль', 'Введите пароль для входа в родительский раздел');
        
        if (pin === null) return;
        
        if (await verifyPin(pin)) {
          window.location.href = '/parent.html';
        } else {
          await showModal('❌ Ошибка', 'Неверный пароль! Попробуйте ещё раз.');
        }
      }
    };
    
    // Свайп между персонажами
    let touchStartX = 0;
    if (avatar) {
      avatar.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
      });
      avatar.addEventListener('touchend', (e) => {
        const diff = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(diff) > 50) {
          const chars = Object.keys(CHARACTERS);
          const currentIdx = chars.indexOf(appState.currentChar);
          const newIdx = diff > 0 
            ? (currentIdx - 1 + chars.length) % chars.length 
            : (currentIdx + 1) % chars.length;
          appState.currentChar = chars[newIdx];
          localStorage.setItem('currentCharacter', appState.currentChar);
          avatar.style.backgroundImage = `url('${CHARACTERS[appState.currentChar].icon}')`;
          updateChildNameLabel();
          console.log('👤 Переключились на:', CHARACTERS[appState.currentChar].name);
        }
      });
    }
    
    // Инициализация микрофона
    initMic();
    
    // Сохранение при уходе
    window.addEventListener('beforeunload', () => {
      saveChildData(appState.currentChildIndex);
      if (appState.gameInterval) clearInterval(appState.gameInterval);
      if (appState.gameTimerInterval) clearInterval(appState.gameTimerInterval);
    });
    
    // Отправка аналитики
    sendAnalytics('app_open');
    
    console.log('✅ Приложение инициализировано');
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
  }
}

// Запуск
init().catch(console.error);
