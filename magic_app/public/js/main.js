import { CONFIG, CHARACTERS, FALLBACK_REPLIES, validateConfig } from './config.js';
import { generateResponse, detectFear, detectAlertWords, detectPersonalData, setCharacter, getCharacter, addToContext, getContext, clearContext } from './ai.js';
import { startRecording, stopRecording, playAudioFromUrl, isRecording, getAudioBlob } from './mic.js';
import { synthesizeSpeech } from './audio.js';
import { checkAchievements } from './achievements.js';
import { trackEvent } from './analytics.js';
import { initSecurity } from './security.js';

// --- СОСТОЯНИЕ ---
let activeChildIndex = -1; // -1 = гость
let isProcessing = false;

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
  validateConfig();
  initSecurity();
  initUI();
  loadState();
  checkChildSelection();
  updateStatsDisplay();
  initEventListeners();
  
  console.log(`🟢 Герой Сказок v${CONFIG.APP_VERSION} запущен`);
  console.log(`👶 Активный ребёнок: ${getActiveChildName()}`);
  console.log(`🎭 Персонаж: ${getCharacter()}`);
});

// --- ДЕТИ ---
function getChildren() {
  return JSON.parse(localStorage.getItem('children') || '[]');
}

function getActiveChildIndex() {
  const saved = localStorage.getItem('activeChildIndex');
  if (saved !== null) return parseInt(saved);
  return -1;
}

function getActiveChildName() {
  const children = getChildren();
  const child = children[activeChildIndex];
  return child ? child.name : 'Гость';
}

function setActiveChild(index) {
  activeChildIndex = index;
  localStorage.setItem('activeChildIndex', index);
  
  const children = getChildren();
  const child = children[index];
  
  const nameLabel = document.getElementById('childNameLabel');
  const avatar = document.getElementById('avatar');
  
  if (child) {
    if (nameLabel) nameLabel.textContent = `${child.name}, ${child.age} лет`;
    if (avatar) {
      const avatarMap = {
        'kid1': 'assets/images/kid1.png',
        'kid2': 'assets/images/kid2.png',
        'lucik': 'assets/images/avatar.png'
      };
      avatar.style.backgroundImage = `url('${avatarMap[child.avatarRole] || 'assets/images/avatar.png'}')`;
    }
  } else {
    if (nameLabel) nameLabel.textContent = 'Гость';
    if (avatar) avatar.style.backgroundImage = "url('assets/images/avatar.png')";
  }
}

function showChildSelectModal() {
  const children = getChildren();
  if (children.length <= 1) {
    if (children.length === 1) setActiveChild(0);
    return;
  }
  
  const modal = document.getElementById('childSelectModal');
  const list = document.getElementById('childSelectList');
  if (!modal || !list) return;
  
  list.innerHTML = children.map((child, i) => {
    const emoji = child.avatarRole === 'kid1' ? '👧' : (child.avatarRole === 'kid2' ? '👦' : '🐱');
    return `
      <button class="modal-btn" style="width:100%; text-align:left; display:flex; align-items:center; gap:12px;" id="childSelect${i}">
        <span style="font-size:1.5rem;">${emoji}</span>
        <span>${child.name}, ${child.age} лет</span>
      </button>
    `;
  }).join('');
  
  modal.style.display = 'flex';
  
  // Навешиваем обработчики
  children.forEach((child, i) => {
    const btn = document.getElementById(`childSelect${i}`);
    if (btn) {
      btn.addEventListener('click', () => {
        modal.style.display = 'none';
        setActiveChild(i);
      });
    }
  });
}

function checkChildSelection() {
  activeChildIndex = getActiveChildIndex();
  const children = getChildren();
  
  if (children.length > 1 && activeChildIndex === -1) {
    showChildSelectModal();
  } else if (children.length === 1 && activeChildIndex === -1) {
    setActiveChild(0);
  } else if (activeChildIndex >= children.length) {
    setActiveChild(-1);
  } else if (activeChildIndex >= 0) {
    setActiveChild(activeChildIndex);
  }
}

// Обработчик для кнопки "Продолжить как гость" в модальном окне
window.selectGuestMode = function() {
  document.getElementById('childSelectModal').style.display = 'none';
  setActiveChild(-1);
};

// --- ИСТОРИЯ И СТАТИСТИКА ---
function saveToChildHistory(entry) {
  const children = getChildren();
  const child = children[activeChildIndex];
  const key = child ? `stats_${child.name}` : 'stats_guest';
  
  let stats = JSON.parse(localStorage.getItem(key) || 'null');
  if (!stats) {
    stats = {
      totalStories: 0,
      totalGames: 0,
      history: [],
      fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
      lastActive: new Date().toISOString()
    };
  }
  
  stats.history.push(entry);
  if (stats.history.length > CONFIG.MAX_HISTORY) {
    stats.history = stats.history.slice(-CONFIG.MAX_HISTORY);
  }
  stats.lastActive = new Date().toISOString();
  
  localStorage.setItem(key, JSON.stringify(stats));
  
  // Дублируем в глобальный history для совместимости
  const globalHistory = JSON.parse(localStorage.getItem('history') || '[]');
  globalHistory.push(entry);
  if (globalHistory.length > CONFIG.MAX_HISTORY) {
    localStorage.setItem('history', JSON.stringify(globalHistory.slice(-CONFIG.MAX_HISTORY)));
  } else {
    localStorage.setItem('history', JSON.stringify(globalHistory));
  }
}

function updateFearStats(fears) {
  if (!fears || fears.length === 0) return;
  
  const children = getChildren();
  const child = children[activeChildIndex];
  const key = child ? `stats_${child.name}` : 'stats_guest';
  
  let stats = JSON.parse(localStorage.getItem(key) || 'null');
  if (!stats) {
    stats = {
      totalStories: 0,
      totalGames: 0,
      history: [],
      fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
      lastActive: new Date().toISOString()
    };
  }
  
  fears.forEach(fear => {
    if (stats.fearStats[fear] !== undefined) {
      stats.fearStats[fear]++;
    }
  });
  
  localStorage.setItem(key, JSON.stringify(stats));
  
  // Обновляем глобальные для совместимости
  const globalFears = JSON.parse(localStorage.getItem('fearStats') || '{}');
  fears.forEach(fear => {
    globalFears[fear] = (globalFears[fear] || 0) + 1;
  });
  localStorage.setItem('fearStats', JSON.stringify(globalFears));
}

function incrementStories() {
  const children = getChildren();
  const child = children[activeChildIndex];
  const key = child ? `stats_${child.name}` : 'stats_guest';
  
  let stats = JSON.parse(localStorage.getItem(key) || 'null');
  if (!stats) {
    stats = { totalStories: 0, totalGames: 0, history: [], fearStats: {...CONFIG.DEFAULT_FEAR_STATS}, lastActive: new Date().toISOString() };
  }
  stats.totalStories = (stats.totalStories || 0) + 1;
  localStorage.setItem(key, JSON.stringify(stats));
  
  const globalTotal = parseInt(localStorage.getItem('totalStories') || '0') + 1;
  localStorage.setItem('totalStories', globalTotal);
}

function incrementGames() {
  const children = getChildren();
  const child = children[activeChildIndex];
  const key = child ? `stats_${child.name}` : 'stats_guest';
  
  let stats = JSON.parse(localStorage.getItem(key) || 'null');
  if (!stats) {
    stats = { totalStories: 0, totalGames: 0, history: [], fearStats: {...CONFIG.DEFAULT_FEAR_STATS}, lastActive: new Date().toISOString() };
  }
  stats.totalGames = (stats.totalGames || 0) + 1;
  localStorage.setItem(key, JSON.stringify(stats));
  
  const globalTotal = parseInt(localStorage.getItem('totalGames') || '0') + 1;
  localStorage.setItem('totalGames', globalTotal);
}

// --- UI ---
function initUI() {
  // Аватар
  const avatar = document.getElementById('avatar');
  if (avatar) {
    avatar.addEventListener('click', cycleCharacter);
  }
  
  // Кнопка родительского кабинета
  const parentBtn = document.getElementById('parentBtn');
  if (parentBtn) {
    parentBtn.addEventListener('click', () => {
      window.location.href = '/parent.html';
    });
  }
  
  // Кнопка выхода
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    const token = localStorage.getItem('userToken');
    if (token) logoutBtn.style.display = 'flex';
    logoutBtn.addEventListener('click', logout);
  }
}

function initEventListeners() {
  // Микрофон
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.addEventListener('click', handleMicClick);
  }
  
  // Кормление
  const feedBtn = document.getElementById('feedBtn');
  if (feedBtn) {
    feedBtn.addEventListener('click', () => {
      animateStat('hungerFill', 100);
      trackEvent('feed', getActiveChildName());
    });
  }
  
  // Игры
  const gamesBtn = document.getElementById('gamesBtn');
  if (gamesBtn) {
    gamesBtn.addEventListener('click', () => {
      incrementGames();
      updateStatsDisplay();
      launchFishGame();
    });
  }
  
  // Комната (уборка)
  const roomBtn = document.getElementById('roomBtn');
  if (roomBtn) {
    roomBtn.addEventListener('click', () => {
      animateStat('energyFill', 100);
      trackEvent('clean', getActiveChildName());
    });
  }
  
  // Свайп для смены персонажа
  const avatarSection = document.querySelector('.avatar-section');
  if (avatarSection) {
    let touchStartX = 0;
    avatarSection.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    });
    avatarSection.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 50) {
        cycleCharacter(diff > 0 ? -1 : 1);
      }
    });
  }
}

function loadState() {
  // Загружаем персонажа
  const savedChar = localStorage.getItem('currentCharacter') || 'lucik';
  setCharacter(savedChar);
  
  // Загружаем аватар
  const avatar = document.getElementById('avatar');
  if (avatar) {
    const char = CHARACTERS[savedChar] || CHARACTERS['lucik'];
    avatar.style.backgroundImage = `url('${char.icon}')`;
  }
}

function updateStatsDisplay() {
  const children = getChildren();
  const child = children[activeChildIndex];
  const key = child ? `stats_${child.name}` : 'stats_guest';
  const stats = JSON.parse(localStorage.getItem(key) || 'null');
  
  if (stats) {
    document.getElementById('moodFill').style.width = '70%';
    document.getElementById('hungerFill').style.width = '60%';
    document.getElementById('energyFill').style.width = '50%';
    
    const bravery = Math.min(100, (stats.totalStories || 0) * 10);
    document.getElementById('braveryFill').style.width = bravery + '%';
  }
}

function animateStat(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const current = parseInt(el.style.width) || 0;
  const diff = target - current;
  const steps = 20;
  let step = 0;
  
  const interval = setInterval(() => {
    step++;
    const progress = current + (diff * step / steps);
    el.style.width = Math.min(100, progress) + '%';
    
    if (step >= steps) {
      clearInterval(interval);
      setTimeout(() => {
        el.style.width = current + '%';
      }, 2000);
    }
  }, 50);
}

let characterCycleIndex = 0;
const characterIds = Object.keys(CHARACTERS);

function cycleCharacter(direction = 1) {
  characterCycleIndex = (characterCycleIndex + direction + characterIds.length) % characterIds.length;
  const charId = characterIds[characterCycleIndex];
  
  setCharacter(charId);
  localStorage.setItem('currentCharacter', charId);
  
  const avatar = document.getElementById('avatar');
  if (avatar) {
    const char = CHARACTERS[charId];
    avatar.style.backgroundImage = `url('${char.icon}')`;
    
    // Анимация смены
    avatar.style.transform = 'scale(0.9)';
    setTimeout(() => { avatar.style.transform = 'scale(1)'; }, 150);
  }
  
  trackEvent('character_change', charId);
}

// --- ГОЛОСОВОЕ ОБЩЕНИЕ ---
async function handleMicClick() {
  if (isProcessing) return;
  
  const micBtn = document.getElementById('micBtn');
  
  if (isRecording()) {
    // Останавливаем запись
    micBtn.classList.remove('recording');
    isProcessing = true;
    
    try {
      const audioBlob = await stopRecording();
      if (audioBlob) {
        await processAudio(audioBlob);
      }
    } catch (err) {
      console.error('❌ Recording error:', err);
    } finally {
      isProcessing = false;
      micBtn.textContent = '🎤';
    }
  } else {
    // Начинаем запись
    try {
      await startRecording();
      micBtn.classList.add('recording');
      micBtn.textContent = '⏺️';
    } catch (err) {
      console.error('❌ Mic access error:', err);
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
  }
}

async function processAudio(audioBlob) {
  const avatar = document.getElementById('avatar');
  
  try {
    // Показываем, что слушаем
    if (avatar) avatar.classList.add('listening');
    
    // Распознавание речи через Яндекс SpeechKit
    const recognizedText = await recognizeSpeech(audioBlob);
    
    if (avatar) avatar.classList.remove('listening');
    
    if (!recognizedText || recognizedText.trim().length === 0) {
      console.log('🗣️ Текст не распознан');
      return;
    }
    
    console.log('👶 Ребёнок:', recognizedText);
    
    // Сохраняем в историю
    const childEntry = {
      role: 'child',
      text: recognizedText,
      timestamp: Date.now(),
      childName: getActiveChildName()
    };
    saveToChildHistory(childEntry);
    addToContext('child', recognizedText);
    
    // Проверяем на страхи
    const fears = detectFear(recognizedText);
    if (fears.length > 0) {
      updateFearStats(fears);
      trackEvent('fear_detected', fears.join(','));
    }
    
    // Проверяем на тревожные слова
    const alertWords = detectAlertWords(recognizedText);
    if (alertWords.length > 0) {
      console.warn('⚠️ Тревожные слова:', alertWords);
      trackEvent('alert_words', alertWords.join(','));
    }
    
    // Аватар "говорит"
    if (avatar) avatar.classList.add('talking');
    
    // Генерируем ответ
    const reply = await generateResponse(recognizedText);
    
    console.log('🐱 Ответ:', reply);
    
    // Сохраняем ответ в историю
    const botEntry = {
      role: 'bot',
      text: reply,
      timestamp: Date.now(),
      characterName: CHARACTERS[getCharacter()]?.name || 'Люцик'
    };
    saveToChildHistory(botEntry);
    addToContext('bot', reply);
    
    // Проверяем ответ ИИ на сомнительное содержание
    const botAlertWords = detectAlertWords(reply);
    const botPersonalData = detectPersonalData(reply);
    if (botAlertWords.length > 0 || botPersonalData.length > 0) {
      console.warn('⚠️ Сомнительный ответ ИИ:', reply.substring(0, 100));
      botEntry.alerted = true;
      botEntry.alertWords = [...botAlertWords, ...botPersonalData];
      // Обновляем запись в истории
      const children = getChildren();
      const child = children[activeChildIndex];
      const key = child ? `stats_${child.name}` : 'stats_guest';
      const stats = JSON.parse(localStorage.getItem(key) || '{}');
      if (stats.history && stats.history.length > 0) {
        stats.history[stats.history.length - 1] = botEntry;
        localStorage.setItem(key, JSON.stringify(stats));
      }
    }
    
    // Озвучиваем ответ
    await synthesizeSpeech(reply, getCharacter());
    
    // Увеличиваем счётчик сказок (если ответ длинный — считаем за сказку)
    if (reply.length > 200) {
      incrementStories();
    }
    
    updateStatsDisplay();
    checkAchievements();
    
  } catch (err) {
    console.error('❌ Process audio error:', err);
    
    // Fallback ответ
    const char = CHARACTERS[getCharacter()] || CHARACTERS['lucik'];
    const fallback = FALLBACK_REPLIES[getCharacter()] || FALLBACK_REPLIES['lucik'];
    await synthesizeSpeech(fallback, getCharacter());
  } finally {
    if (avatar) {
      avatar.classList.remove('talking');
      avatar.classList.remove('listening');
    }
  }
}

async function recognizeSpeech(audioBlob) {
  // Используем серверный API для распознавания
  try {
    const base64 = await blobToBase64(audioBlob);
    
    const response = await fetch('/api/speech-to-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64 })
    });
    
    if (!response.ok) {
      throw new Error(`STT API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.text || '';
    
  } catch (err) {
    console.error('❌ Speech recognition error:', err);
    // Fallback: используем браузерное распознавание
    return await browserSpeechRecognition(audioBlob);
  }
}

async function browserSpeechRecognition(audioBlob) {
  return new Promise((resolve) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('⚠️ SpeechRecognition не поддерживается');
      resolve('');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event) => {
      resolve(event.results[0]?.[0]?.transcript || '');
    };
    
    recognition.onerror = () => {
      resolve('');
    };
    
    recognition.start();
    
    // Таймаут
    setTimeout(() => {
      recognition.stop();
      resolve('');
    }, CONFIG.AUDIO_TIMEOUT);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- ИГРЫ ---
function launchFishGame() {
  const overlay = document.createElement('div');
  overlay.className = 'game-overlay';
  overlay.innerHTML = `
    <div style="text-align:center;">
      <h2 style="margin:0 0 16px;">🎣 Поймай рыбку!</h2>
      <p style="margin:0 0 10px;font-size:0.9rem;opacity:0.7;">Лови рыбок, пока идёт время!</p>
      <div id="fishGameArea" style="width:300px;height:400px;background:rgba(0,50,100,0.5);border-radius:20px;position:relative;overflow:hidden;margin:0 auto;cursor:pointer;"></div>
      <p style="margin-top:12px;font-size:1.2rem;">🐟 Счёт: <span id="fishScore">0</span></p>
      <p style="font-size:0.9rem;">⏱️ <span id="fishTimer">30</span> сек</p>
      <button id="fishCloseBtn" style="margin-top:10px;padding:10px 24px;border-radius:20px;border:none;background:var(--accent);color:#fff;font-size:0.9rem;cursor:pointer;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  let score = 0;
  let timeLeft = 30;
  const gameArea = document.getElementById('fishGameArea');
  const scoreDisplay = document.getElementById('fishScore');
  const timerDisplay = document.getElementById('fishTimer');
  
  // Таймер
  const timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      clearInterval(fishInterval);
      alert(`🎉 Игра окончена! Ты поймал ${score} рыбок!`);
    }
  }, 1000);
  
  // Создание рыбок
  function createFish() {
    const fish = document.createElement('div');
    fish.textContent = '🐟';
    fish.style.cssText = `
      position:absolute;
      font-size:${24 + Math.random() * 20}px;
      left:${Math.random() * 260}px;
      top:${Math.random() * 360}px;
      transition: top 0.8s ease-in, left 0.8s ease-in;
      cursor:pointer;
      z-index:10;
    `;
    
    fish.addEventListener('click', (e) => {
      e.stopPropagation();
      score++;
      scoreDisplay.textContent = score;
      fish.remove();
      createFish();
    });
    
    gameArea.appendChild(fish);
    
    // Движение рыбки
    const moveInterval = setInterval(() => {
      fish.style.left = Math.random() * 260 + 'px';
      fish.style.top = Math.random() * 360 + 'px';
    }, 1500);
    
    // Автоудаление
    setTimeout(() => {
      clearInterval(moveInterval);
      fish.remove();
    }, 8000);
  }
  
  // Создаём несколько рыбок
  for (let i = 0; i < 3; i++) {
    createFish();
  }
  
  const fishInterval = setInterval(createFish, 2000);
  
  // Кнопка закрытия
  document.getElementById('fishCloseBtn').addEventListener('click', () => {
    clearInterval(timerInterval);
    clearInterval(fishInterval);
    overlay.remove();
    updateStatsDisplay();
  });
  
  trackEvent('game_fish_start', getActiveChildName());
}

// --- ВЫХОД ---
function logout() {
  localStorage.removeItem('userToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('activeChildIndex');
  window.location.href = '/login.html';
}

// --- ГЛОБАЛЬНЫЕ ФУНКЦИИ ---
window.showChildSelectModal = showChildSelectModal;
window.selectGuestMode = function() {
  const modal = document.getElementById('childSelectModal');
  if (modal) modal.style.display = 'none';
  setActiveChild(-1);
};
