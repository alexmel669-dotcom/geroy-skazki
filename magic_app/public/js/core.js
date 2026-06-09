// ========================================
// core.js — ЯДРО ПРИЛОЖЕНИЯ «ГЕРОЙ СКАЗОК»
// Версия: 4.0.2
// ========================================

import { CONFIG, CHARACTERS, validateConfig } from './config.js';
import { 
  generateResponse, 
  detectFear, 
  detectAlertWords, 
  detectPersonalData, 
  setCharacter, 
  getCharacter, 
  addToContext, 
  getContext, 
  clearContext 
} from './ai.js';
import { startRecording, stopRecording, playAudioFromUrl, isRecording } from './mic.js';
import { synthesizeSpeech } from './audio.js';
import { checkAchievements, showAchievement } from './achievements.js';
import { trackEvent, logError } from './analytics.js';
import { initSecurity, checkBadWords, sanitizeInput } from './security.js';

// ========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ========================================
let activeChildIndex = -1; // -1 = гость
let isProcessing = false;
let characterCycleIndex = 0;
const characterIds = Object.keys(CHARACTERS);

// Экспортируемый объект состояния для совместимости с другими модулями
export const appState = {
  get activeChildIndex() { return activeChildIndex; },
  set activeChildIndex(val) { activeChildIndex = val; },
  get isProcessing() { return isProcessing; },
  set isProcessing(val) { isProcessing = val; },
  get characterCycleIndex() { return characterCycleIndex; },
  set characterCycleIndex(val) { characterCycleIndex = val; },
  characterIds
};

// Синонимы для совместимости со старыми модулями
export const getCurrentChild = getActiveChild;
export const getCurrentChildName = getActiveChildName;
export const getCurrentChildIndex = getActiveChildIndex;
export const saveHistory = saveToChildHistory;
export const updateStats = updateStatsDisplay;
export const processVoice = processAudio;

// ========================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ========================================
export function initCore() {
  validateConfig();
  initSecurity();
  initUI();
  loadState();
  checkChildSelection();
  updateStatsDisplay();
  
  console.log(`🟢 Герой Сказок v${CONFIG.APP_VERSION} запущен`);
  console.log(`👶 Активный ребёнок: ${getActiveChildName()}`);
  console.log(`🎭 Персонаж: ${getCharacter()}`);
}

// ========================================
// РАБОТА С ДЕТЬМИ
// ========================================

export function getChildren() {
  try {
    return JSON.parse(localStorage.getItem('children') || '[]');
  } catch (e) {
    console.error('❌ Ошибка чтения children:', e);
    return [];
  }
}

export function getActiveChildIndex() {
  if (activeChildIndex >= 0) return activeChildIndex;
  const saved = localStorage.getItem('activeChildIndex');
  if (saved !== null) {
    activeChildIndex = parseInt(saved);
    return activeChildIndex;
  }
  return -1;
}

export function getActiveChildName() {
  const children = getChildren();
  const child = children[getActiveChildIndex()];
  return child ? child.name : 'Гость';
}

export function getActiveChild() {
  const children = getChildren();
  return children[getActiveChildIndex()] || null;
}

export function setActiveChild(index) {
  activeChildIndex = index;
  localStorage.setItem('activeChildIndex', String(index));
  
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
      avatar.style.transition = 'background-image 0.4s ease, box-shadow 0.3s';
    }
  } else {
    if (nameLabel) nameLabel.textContent = 'Гость';
    if (avatar) {
      avatar.style.backgroundImage = "url('assets/images/avatar.png')";
    }
  }
  
  trackEvent('child_select', child ? child.name : 'guest');
}

export function showChildSelectModal() {
  const children = getChildren();
  
  if (children.length === 1) {
    setActiveChild(0);
    return;
  }
  
  if (children.length === 0) {
    setActiveChild(-1);
    return;
  }
  
  const modal = document.getElementById('childSelectModal');
  const list = document.getElementById('childSelectList');
  if (!modal || !list) return;
  
  list.innerHTML = children.map((child, i) => {
    const emoji = child.avatarRole === 'kid1' ? '👧' : (child.avatarRole === 'kid2' ? '👦' : '🐱');
    return `
      <button class="modal-btn child-select-btn" data-index="${i}" 
              style="width:100%; text-align:left; display:flex; align-items:center; gap:12px; padding:14px;">
        <span style="font-size:1.8rem;">${emoji}</span>
        <div>
          <div style="font-weight:600;">${sanitizeInput(child.name)}</div>
          <div style="font-size:0.75rem;opacity:0.6;">${child.age} лет</div>
        </div>
      </button>
    `;
  }).join('');
  
  modal.style.display = 'flex';
  
  document.querySelectorAll('.child-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      modal.style.display = 'none';
      setActiveChild(index);
      updateStatsDisplay();
    });
  });
}

export function selectGuestMode() {
  const modal = document.getElementById('childSelectModal');
  if (modal) modal.style.display = 'none';
  setActiveChild(-1);
  updateStatsDisplay();
}

function checkChildSelection() {
  const savedIndex = getActiveChildIndex();
  const children = getChildren();
  
  if (children.length > 1 && savedIndex === -1) {
    showChildSelectModal();
  } else if (children.length === 1 && savedIndex === -1) {
    setActiveChild(0);
  } else if (savedIndex >= children.length) {
    setActiveChild(-1);
  } else if (savedIndex >= 0) {
    setActiveChild(savedIndex);
  }
}

// ========================================
// ИСТОРИЯ И СТАТИСТИКА (ПО ДЕТЯМ)
// ========================================

export function getChildStatsKey() {
  const child = getActiveChild();
  return child ? `stats_${child.name}` : 'stats_guest';
}

export function getChildStats() {
  const key = getChildStatsKey();
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    if (data) return data;
  } catch (e) {
    console.error('❌ Ошибка чтения статистики:', e);
  }
  
  return {
    totalStories: 0,
    totalGames: 0,
    history: [],
    fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
    lastActive: new Date().toISOString()
  };
}

export function saveChildStats(stats) {
  const key = getChildStatsKey();
  try {
    const json = JSON.stringify(stats);
    if (json.length > CONFIG.MAX_LOCAL_STORAGE_SIZE) {
      stats.history = stats.history.slice(-30);
      return saveChildStats(stats);
    }
    localStorage.setItem(key, json);
  } catch (e) {
    console.error('❌ Ошибка сохранения статистики:', e);
    logError('save_stats', e.message);
  }
}

export function saveToChildHistory(entry) {
  if (!entry || !entry.text) return;
  
  const stats = getChildStats();
  
  stats.history.push({
    role: entry.role || 'unknown',
    text: entry.text,
    timestamp: entry.timestamp || Date.now(),
    characterName: entry.characterName || null,
    childName: entry.childName || getActiveChildName(),
    alerted: entry.alerted || false,
    alertWords: entry.alertWords || []
  });
  
  if (stats.history.length > CONFIG.MAX_HISTORY) {
    stats.history = stats.history.slice(-CONFIG.MAX_HISTORY);
  }
  
  stats.lastActive = new Date().toISOString();
  
  saveChildStats(stats);
  syncGlobalHistory(entry);
}

function syncGlobalHistory(entry) {
  try {
    const globalHistory = JSON.parse(localStorage.getItem('history') || '[]');
    globalHistory.push({
      role: entry.role,
      text: entry.text,
      timestamp: entry.timestamp || Date.now()
    });
    if (globalHistory.length > CONFIG.MAX_HISTORY) {
      localStorage.setItem('history', JSON.stringify(globalHistory.slice(-CONFIG.MAX_HISTORY)));
    } else {
      localStorage.setItem('history', JSON.stringify(globalHistory));
    }
  } catch (e) {
    console.warn('⚠️ Ошибка синхронизации глобальной истории:', e);
  }
}

export function updateFearStats(fears) {
  if (!fears || fears.length === 0) return;
  
  const stats = getChildStats();
  
  fears.forEach(fear => {
    if (stats.fearStats[fear] !== undefined) {
      stats.fearStats[fear] = (stats.fearStats[fear] || 0) + 1;
    }
  });
  
  saveChildStats(stats);
  
  try {
    const globalFears = JSON.parse(localStorage.getItem('fearStats') || '{}');
    fears.forEach(fear => {
      globalFears[fear] = (globalFears[fear] || 0) + 1;
    });
    localStorage.setItem('fearStats', JSON.stringify(globalFears));
  } catch (e) {
    console.warn('⚠️ Ошибка синхронизации страхов:', e);
  }
}

export function incrementStories() {
  const stats = getChildStats();
  stats.totalStories = (stats.totalStories || 0) + 1;
  saveChildStats(stats);
  
  const globalTotal = parseInt(localStorage.getItem('totalStories') || '0') + 1;
  localStorage.setItem('totalStories', String(globalTotal));
  
  updateStatsDisplay();
}

export function incrementGames() {
  const stats = getChildStats();
  stats.totalGames = (stats.totalGames || 0) + 1;
  saveChildStats(stats);
  
  const globalTotal = parseInt(localStorage.getItem('totalGames') || '0') + 1;
  localStorage.setItem('totalGames', String(globalTotal));
  
  updateStatsDisplay();
}

// ========================================
// UI
// ========================================

function initUI() {
  const avatar = document.getElementById('avatar');
  if (avatar) {
    avatar.addEventListener('click', () => cycleCharacter(1));
  }
  
  const parentBtn = document.getElementById('parentBtn');
  if (parentBtn) {
    parentBtn.addEventListener('click', () => {
      window.location.href = '/parent.html';
    });
  }
  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    const token = localStorage.getItem('userToken');
    if (token) {
      logoutBtn.style.display = 'flex';
    }
    logoutBtn.addEventListener('click', logout);
  }
}

function initEventListeners() {
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.addEventListener('click', handleMicClick);
    let longPressTimer;
    micBtn.addEventListener('mousedown', () => {
      longPressTimer = setTimeout(() => handleLongPress(), 1500);
    });
    micBtn.addEventListener('mouseup', () => clearTimeout(longPressTimer));
    micBtn.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
    micBtn.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => handleLongPress(), 1500);
    });
    micBtn.addEventListener('touchend', () => clearTimeout(longPressTimer));
  }
  
  const feedBtn = document.getElementById('feedBtn');
  if (feedBtn) {
    feedBtn.addEventListener('click', () => {
      animateStat('hungerFill', 100);
      trackEvent('feed', getActiveChildName());
      showFeedingAnimation();
    });
  }
  
  const gamesBtn = document.getElementById('gamesBtn');
  if (gamesBtn) {
    gamesBtn.addEventListener('click', () => {
      incrementGames();
      launchFishGame();
    });
  }
  
  const roomBtn = document.getElementById('roomBtn');
  if (roomBtn) {
    roomBtn.addEventListener('click', () => {
      animateStat('energyFill', 100);
      trackEvent('clean', getActiveChildName());
      showCleaningAnimation();
    });
  }
  
  const avatarSection = document.querySelector('.avatar-section');
  if (avatarSection) {
    let touchStartX = 0;
    let touchStartY = 0;
    
    avatarSection.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    avatarSection.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].clientX - touchStartX;
      const diffY = e.changedTouches[0].clientY - touchStartY;
      
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        cycleCharacter(diffX > 0 ? -1 : 1);
      }
    });
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const gameOverlay = document.querySelector('.game-overlay');
      if (gameOverlay) gameOverlay.remove();
      const modal = document.getElementById('childSelectModal');
      if (modal && modal.style.display === 'flex') {
        modal.style.display = 'none';
        selectGuestMode();
      }
    }
  });
}

function loadState() {
  const savedChar = localStorage.getItem('currentCharacter') || 'lucik';
  setCharacter(savedChar);
  characterCycleIndex = characterIds.indexOf(savedChar);
  if (characterCycleIndex < 0) characterCycleIndex = 0;
  
  const avatar = document.getElementById('avatar');
  if (avatar) {
    const char = CHARACTERS[savedChar] || CHARACTERS['lucik'];
    avatar.style.backgroundImage = `url('${char.icon}')`;
  }
}

export function updateStatsDisplay() {
  const stats = getChildStats();
  
  const moodFill = document.getElementById('moodFill');
  const hungerFill = document.getElementById('hungerFill');
  const energyFill = document.getElementById('energyFill');
  const braveryFill = document.getElementById('braveryFill');
  
  if (moodFill) moodFill.style.width = '70%';
  if (hungerFill) hungerFill.style.width = '60%';
  if (energyFill) energyFill.style.width = '50%';
  
  if (braveryFill) {
    const bravery = Math.min(100, (stats.totalStories || 0) * 10 + (stats.totalGames || 0) * 5);
    braveryFill.style.width = Math.max(5, bravery) + '%';
  }
}

function animateStat(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const current = parseInt(el.style.width) || 0;
  const diff = target - current;
  const duration = 400;
  const startTime = performance.now();
  
  function step(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    
    el.style.width = Math.min(100, current + diff * eased) + '%';
    
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      setTimeout(() => {
        el.style.width = '60%';
      }, 2500);
    }
  }
  
  requestAnimationFrame(step);
}

function showFeedingAnimation() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const emoji = document.createElement('span');
      emoji.textContent = ['🍎', '🍪', '🧃', '🍌', '🍇'][i];
      emoji.style.cssText = `
        position: fixed;
        font-size: 24px;
        pointer-events: none;
        z-index: 9999;
        left: 50%;
        top: 40%;
        transition: all 0.8s ease-out;
        opacity: 1;
      `;
      document.body.appendChild(emoji);
      
      requestAnimationFrame(() => {
        emoji.style.transform = `translate(${(Math.random() - 0.5) * 200}px, -${100 + Math.random() * 100}px) scale(0.3)`;
        emoji.style.opacity = '0';
      });
      
      setTimeout(() => emoji.remove(), 900);
    }, i * 100);
  }
}

function showCleaningAnimation() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  
  avatar.style.transform = 'rotate(-5deg)';
  setTimeout(() => { avatar.style.transform = 'rotate(5deg)'; }, 150);
  setTimeout(() => { avatar.style.transform = 'rotate(-3deg)'; }, 300);
  setTimeout(() => { avatar.style.transform = 'rotate(0deg)'; }, 450);
}

// ========================================
// СМЕНА ПЕРСОНАЖА
// ========================================

export function cycleCharacter(direction = 1) {
  characterCycleIndex = (characterCycleIndex + direction + characterIds.length) % characterIds.length;
  const charId = characterIds[characterCycleIndex];
  
  const char = CHARACTERS[charId];
  if (char.premium && !isPremiumUser()) {
    cycleCharacter(direction);
    return;
  }
  
  setCharacter(charId);
  localStorage.setItem('currentCharacter', charId);
  clearContext();
  
  const avatar = document.getElementById('avatar');
  if (avatar) {
    avatar.style.backgroundImage = `url('${char.icon}')`;
    
    avatar.style.transform = 'scale(0.85)';
    avatar.style.transition = 'transform 0.2s ease';
    setTimeout(() => {
      avatar.style.transform = 'scale(1)';
    }, 150);
  }
  
  trackEvent('character_change', charId);
  console.log(`🎭 Персонаж сменён на: ${char.name}`);
}

function isPremiumUser() {
  const email = localStorage.getItem('userEmail') || '';
  if (email === 'alexmel669@gmail.com' && localStorage.getItem('devUnlocked') === '13') {
    return true;
  }
  return localStorage.getItem('premium') === 'true';
}

// ========================================
// ГОЛОСОВОЕ ОБЩЕНИЕ
// ========================================

async function handleMicClick() {
  if (isProcessing) return;
  
  const micBtn = document.getElementById('micBtn');
  const avatar = document.getElementById('avatar');
  
  if (isRecording()) {
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎤';
    isProcessing = true;
    
    try {
      const audioBlob = await stopRecording();
      if (audioBlob && audioBlob.size > 0) {
        await processAudio(audioBlob);
      } else {
        console.log('⚠️ Пустая аудиозапись');
      }
    } catch (err) {
      console.error('❌ Ошибка записи:', err);
      logError('recording', err.message);
    } finally {
      isProcessing = false;
      if (avatar) {
        avatar.classList.remove('listening');
        avatar.classList.remove('talking');
      }
    }
  } else {
    try {
      await startRecording();
      micBtn.classList.add('recording');
      micBtn.textContent = '⏺️';
      if (avatar) avatar.classList.add('listening');
    } catch (err) {
      console.error('❌ Ошибка доступа к микрофону:', err);
      alert('🎤 Не удалось получить доступ к микрофону.\n\nПроверьте разрешения в настройках браузера.');
      logError('mic_access', err.message);
    }
  }
}

async function handleLongPress() {
  if (isProcessing || isRecording()) return;
  
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 20 || hour < 6) {
    const micBtn = document.getElementById('micBtn');
    micBtn.textContent = '🌙';
    
    const prompt = 'Расскажи длинную, спокойную сказку на ночь. Сказка должна быть успокаивающей, с хорошим концом.';
    
    isProcessing = true;
    try {
      const reply = await generateResponse(prompt);
      await synthesizeSpeech(reply, getCharacter());
      incrementStories();
    } catch (err) {
      console.error('❌ Ошибка сказки на ночь:', err);
    } finally {
      isProcessing = false;
      micBtn.textContent = '🎤';
    }
  }
}

async function processAudio(audioBlob) {
  const avatar = document.getElementById('avatar');
  
  try {
    if (avatar) avatar.classList.add('listening');
    
    const recognizedText = await recognizeSpeech(audioBlob);
    
    if (avatar) avatar.classList.remove('listening');
    
    if (!recognizedText || recognizedText.trim().length === 0) {
      console.log('🗣️ Текст не распознан');
      const fallback = 'Я не расслышал(а). Давай ещё раз?';
      await synthesizeSpeech(fallback, getCharacter());
      return;
    }
    
    if (checkBadWords(recognizedText)) {
      console.warn('⚠️ Обнаружены плохие слова');
      await synthesizeSpeech('Давай говорить добрые слова!', getCharacter());
      return;
    }
    
    console.log('👶 Ребёнок:', recognizedText);
    
    const childEntry = {
      role: 'child',
      text: recognizedText,
      timestamp: Date.now(),
      childName: getActiveChildName()
    };
    saveToChildHistory(childEntry);
    addToContext('child', recognizedText);
    
    const fears = detectFear(recognizedText);
    if (fears.length > 0) {
      updateFearStats(fears);
      trackEvent('fear_detected', fears.join(','));
    }
    
    const alertWords = detectAlertWords(recognizedText);
    if (alertWords.length > 0) {
      console.warn('⚠️ Тревожные слова от ребёнка:', alertWords);
      trackEvent('alert_words_child', alertWords.join(','));
      saveAlertForParent(recognizedText, alertWords, 'child');
    }
    
    if (avatar) avatar.classList.add('talking');
    
    const reply = await generateResponse(recognizedText);
    
    console.log('🐱 Ответ:', reply);
    
    const botAlertWords = detectAlertWords(reply);
    const botPersonalData = detectPersonalData(reply);
    const isSuspicious = botAlertWords.length > 0 || botPersonalData.length > 0;
    
    const botEntry = {
      role: 'bot',
      text: reply,
      timestamp: Date.now(),
      characterName: CHARACTERS[getCharacter()]?.name || 'Люцик',
      alerted: isSuspicious,
      alertWords: [...botAlertWords, ...botPersonalData]
    };
    saveToChildHistory(botEntry);
    addToContext('bot', reply);
    
    if (isSuspicious) {
      console.warn('⚠️ Сомнительный ответ ИИ:', reply.substring(0, 100));
      trackEvent('suspicious_ai_response', [...botAlertWords, ...botPersonalData].join(','));
      saveAlertForParent(reply, [...botAlertWords, ...botPersonalData], 'ai');
    }
    
    await synthesizeSpeech(reply, getCharacter());
    
    if (reply.length > 200) {
      incrementStories();
    }
    
    updateStatsDisplay();
    checkAchievements();
    
  } catch (err) {
    console.error('❌ Ошибка обработки аудио:', err);
    logError('process_audio', err.message);
    
    const fallbacks = {
      lucik: 'Мурр... Что-то пошло не так. Давай ещё разок?',
      mom: 'Ой, связь прервалась. Повтори, солнышко?',
      dad: 'Техническая заминка. Давай ещё раз?',
      kid1: 'Ой! Давай ещё раз!',
      kid2: 'Повтори, а?'
    };
    const fallback = fallbacks[getCharacter()] || fallbacks['lucik'];
    await synthesizeSpeech(fallback, getCharacter());
  } finally {
    if (avatar) {
      avatar.classList.remove('talking');
      avatar.classList.remove('listening');
    }
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.classList.remove('recording');
      micBtn.textContent = '🎤';
    }
  }
}

function saveAlertForParent(text, words, source) {
  try {
    const alerts = JSON.parse(localStorage.getItem('parentAlerts') || '[]');
    alerts.push({
      text: text.substring(0, 200),
      words,
      source,
      timestamp: Date.now(),
      childName: getActiveChildName()
    });
    if (alerts.length > 20) alerts.shift();
    localStorage.setItem('parentAlerts', JSON.stringify(alerts));
  } catch (e) {
    console.warn('⚠️ Ошибка сохранения алерта:', e);
  }
}

// ========================================
// РАСПОЗНАВАНИЕ РЕЧИ
// ========================================

async function recognizeSpeech(audioBlob) {
  try {
    const base64 = await blobToBase64(audioBlob);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.AUDIO_TIMEOUT);
    
    const response = await fetch('/api/speech-to-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64 }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data.text) return data.text;
    }
  } catch (err) {
    console.warn('⚠️ Серверное распознавание недоступно, пробуем браузерное:', err.message);
  }
  
  return await browserSpeechRecognition();
}

async function browserSpeechRecognition() {
  return new Promise((resolve) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('⚠️ SpeechRecognition API не поддерживается');
      resolve('');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    
    let resolved = false;
    
    recognition.onresult = (event) => {
      if (!resolved) {
        resolved = true;
        const text = event.results[0]?.[0]?.transcript || '';
        resolve(text);
      }
    };
    
    recognition.onerror = (event) => {
      if (!resolved) {
        resolved = true;
        console.warn('⚠️ Браузерное распознавание:', event.error);
        resolve('');
      }
    };
    
    recognition.onend = () => {
      if (!resolved) {
        resolved = true;
        resolve('');
      }
    };
    
    try {
      recognition.start();
    } catch (e) {
      resolved = true;
      resolve('');
    }
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        recognition.stop();
        resolve('');
      }
    }, CONFIG.AUDIO_TIMEOUT);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        const base64 = reader.result.split(',')[1] || '';
        resolve(base64);
      } else {
        reject(new Error('FileReader error'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

// ========================================
// ИГРА «ПОЙМАЙ РЫБКУ»
// ========================================

export function launchFishGame() {
  const existing = document.querySelector('.game-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'game-overlay';
  overlay.innerHTML = `
    <div style="text-align:center;">
      <h2 style="margin:0 0 12px;">🎣 Поймай рыбку!</h2>
      <p style="margin:0 0 8px;font-size:0.9rem;opacity:0.7;">Лови рыбок, пока идёт время!</p>
      <div id="fishGameArea" style="width:300px;height:400px;background:rgba(0,50,100,0.5);border-radius:20px;position:relative;overflow:hidden;margin:0 auto;cursor:pointer;border:2px solid rgba(255,255,255,0.1);"></div>
      <p style="margin-top:12px;font-size:1.2rem;">🐟 Счёт: <span id="fishScore" style="font-weight:700;">0</span></p>
      <p style="font-size:0.9rem;">⏱️ <span id="fishTimer" style="font-weight:700;">30</span> сек</p>
      <button id="fishCloseBtn" style="margin-top:8px;padding:10px 28px;border-radius:20px;border:none;background:var(--accent);color:#fff;font-size:0.9rem;cursor:pointer;font-weight:600;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  let score = 0;
  let timeLeft = 30;
  let gameActive = true;
  const gameArea = document.getElementById('fishGameArea');
  const scoreDisplay = document.getElementById('fishScore');
  const timerDisplay = document.getElementById('fishTimer');
  let fishTimers = [];
  
  const timerInterval = setInterval(() => {
    timeLeft--;
    if (timerDisplay) timerDisplay.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
  
  function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    clearInterval(fishSpawnInterval);
    fishTimers.forEach(t => clearInterval(t));
    fishTimers = [];
    
    const result = document.createElement('div');
    result.style.cssText = `
      position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.8); padding:24px 32px; border-radius:20px;
      text-align:center; z-index:20;
    `;
    result.innerHTML = `
      <div style="font-size:3rem;">🎉</div>
      <div style="font-size:1.3rem;font-weight:700;">${score} рыбок!</div>
      <div style="opacity:0.7;font-size:0.9rem;">${score >= 10 ? 'Отлично!' : score >= 5 ? 'Хорошо!' : 'Попробуй ещё!'}</div>
    `;
    gameArea.appendChild(result);
    
    if (score >= 10) {
      showAchievement('fish_master', '🎣 Мастер рыбалки!');
    }
    
    trackEvent('game_fish_end', String(score));
  }
  
  function createFish() {
    if (!gameActive) return;
    
    const fish = document.createElement('div');
    const fishTypes = ['🐟', '🐠', '🐡', '🦈', '🐙'];
    const isShark = Math.random() < 0.1;
    const isOctopus = Math.random() < 0.05;
    
    let fishEmoji = fishTypes[Math.floor(Math.random() * 3)];
    if (isShark) fishEmoji = '🦈';
    if (isOctopus) fishEmoji = '🐙';
    
    const size = isShark ? 40 : (isOctopus ? 35 : 24 + Math.random() * 20);
    
    fish.textContent = fishEmoji;
    fish.style.cssText = `
      position:absolute;
      font-size:${size}px;
      left:${Math.random() * 250}px;
      top:${Math.random() * 350}px;
      transition: all 0.6s ease-in-out;
      cursor:pointer;
      z-index:10;
      filter: drop-shadow(0 0 3px rgba(255,255,255,0.3));
    `;
    
    fish.addEventListener('click', (e) => {
      if (!gameActive) return;
      e.stopPropagation();
      
      if (isShark) {
        score = Math.max(0, score - 2);
      } else if (isOctopus) {
        score += 3;
        fish.style.transform = 'scale(1.5)';
        setTimeout(() => fish.remove(), 200);
      } else {
        score++;
      }
      
      scoreDisplay.textContent = score;
      
      fish.style.transform = 'scale(0)';
      fish.style.opacity = '0';
      setTimeout(() => {
        if (fish.parentNode) fish.remove();
      }, 200);
      
      createFish();
    });
    
    gameArea.appendChild(fish);
    
    const moveInterval = setInterval(() => {
      if (!gameActive || !fish.parentNode) {
        clearInterval(moveInterval);
        return;
      }
      fish.style.left = Math.random() * 250 + 'px';
      fish.style.top = Math.random() * 350 + 'px';
    }, 1500 + Math.random() * 1000);
    
    fishTimers.push(moveInterval);
    
    setTimeout(() => {
      if (fish.parentNode) {
        fish.style.opacity = '0';
        setTimeout(() => {
          if (fish.parentNode) fish.remove();
        }, 300);
      }
    }, 8000);
  }
  
  for (let i = 0; i < 3; i++) {
    createFish();
  }
  
  const fishSpawnInterval = setInterval(createFish, 2000);
  
  document.getElementById('fishCloseBtn').addEventListener('click', () => {
    gameActive = false;
    clearInterval(timerInterval);
    clearInterval(fishSpawnInterval);
    fishTimers.forEach(t => clearInterval(t));
    overlay.remove();
    updateStatsDisplay();
  });
  
  trackEvent('game_fish_start', getActiveChildName());
}

// ========================================
// ВЫХОД
// ========================================

function logout() {
  localStorage.removeItem('userToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('activeChildIndex');
  clearContext();
  window.location.href = '/login.html';
}

// ========================================
// ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ
// ========================================

if (typeof window !== 'undefined') {
  window.selectGuestMode = selectGuestMode;
  window.selectChildAndClose = (index) => {
    const modal = document.getElementById('childSelectModal');
    if (modal) modal.style.display = 'none';
    setActiveChild(index);
    updateStatsDisplay();
  };
  window.cycleCharacter = cycleCharacter;
  window.setActiveChild = setActiveChild;
  window.getActiveChildName = getActiveChildName;
  window.saveToChildHistory = saveToChildHistory;
}
