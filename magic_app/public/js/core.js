// ========================================
// core.js — ЯДРО ПРИЛОЖЕНИЯ «ГЕРОЙ СКАЗОК»
// Версия: 4.0.7 FINAL
// Исправлено: добавлен экспорт updateStatsUI для fish.js
// ========================================

import {
  CONFIG,
  CHARACTERS,
  validateConfig
} from './config.js';

import {
  generateResponse,
  detectFear,
  detectAlertWords,
  detectPersonalData,
  setCharacter,
  getCharacter,
  addToContext,
  clearContext
} from './ai.js';

import {
  startRecording,
  stopRecording,
  isRecording
} from './mic.js';

import {
  synthesizeSpeech
} from './audio.js';

import {
  checkAchievements,
  showAchievement
} from './achievements.js';

import {
  trackEvent,
  logError
} from './analytics.js';

import {
  initSecurity,
  checkBadWords,
  sanitizeInput
} from './security.js';

// ========================================
// STATE
// ========================================

let activeChildIndex = -1;
let isProcessing = false;
let characterCycleIndex = 0;

const characterIds = Object.keys(CHARACTERS);

export const appState = {
  get activeChildIndex() {
    return activeChildIndex;
  },
  set activeChildIndex(v) {
    activeChildIndex = v;
  },
  get isProcessing() {
    return isProcessing;
  },
  set isProcessing(v) {
    isProcessing = v;
  },
  get characterCycleIndex() {
    return characterCycleIndex;
  },
  set characterCycleIndex(v) {
    characterCycleIndex = v;
  },
  characterIds
};

// ========================================
// COMPATIBILITY EXPORTS
// ========================================

export const getCurrentChild = getActiveChild;
export const getCurrentChildName = getActiveChildName;
export const getCurrentChildIndex = getActiveChildIndex;
export const saveHistory = saveToChildHistory;
export const updateStats = updateStatsDisplay;
export const updateStatsUI = updateStatsDisplay; // FIX: для fish.js
export const processVoice = processAudio;

// FIX for fish.js
export function saveChildData(data) {
  if (!data) return;
  const stats = getChildStats();
  Object.assign(stats, data);
  saveChildStats(stats);
}

// ========================================
// HELPER FUNCTIONS (определены ДО использования)
// ========================================

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getChildStatsKey() {
  const child = getActiveChild();
  return child ? `stats_${child.id || child.name}` : 'stats_guest';
}

// ========================================
// INIT
// ========================================

export function initCore() {
  validateConfig();
  initSecurity();
  initUI();
  initEventListeners();
  loadState();
  checkChildSelection();
  updateStatsDisplay();
  console.log(`🟢 Герой Сказок v${CONFIG.APP_VERSION}`);
}

// ========================================
// CHILDREN
// ========================================

export function getChildren() {
  try {
    return JSON.parse(localStorage.getItem('children') || '[]');
  } catch (e) {
    console.error(e);
    return [];
  }
}

export function getActiveChildIndex() {
  if (activeChildIndex >= 0) return activeChildIndex;
  const saved = localStorage.getItem('activeChildIndex');
  if (saved !== null) {
    activeChildIndex = parseInt(saved);
    if (Number.isNaN(activeChildIndex)) {
      activeChildIndex = -1;
    }
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
  
  const child = getChildren()[index];
  const label = document.getElementById('childNameLabel');
  
  if (label) {
    label.textContent = child ? `${child.name}, ${child.age} лет` : 'Гость';
  }
  
  // FIX: обновляем аватар при выборе ребёнка
  const avatar = document.getElementById('avatar');
  if (avatar && child) {
    const avatarMap = {
      kid1: 'assets/images/kid1.png',
      kid2: 'assets/images/kid2.png',
      lucik: 'assets/images/avatar.png'
    };
    avatar.style.backgroundImage = `url('${avatarMap[child.avatarRole] || 'assets/images/avatar.png'}')`;
  } else if (avatar) {
    avatar.style.backgroundImage = "url('assets/images/avatar.png')";
  }
  
  trackEvent('child_select', child?.name || 'guest');
}

function checkChildSelection() {
  const children = getChildren();
  const saved = getActiveChildIndex();
  
  if (children.length > 1 && saved === -1) {
    showChildSelectModal();
  } else if (children.length === 1 && saved === -1) {
    setActiveChild(0);
  }
}

export function showChildSelectModal() {
  const children = getChildren();
  
  if (children.length === 0) {
    setActiveChild(-1);
    return;
  }
  
  const modal = document.getElementById('childSelectModal');
  const list = document.getElementById('childSelectList');
  
  if (!modal || !list) return;
  
  list.innerHTML = children.map((c, i) => `
    <button class="child-select-btn" data-index="${i}">
      ${sanitizeInput(c.name)}
    </button>
  `).join('');
  
  modal.style.display = 'flex';
  
  document.querySelectorAll('.child-select-btn').forEach(btn => {
    btn.onclick = () => {
      setActiveChild(Number(btn.dataset.index));
      modal.style.display = 'none';
      updateStatsDisplay();
    };
  });
}

export function selectGuestMode() {
  setActiveChild(-1);
  const modal = document.getElementById('childSelectModal');
  if (modal) modal.style.display = 'none';
  updateStatsDisplay();
}

// ========================================
// STATS
// ========================================

export function getChildStats() {
  const key = getChildStatsKey();
  
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    if (data) return data;
  } catch (e) {
    console.error('stats read error', e);
  }
  
  return {
    totalStories: 0,
    totalGames: 0,
    history: [],
    fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
    lastActive: Date.now()
  };
}

export function saveChildStats(stats) {
  const key = getChildStatsKey();
  
  try {
    let json = JSON.stringify(stats);
    
    // FIX storage overflow с fallback значением
    const MAX_SIZE = CONFIG.MAX_LOCAL_STORAGE_SIZE || 5 * 1024 * 1024;
    
    while (json.length > MAX_SIZE) {
      if (!stats.history || stats.history.length === 0) break;
      stats.history.shift();
      json = JSON.stringify(stats);
    }
    
    localStorage.setItem(key, json);
  } catch (e) {
    console.error('save stats error', e);
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
    childName: entry.childName || getActiveChildName()
  });
  
  if (stats.history.length > CONFIG.MAX_HISTORY) {
    stats.history = stats.history.slice(-CONFIG.MAX_HISTORY);
  }
  
  saveChildStats(stats);
}

export function updateFearStats(fears) {
  if (!fears || fears.length === 0) return;
  
  const stats = getChildStats();
  
  fears.forEach(f => {
    if (stats.fearStats[f] !== undefined) {
      stats.fearStats[f]++;
    }
  });
  
  saveChildStats(stats);
}

export function incrementStories() {
  const stats = getChildStats();
  stats.totalStories = (stats.totalStories || 0) + 1;
  saveChildStats(stats);
  
  localStorage.setItem('totalStories', String(Number(localStorage.getItem('totalStories') || 0) + 1));
  updateStatsDisplay();
}

export function incrementGames() {
  const stats = getChildStats();
  stats.totalGames = (stats.totalGames || 0) + 1;
  saveChildStats(stats);
  
  localStorage.setItem('totalGames', String(Number(localStorage.getItem('totalGames') || 0) + 1));
  updateStatsDisplay();
}

// ========================================
// ANIMATIONS (определены ДО использования)
// ========================================

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
  
  const items = ['🍎', '🍪', '🧃', '🍌', '🍇'];
  
  for (let i = 0; i < items.length; i++) {
    setTimeout(() => {
      const span = document.createElement('span');
      span.textContent = items[i];
      span.style.cssText = `
        position:fixed;
        font-size:24px;
        pointer-events:none;
        z-index:9999;
        left:50%;
        top:40%;
        transition:all .8s;
        opacity:1;
      `;
      
      document.body.appendChild(span);
      
      requestAnimationFrame(() => {
        span.style.transform = `translate(${(Math.random() - .5) * 200}px,-${100 + Math.random() * 100}px) scale(.3)`;
        span.style.opacity = '0';
      });
      
      setTimeout(() => span.remove(), 900);
    }, i * 100);
  }
}

function showCleaningAnimation() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  
  avatar.style.transform = 'rotate(-5deg)';
  
  setTimeout(() => {
    avatar.style.transform = 'rotate(5deg)';
  }, 150);
  
  setTimeout(() => {
    avatar.style.transform = 'rotate(-3deg)';
  }, 300);
  
  setTimeout(() => {
    avatar.style.transform = 'rotate(0deg)';
  }, 450);
}

// ========================================
// UI INIT
// ========================================

function initUI() {
  const avatar = document.getElementById('avatar');
  if (avatar) {
    avatar.onclick = () => cycleCharacter(1);
  }
  
  const parent = document.getElementById('parentBtn');
  if (parent) {
    parent.onclick = () => {
      location.href = './parent.html';
    };
  }
  
  // FIX: кнопка выхода
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    if (localStorage.getItem('userToken')) {
      logoutBtn.style.display = 'flex';
    }
    logoutBtn.onclick = logout;
  }
}

function initEventListeners() {
  const mic = document.getElementById('micBtn');
  
  if (mic) {
    mic.onclick = handleMicClick;
    
    // FIX: долгое нажатие для сказки на ночь
    let pressTimer;
    
    mic.onmousedown = () => {
      pressTimer = setTimeout(handleLongPress, 1500);
    };
    
    mic.onmouseup = () => clearTimeout(pressTimer);
    mic.onmouseleave = () => clearTimeout(pressTimer);
    mic.ontouchstart = () => {
      pressTimer = setTimeout(handleLongPress, 1500);
    };
    mic.ontouchend = () => clearTimeout(pressTimer);
  }
  
  const games = document.getElementById('gamesBtn');
  if (games) {
    games.onclick = () => {
      incrementGames();
      launchFishGame();
    };
  }
  
  // FIX: кнопка кормления
  const feed = document.getElementById('feedBtn');
  if (feed) {
    feed.onclick = () => {
      animateStat('hungerFill', 100);
      trackEvent('feed', getActiveChildName());
      showFeedingAnimation();
    };
  }
  
  // FIX: кнопка комнаты
  const room = document.getElementById('roomBtn');
  if (room) {
    room.onclick = () => {
      animateStat('energyFill', 100);
      trackEvent('clean', getActiveChildName());
      showCleaningAnimation();
    };
  }
}

function loadState() {
  const saved = localStorage.getItem('currentCharacter') || 'lucik';
  setCharacter(saved);
  characterCycleIndex = characterIds.indexOf(saved);
  if (characterCycleIndex < 0) characterCycleIndex = 0;
  
  // FIX: загружаем аватар
  const avatar = document.getElementById('avatar');
  if (avatar) {
    const char = CHARACTERS[saved] || CHARACTERS.lucik;
    avatar.style.backgroundImage = `url('${char.icon}')`;
  }
}

// ========================================
// DISPLAY
// ========================================

export function updateStatsDisplay() {
  const stats = getChildStats();
  
  const mood = document.getElementById('moodFill');
  const hunger = document.getElementById('hungerFill');
  const energy = document.getElementById('energyFill');
  const bravery = document.getElementById('braveryFill');
  
  if (mood) mood.style.width = '70%';
  if (hunger) hunger.style.width = '60%';
  if (energy) energy.style.width = '50%';
  
  if (bravery) {
    const value = Math.min(100, (stats.totalStories || 0) * 10 + (stats.totalGames || 0) * 5);
    bravery.style.width = Math.max(5, value) + '%';
  }
}

// ========================================
// CHARACTER
// ========================================

export function cycleCharacter(direction = 1) {
  let count = 0;
  
  while (count < characterIds.length) {
    characterCycleIndex = (characterCycleIndex + direction + characterIds.length) % characterIds.length;
    
    const id = characterIds[characterCycleIndex];
    const char = CHARACTERS[id];
    
    if (!char) {
      count++;
      continue;
    }
    
    if (char.premium && !isPremiumUser()) {
      count++;
      continue;
    }
    
    setCharacter(id);
    localStorage.setItem('currentCharacter', id);
    clearContext();
    
    // FIX: обновляем аватар при смене персонажа
    const avatar = document.getElementById('avatar');
    if (avatar) {
      avatar.style.backgroundImage = `url('${char.icon}')`;
      avatar.style.transform = 'scale(.85)';
      setTimeout(() => {
        avatar.style.transform = 'scale(1)';
      }, 150);
    }
    
    trackEvent('character_change', id);
    return;
  }
}

function isPremiumUser() {
  const email = localStorage.getItem('userEmail') || '';
  
  if (email === 'alexmel669@gmail.com' && localStorage.getItem('devUnlocked') === '13') {
    return true;
  }
  
  return localStorage.getItem('premium') === 'true';
}

// ========================================
// ALERTS FOR PARENT
// ========================================

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
    console.warn(e);
  }
}

// ========================================
// SPEECH RECOGNITION
// ========================================

function browserSpeechRecognition() {
  return new Promise(resolve => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!Speech) {
      console.warn('Speech recognition not supported');
      resolve('');
      return;
    }
    
    const rec = new Speech();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    
    let finished = false;
    
    rec.onresult = e => {
      if (finished) return;
      finished = true;
      resolve(e.results[0][0].transcript);
    };
    
    rec.onerror = () => {
      if (!finished) {
        finished = true;
        try { rec.abort(); } catch(e) {}
        resolve('');
      }
    };
    
    rec.onend = () => {
      if (!finished) {
        finished = true;
        resolve('');
      }
    };
    
    try {
      rec.start();
    } catch (e) {
      resolve('');
    }
    
    setTimeout(() => {
      if (!finished) {
        finished = true;
        try { rec.stop(); } catch(e) {}
        resolve('');
      }
    }, CONFIG.AUDIO_TIMEOUT || 10000);
  });
}

async function recognizeSpeech(blob) {
  try {
    const base64 = await blobToBase64(blob);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.AUDIO_TIMEOUT || 10000);
    
    const response = await fetch('./api/speech-to-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64 }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      if (data.text) return data.text;
    }
  } catch (e) {
    console.warn('STT fail', e.message);
  }
  
  return browserSpeechRecognition();
}

// ========================================
// MICROPHONE
// ========================================

async function handleMicClick() {
  if (isProcessing) return;
  
  const mic = document.getElementById('micBtn');
  const avatar = document.getElementById('avatar');
  
  if (isRecording()) {
    isProcessing = true;
    
    try {
      const audio = await stopRecording();
      if (audio && audio.size > 0) {
        await processAudio(audio);
      }
    } catch (e) {
      console.error(e);
      logError('record', e.message);
    } finally {
      isProcessing = false;
      if (avatar) {
        avatar.classList.remove('listening', 'talking');
      }
      if (mic) {
        mic.classList.remove('recording');
        mic.textContent = '🎤';
      }
    }
  } else {
    try {
      await startRecording();
      if (mic) {
        mic.classList.add('recording');
        mic.textContent = '⏺️';
      }
      if (avatar) avatar.classList.add('listening');
    } catch (e) {
      alert('Нет доступа к микрофону');
      logError('mic', e.message);
    }
  }
}

// ========================================
// LONG PRESS — СКАЗКА НА НОЧЬ
// ========================================

async function handleLongPress() {
  if (isProcessing || isRecording()) return;
  
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 20 || hour < 6) {
    const micBtn = document.getElementById('micBtn');
    if (micBtn) micBtn.textContent = '🌙';
    
    const prompt = 'Расскажи длинную, спокойную сказку на ночь. Сказка должна быть успокаивающей, с хорошим концом.';
    
    isProcessing = true;
    
    try {
      const reply = await generateResponse(prompt);
      await synthesizeSpeech(reply, getCharacter());
      incrementStories();
    } catch (e) {
      console.error(e);
      logError('bedtime_story', e.message);
    } finally {
      isProcessing = false;
      if (micBtn) micBtn.textContent = '🎤';
    }
  }
}

// ========================================
// AUDIO PROCESS
// ========================================

async function processAudio(audioBlob) {
  const avatar = document.getElementById('avatar');
  
  try {
    if (avatar) avatar.classList.add('listening');
    
    const text = await recognizeSpeech(audioBlob);
    
    if (!text || !text.trim()) {
      await synthesizeSpeech('Я не расслышал. Повтори?', getCharacter());
      return;
    }
    
    if (checkBadWords(text)) {
      await synthesizeSpeech('Давай говорить добрые слова', getCharacter());
      return;
    }
    
    saveToChildHistory({
      role: 'child',
      text: text,
      timestamp: Date.now()
    });
    
    addToContext('child', text);
    
    const fears = detectFear(text);
    if (fears.length) {
      updateFearStats(fears);
    }
    
    const alerts = detectAlertWords(text);
    if (alerts.length) {
      trackEvent('alert', alerts.join(','));
      saveAlertForParent(text, alerts, 'child');
    }
    
    if (avatar) avatar.classList.add('talking');
    
    const reply = await generateResponse(text);
    
    // FIX: проверяем ответ ИИ на сомнительное
    const botAlerts = detectAlertWords(reply);
    const botPersonal = detectPersonalData(reply);
    const isSuspicious = botAlerts.length > 0 || botPersonal.length > 0;
    
    saveToChildHistory({
      role: 'bot',
      text: reply,
      timestamp: Date.now(),
      characterName: CHARACTERS[getCharacter()]?.name || 'Люцик',
      alerted: isSuspicious,
      alertWords: [...botAlerts, ...botPersonal]
    });
    
    addToContext('bot', reply);
    
    if (isSuspicious) {
      saveAlertForParent(reply, [...botAlerts, ...botPersonal], 'ai');
    }
    
    await synthesizeSpeech(reply, getCharacter());
    
    if (reply.length > 200) {
      incrementStories();
    }
    
    if (typeof checkAchievements === 'function') {
      checkAchievements();
    }
    
  } catch (e) {
    console.error('AI error', e);
    logError('process_audio', e.message);
    await synthesizeSpeech('Что-то пошло не так. Попробуем ещё раз?', getCharacter());
  } finally {
    if (avatar) {
      avatar.classList.remove('talking', 'listening');
    }
  }
}

// ========================================
// GAME "FISH"
// ========================================

export function launchFishGame() {
  const old = document.querySelector('.game-overlay');
  if (old) old.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'game-overlay';
  overlay.innerHTML = `
    <div style="text-align:center; padding:20px;">
      <h2>🎣 Поймай рыбку!</h2>
      <div id="fishGameArea" style="width:300px; height:400px; position:relative; overflow:hidden; background:#246; border-radius:20px; margin:auto;"></div>
      <p>🐟 Счёт: <span id="fishScore">0</span></p>
      <p>⏱️ <span id="fishTimer">30</span> сек</p>
      <button id="fishCloseBtn">Закрыть</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  let score = 0;
  let time = 30;
  let active = true;
  let fishSpawnInterval = null;
  
  const area = document.getElementById('fishGameArea');
  const scoreEl = document.getElementById('fishScore');
  const timerEl = document.getElementById('fishTimer');
  
  const timer = setInterval(() => {
    if (!active) return;
    time--;
    if (timerEl) timerEl.textContent = time;
    if (time <= 0) finish();
  }, 1000);
  
  function finish() {
    if (!active) return;
    active = false;
    clearInterval(timer);
    if (fishSpawnInterval) clearInterval(fishSpawnInterval);
    
    if (score >= 10 && typeof showAchievement === 'function') {
      showAchievement('fish_master', '🎣 Мастер рыбалки!');
    }
    
    trackEvent('fish_finish', String(score));
  }
  
  function createFish() {
    if (!active) return;
    
    const fish = document.createElement('div');
    const items = ['🐟', '🐠', '🐡', '🐙'];
    fish.textContent = items[Math.floor(Math.random() * items.length)];
    fish.style.position = 'absolute';
    fish.style.left = Math.random() * 250 + 'px';
    fish.style.top = Math.random() * 350 + 'px';
    fish.style.fontSize = '32px';
    fish.style.cursor = 'pointer';
    
    fish.onclick = () => {
      if (!active) return;
      score++;
      if (scoreEl) scoreEl.textContent = score;
      fish.remove();
    };
    
    if (area) area.appendChild(fish);
    
    setTimeout(() => {
      if (fish.parentNode) fish.remove();
    }, 5000);
  }
  
  for (let i = 0; i < 3; i++) {
    createFish();
  }
  
  fishSpawnInterval = setInterval(createFish, 1500);
  
  const closeBtn = document.getElementById('fishCloseBtn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      active = false;
      clearInterval(timer);
      clearInterval(fishSpawnInterval);
      overlay.remove();
    };
  }
  
  trackEvent('fish_start', getActiveChildName());
}

// ========================================
// LOGOUT
// ========================================

function logout() {
  localStorage.removeItem('userToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('activeChildIndex');
  clearContext();
  location.href = './login.html';
}

// ========================================
// WINDOW EXPORTS (только для отладки)
// ========================================

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.selectGuestMode = selectGuestMode;
  window.setActiveChild = setActiveChild;
  window.cycleCharacter = cycleCharacter;
  window.getActiveChildName = getActiveChildName;
  window.saveToChildHistory = saveToChildHistory;
  window.saveChildData = saveChildData;
  window.initCore = initCore;
  window.updateStatsUI = updateStatsDisplay;
}
