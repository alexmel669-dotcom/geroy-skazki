import { CONFIG } from './config.js';
import { 
  appState, getCurrentChild, loadChildData, saveChildData, 
  saveHistory, updateFear, updateChildNameLabel, updateStatsUI 
} from './core.js';
import { askDeepSeek, detectFearLocally } from './ai.js';
import { speak, unlockAudio } from './audio.js';
import { sendAnalytics } from './analytics.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isProcessing = false;
let restartTimeout = null;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

// Инициализация распознавания речи
function initRecognition() {
  if (!SpeechRecognition) {
    console.warn('Speech Recognition API not available');
    return false;
  }
  
  try {
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    // Настройка для лучшего распознавания детской речи
    if ('webkitSpeechRecognition' in window) {
      recognition.interimResults = true; // Chrome лучше работает с промежуточными результатами
    }
    
    setupRecognitionHandlers();
    return true;
  } catch (error) {
    console.error('Failed to initialize speech recognition:', error);
    return false;
  }
}

// Настройка обработчиков
function setupRecognitionHandlers() {
  if (!recognition) return;
  
  recognition.onstart = () => {
    console.log('🎤 Начало прослушивания');
    consecutiveErrors = 0;
    updateMicButton(true);
    updateAvatarState('listening');
  };
  
  recognition.onresult = async (event) => {
    let text = '';
    
    // Собираем все результаты
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        text += event.results[i][0].transcript;
      }
    }
    
    text = text.trim();
    
    if (!text) {
      console.log('Empty speech result');
      return;
    }
    
    console.log('🗣️ Распознано:', text);
    
    // Останавливаем прослушивание и обрабатываем
    stopListening();
    await processUserInput(text);
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    consecutiveErrors++;
    
    switch (event.error) {
      case 'no-speech':
        // Ничего не сказали - просто останавливаем
        stopListening();
        break;
        
      case 'aborted':
        // Пользователь отменил
        stopListening();
        break;
        
      case 'audio-capture':
        speak('Не получается включить микрофон. Проверь настройки!');
        stopListening();
        break;
        
      case 'network':
        if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
          speak('Плохая связь. Давай попробуем ещё раз!');
        } else {
          speak('Микрофон временно недоступен. Попробуй позже или напиши!');
          disableMicrophone();
        }
        stopListening();
        break;
        
      case 'not-allowed':
        speak('Нужно разрешить доступ к микрофону в настройках браузера');
        disableMicrophone();
        stopListening();
        break;
        
      default:
        if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
          speak('Не расслышал, скажи ещё раз!');
          stopListening();
        } else {
          speak('Что-то пошло не так. Давай попробуем позже!');
          disableMicrophone();
          stopListening();
        }
    }
  };
  
  recognition.onend = () => {
    console.log('🎤 Прослушивание завершено');
    updateMicButton(false);
    updateAvatarState(null);
    
    // Автоматически перезапускаем если были ошибки
    if (consecutiveErrors > 0 && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
      restartTimeout = setTimeout(() => {
        startListening();
      }, 2000);
    }
  };
  
  recognition.onaudiostart = () => {
    console.log('🔊 Аудио захват начат');
  };
  
  recognition.onaudioend = () => {
    console.log('🔊 Аудио захват завершен');
  };
  
  recognition.onspeechstart = () => {
    console.log('🗣️ Речь обнаружена');
  };
  
  recognition.onspeechend = () => {
    console.log('🗣️ Речь завершена');
  };
}

// Обработка пользовательского ввода
async function processUserInput(text) {
  if (isProcessing) {
    console.log('Already processing');
    return;
  }
  
  isProcessing = true;
  
  try {
    // Разблокируем аудио
    unlockAudio();
    
    // Сохраняем сообщение
    saveHistory('user', text);
    
    // Проверка гостевого режима - поиск ребенка
    if (appState.currentChildIndex === CONFIG.GUEST_INDEX) {
      const child = findChildByName(text);
      if (child) {
        await switchToChild(child);
        isProcessing = false;
        return;
      }
    }
    
    // Локальное определение страхов
    const localFear = detectFearLocally(text);
    if (localFear) {
      updateFear(localFear);
    }
    
    // Обновляем статы
    updateStatsAfterInteraction();
    
    // Получаем ответ от ИИ
    const answer = await askDeepSeek(text, false);
    
    // Сохраняем и озвучиваем ответ
    saveHistory('assistant', answer);
    await speak(answer);
    
    // Отправляем аналитику
    sendAnalytics('voice_interaction', {
      text_length: text.length,
      has_fear: !!localFear,
      fear_type: localFear
    });
    
  } catch (error) {
    console.error('Error processing input:', error);
    await speak('Ой, что-то пошло не так. Давай ещё раз!');
  } finally {
    isProcessing = false;
  }
}

// Поиск ребенка по имени
function findChildByName(text) {
  const lowerText = text.toLowerCase();
  return appState.children.find(child => {
    const nameParts = child.name.toLowerCase().split(' ');
    return nameParts.some(part => lowerText.includes(part));
  });
}

// Переключение на ребенка
async function switchToChild(child) {
  const index = appState.children.indexOf(child);
  if (index === -1) return;
  
  // Сохраняем гостевые данные
  saveChildData(CONFIG.GUEST_INDEX);
  
  // Переключаемся
  appState.currentChildIndex = index;
  appState.childName = child.name;
  appState.childAge = child.age;
  
  localStorage.setItem('currentChildIndex', index.toString());
  loadChildData(index);
  updateChildNameLabel();
  updateStatsUI();
  
  const greeting = `${child.name}! Привет! Как у тебя дела?`;
  saveHistory('assistant', greeting);
  await speak(greeting);
  
  sendAnalytics('child_switched', {
    from: 'guest',
    to: child.name
  });
}

// Обновление статов после взаимодействия
function updateStatsAfterInteraction() {
  appState.mood = Math.min(100, appState.mood + 2);
  appState.energy = Math.max(0, appState.energy - 1);
  updateStatsUI();
  saveChildData(appState.currentChildIndex);
}

// Запуск прослушивания
function startListening() {
  if (isProcessing || appState.isListening || !recognition) {
    return;
  }
  
  // Очищаем таймаут перезапуска
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  
  try {
    appState.isListening = true;
    recognition.start();
    sendAnalytics('mic_started');
  } catch (error) {
    console.error('Failed to start recognition:', error);
    appState.isListening = false;
    
    if (error.name === 'InvalidStateError') {
      // Уже запущено
      stopListening();
      setTimeout(() => startListening(), 100);
    }
  }
}

// Остановка прослушивания
function stopListening() {
  appState.isListening = false;
  
  try {
    if (recognition) {
      recognition.stop();
    }
  } catch (error) {
    // Игнорируем ошибки остановки
    console.log('Stop recognition error:', error.message);
  }
  
  updateMicButton(false);
  updateAvatarState(null);
}

// Визуальное обновление кнопки микрофона
function updateMicButton(isActive) {
  const micBtn = document.getElementById('micBtn');
  if (!micBtn) return;
  
  if (isActive) {
    micBtn.classList.add('recording');
    micBtn.setAttribute('aria-label', 'Остановить запись');
  } else {
    micBtn.classList.remove('recording');
    micBtn.setAttribute('aria-label', 'Начать говорить');
  }
}

// Обновление состояния аватара
function updateAvatarState(state) {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  
  avatar.classList.remove('listening', 'talking', 'thinking');
  if (state) {
    avatar.classList.add(state);
  }
}

// Отключение микрофона при ошибках
function disableMicrophone() {
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.style.opacity = '0.5';
    micBtn.style.pointerEvents = 'none';
    micBtn.setAttribute('aria-label', 'Микрофон недоступен');
  }
  
  // Показываем сообщение через 5 секунд
  setTimeout(() => {
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.style.opacity = '1';
      micBtn.style.pointerEvents = 'auto';
    }
  }, 30000); // Восстанавливаем через 30 секунд
}

// Инициализация микрофона
export function initMic() {
  const micBtn = document.getElementById('micBtn');
  if (!micBtn) {
    console.warn('Microphone button not found');
    return;
  }
  
  // Инициализируем распознавание
  const isAvailable = initRecognition();
  
  if (!isAvailable) {
    micBtn.style.display = 'none';
    console.warn('Speech recognition not available, hiding mic button');
    return;
  }
  
  // Обработчик клика
  micBtn.onclick = () => {
    unlockAudio(); // Разблокируем аудио
    
    if (isProcessing) {
      console.log('Still processing previous request');
      return;
    }
    
    if (appState.isListening) {
      stopListening();
      sendAnalytics('mic_stopped_manual');
    } else {
      startListening();
    }
  };
  
  // Горячая клавиша для микрофона (пробел)
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.target.matches('input, textarea')) {
      event.preventDefault();
      micBtn.click();
    }
  });
  
  console.log('🎤 Микрофон инициализирован');
}

// Экспорт для отладки
if (typeof window !== 'undefined') {
  window.__mic = {
    startListening,
    stopListening,
    isProcessing: () => isProcessing,
    isListening: () => appState.isListening
  };
}
