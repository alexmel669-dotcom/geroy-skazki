// ========================================
// core.js — ЯДРО ПРИЛОЖЕНИЯ «ГЕРОЙ СКАЗОК»
// v4.1.0 (на базе 4.0.8 + доработки)
// ========================================

import { CONFIG, CHARACTERS, FALLBACK_REPLIES, migrateFearStatsObject } from './config.js';
import {
  generateResponse, detectFear, detectAlertWords, detectPersonalData,
  setCharacter, getCharacter, addToContext, clearContext
} from './ai.js';
import {
  startRecording, stopRecording, isRecording, getRecordingMimeType, isMicrophoneSupported
} from './mic.js';
import { synthesizeSpeech } from './audio.js';
import { checkAchievements, showAchievement } from './achievements.js';
import { trackEvent, logError } from './analytics.js';
import { initSecurity, checkBadWords, sanitizeInput, sanitizeText } from './security.js';
import { startFishGame } from './games/fish.js';
import { startMemoryGame } from './games/memory.js';
import { startPuzzleGame } from './games/puzzle.js';
import { startEmotionGame } from './games/emotion.js';
import { startColoringGame } from './games/coloring.js';

// ========================================
// STATE
// ========================================

let activeChildIndex = -1;
let isProcessing = false;
let characterCycleIndex = 0;
const characterIds = Object.keys(CHARACTERS);

export const appState = {
  gameActive: false,
  currentChildIndex: -1,
  hunger: 60,
  fishScore: 0,
  memoryCards: [],
  memoryFlipped: [],
  memoryMatches: 0,
  memoryLocked: false
};

// ========================================
// COMPATIBILITY EXPORTS
// ========================================

export const getCurrentChild = getActiveChild;
export const getCurrentChildName = getActiveChildName;
export const getCurrentChildIndex = getActiveChildIndex;
export const saveHistory = saveToChildHistory;
export const updateStats = updateStatsDisplay;
export const updateStatsUI = updateStatsDisplay;
export const processVoice = processAudio;

export function safeParseJSON(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ========================================
// HELPERS
// ========================================

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result.split(',')[1] || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getChildStatsKey() {
  const child = getActiveChild();
  return child ? `stats_${child.name}` : 'stats_guest';
}

function isPremiumUser() {
  if (localStorage.getItem('premium') === 'true') return true;
  const email = localStorage.getItem('userEmail') || '';
  return email === 'alexmel669@gmail.com' && localStorage.getItem('devUnlocked') === '13';
}

function setAvatarIcon(src) {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  if (avatar.tagName === 'IMG') {
    avatar.style.opacity = '0.4';
    setTimeout(() => {
      avatar.src = src;
      avatar.style.opacity = '1';
    }, 150);
  } else {
    avatar.style.backgroundImage = `url('${src}')`;
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
  }
}

function setMicVisualState(state) {
  const micBtn = document.getElementById('micBtn');
  if (!micBtn) return;
  micBtn.classList.remove('mic-recording', 'mic-processing', 'mic-idle');
  if (state === 'recording') {
    micBtn.classList.add('mic-recording');
    micBtn.textContent = '⏺️';
  } else if (state === 'processing') {
    micBtn.classList.add('mic-processing');
    micBtn.textContent = '⏳';
  } else {
    micBtn.classList.add('mic-idle');
    micBtn.textContent = '🎤';
  }
}

// ========================================
// INIT
// ========================================

export function initCore() {
  console.log('🔵 initCore started');
  initSecurity();
  migrateAllStoredStats();
  activeChildIndex = getActiveChildIndex();
  appState.currentChildIndex = activeChildIndex;
  initUI();
  initEventListeners();
  loadState();
  checkChildSelection();
  updateStatsDisplay();
  console.log(`🟢 Герой Сказок v${CONFIG.APP_VERSION} готов к работе`);
}

// ========================================
// CHILDREN
// ========================================

export function getChildren() {
  return safeParseJSON(localStorage.getItem('children') || '[]', []);
}

export function getActiveChildIndex() {
  if (activeChildIndex >= 0) return activeChildIndex;
  const saved = localStorage.getItem('activeChildIndex');
  if (saved !== null) {
    activeChildIndex = parseInt(saved, 10);
    if (Number.isNaN(activeChildIndex)) activeChildIndex = -1;
    return activeChildIndex;
  }
  return -1;
}

export function getActiveChildName() {
  const child = getChildren()[getActiveChildIndex()];
  return child ? child.name : 'Гость';
}

export function getActiveChild() {
  return getChildren()[getActiveChildIndex()] || null;
}

export function setActiveChild(index) {
  activeChildIndex = index;
  appState.currentChildIndex = index;
  localStorage.setItem('activeChildIndex', String(index));

  const child = getChildren()[index];
  const label = document.getElementById('childNameLabel');
  if (label) {
    if (child) {
      const emoji = child.avatarRole === 'kid1' ? '👦' : (child.avatarRole === 'kid2' ? '👧' : '🐱');
      label.textContent = `${emoji} ${child.name}, ${child.age} лет`;
    } else {
      label.textContent = 'Гость';
    }
  }

  if (child?.avatarRole && CHARACTERS[child.avatarRole]) {
    setAvatarIcon(CHARACTERS[child.avatarRole].icon);
  } else {
    const saved = localStorage.getItem('currentCharacter') || 'lucik';
    setAvatarIcon(CHARACTERS[saved]?.icon || CHARACTERS.lucik.icon);
  }

  trackEvent('child_select', child?.name || 'guest');
}

function checkChildSelection() {
  const children = getChildren();
  const saved = getActiveChildIndex();
  if (children.length > 1 && saved === -1) showChildSelectModal();
  else if (children.length === 1 && saved === -1) setActiveChild(0);
  else if (saved >= 0 && saved < children.length) setActiveChild(saved);
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

  list.innerHTML = children.map((c, i) => {
    const emoji = c.avatarRole === 'kid1' ? '👦' : (c.avatarRole === 'kid2' ? '👧' : '🐱');
    return `<button class="modal-btn" style="width:100%;text-align:left;display:flex;align-items:center;gap:12px;" data-index="${i}">
      <span style="font-size:1.5rem;">${emoji}</span><span>${sanitizeInput(c.name)}, ${c.age} лет</span></button>`;
  }).join('');

  modal.style.display = 'flex';
  list.querySelectorAll('[data-index]').forEach((btn) => {
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

function migrateAllStoredStats() {
  const keys = ['stats_guest'];
  getChildren().forEach((c) => keys.push(`stats_${c.name}`));
  keys.forEach((key) => {
    const stats = safeParseJSON(localStorage.getItem(key), null);
    if (!stats?.fearStats) return;
    const migrated = migrateFearStatsObject(stats.fearStats);
    if (JSON.stringify(migrated) !== JSON.stringify(stats.fearStats)) {
      stats.fearStats = migrated;
      localStorage.setItem(key, JSON.stringify(stats));
    }
  });
}

export function getChildStats() {
  const data = safeParseJSON(localStorage.getItem(getChildStatsKey()), null);
  if (data) return data;
  return {
    totalStories: 0,
    totalGames: 0,
    fishScore: 0,
    history: [],
    fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
    lastActive: Date.now()
  };
}

export function saveChildStats(stats) {
  try {
    let json = JSON.stringify(stats);
    const max = CONFIG.MAX_LOCAL_STORAGE_SIZE || 5 * 1024 * 1024;
    while (json.length > max && stats.history?.length) {
      stats.history.shift();
      json = JSON.stringify(stats);
    }
    localStorage.setItem(getChildStatsKey(), json);
  } catch (e) {
    logError('save_stats', e.message);
  }
}

export function saveToChildHistory(entry) {
  if (!entry?.text) return;
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
  stats.lastActive = Date.now();
  saveChildStats(stats);
}

export function updateFearStats(fears) {
  if (!fears?.length) return;
  const stats = getChildStats();
  fears.forEach((f) => {
    if (stats.fearStats[f] !== undefined) stats.fearStats[f]++;
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

export function saveChildData(data) {
  if (!data) return;
  const stats = getChildStats();
  Object.assign(stats, data);
  saveChildStats(stats);
}

export function updateStatsDisplay() {
  const stats = getChildStats();
  const mood = document.getElementById('moodFill');
  const hunger = document.getElementById('hungerFill');
  const energy = document.getElementById('energyFill');
  const bravery = document.getElementById('braveryFill');
  if (mood) mood.style.width = '70%';
  if (hunger) hunger.style.width = `${Math.min(100, appState.hunger || 60)}%`;
  if (energy) energy.style.width = '50%';
  if (bravery) {
    bravery.style.width = Math.max(5, Math.min(100, (stats.totalStories || 0) * 10 + (stats.totalGames || 0) * 5)) + '%';
  }
}

// ========================================
// ANIMATIONS
// ========================================

function animateStat(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const current = parseInt(el.style.width, 10) || 0;
  const diff = target - current;
  const duration = 400;
  const startTime = performance.now();

  function step(timestamp) {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.style.width = Math.min(100, current + diff * eased) + '%';
    if (progress < 1) requestAnimationFrame(step);
    else setTimeout(() => { el.style.width = current + '%'; }, 2500);
  }
  requestAnimationFrame(step);
}

function showFeedingAnimation() {
  const items = ['🍎', '🍪', '🧃', '🍌', '🍇'];
  items.forEach((item, i) => {
    setTimeout(() => {
      const span = document.createElement('span');
      span.textContent = item;
      span.style.cssText = 'position:fixed;font-size:24px;pointer-events:none;z-index:9999;left:50%;top:40%;transition:all .8s;opacity:1;';
      document.body.appendChild(span);
      requestAnimationFrame(() => {
        span.style.transform = `translate(${(Math.random() - 0.5) * 200}px,-${100 + Math.random() * 100}px) scale(.3)`;
        span.style.opacity = '0';
      });
      setTimeout(() => span.remove(), 900);
    }, i * 100);
  });
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
// UI INIT
// ========================================

function initUI() {
  const avatar = document.getElementById('avatar');
  if (avatar) avatar.onclick = () => cycleCharacter(1);

  const parent = document.getElementById('parentBtn');
  if (parent) parent.onclick = () => { window.location.href = '/parent.html'; };

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    if (localStorage.getItem('userToken') || document.cookie.includes('token=')) {
      logoutBtn.style.display = 'flex';
    }
    logoutBtn.onclick = handleLogout;
  }
}

function initEventListeners() {
  const mic = document.getElementById('micBtn');
  if (mic) {
    let pressTimer;
    const onDown = (e) => {
      e.preventDefault();
      pressTimer = setTimeout(handleLongPress, 1500);
      beginRecording();
    };
    const onUp = (e) => {
      if (e) e.preventDefault();
      clearTimeout(pressTimer);
      finishRecording();
    };
    mic.addEventListener('mousedown', onDown);
    mic.addEventListener('mouseup', onUp);
    mic.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    mic.addEventListener('touchstart', onDown, { passive: false });
    mic.addEventListener('touchend', onUp, { passive: false });
  }

  const games = document.getElementById('gamesBtn');
  if (games) games.onclick = showGamesMenu;

  const feed = document.getElementById('feedBtn');
  if (feed) {
    feed.onclick = () => {
      animateStat('hungerFill', 100);
      appState.hunger = 100;
      trackEvent('feed', getActiveChildName());
      showFeedingAnimation();
    };
  }

  const room = document.getElementById('roomBtn');
  if (room) {
    room.onclick = () => {
      animateStat('energyFill', 100);
      trackEvent('clean', getActiveChildName());
      showCleaningAnimation();
    };
  }

  const avatarSection = document.querySelector('.avatar-section');
  if (avatarSection) {
    let touchStartX = 0;
    avatarSection.ontouchstart = (e) => { touchStartX = e.touches[0].clientX; };
    avatarSection.ontouchend = (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 50) cycleCharacter(diff > 0 ? -1 : 1);
    };
  }
}

function loadState() {
  const saved = localStorage.getItem('currentCharacter') || 'lucik';
  setCharacter(saved);
  characterCycleIndex = characterIds.indexOf(saved);
  if (characterCycleIndex < 0) characterCycleIndex = 0;
  setAvatarIcon(CHARACTERS[saved]?.icon || CHARACTERS.lucik.icon);
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
    if (!char) { count++; continue; }
    if (char.premium && !isPremiumUser()) { count++; continue; }

    setCharacter(id);
    localStorage.setItem('currentCharacter', id);
    clearContext();
    setAvatarIcon(char.icon);

    const avatar = document.getElementById('avatar');
    if (avatar) {
      avatar.style.transform = 'scale(0.85)';
      setTimeout(() => { avatar.style.transform = 'scale(1)'; }, 150);
    }
    trackEvent('character_change', id);
    return;
  }
}

function applyAiTiming() {
  if (typeof globalThis.__lastAiMs === 'number') {
    const el = document.getElementById('devAiMs');
    if (el) el.textContent = `${globalThis.__lastAiMs} ms`;
  }
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch (e) {
    console.warn('Logout API error:', e);
  }
  localStorage.removeItem('userToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('isAuth');
  localStorage.removeItem('userRole');
  localStorage.removeItem('guestMode');
  localStorage.removeItem('activeChildIndex');
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  window.location.href = '/login.html';
}

// ========================================
// ALERTS FOR PARENT
// ========================================

function saveAlertForParent(text, words, source) {
  try {
    const alerts = safeParseJSON(localStorage.getItem('parentAlerts') || '[]', []);
    alerts.push({
      text: text.substring(0, 200),
      words,
      source,
      timestamp: Date.now(),
      childName: getActiveChildName()
    });
    while (alerts.length > 20) alerts.shift();
    localStorage.setItem('parentAlerts', JSON.stringify(alerts));
  } catch (e) { /* ignore */ }
}

// ========================================
// SPEECH RECOGNITION
// ========================================

async function recognizeSpeech(blob) {
  if (!blob?.size) return '';
  try {
    const base64 = await blobToBase64(blob);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.AUDIO_TIMEOUT);
    const response = await fetch('/api/speech-to-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: base64,
        contentType: blob.type || getRecordingMimeType()
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = await response.json();
      if (data.text?.trim()) return data.text.trim();
    }
  } catch (e) {
    console.warn('STT fail:', e.message);
  }
  return '';
}

// ========================================
// MICROPHONE
// ========================================

let micEnding = false;

async function beginRecording() {
  if (isProcessing || isRecording()) return;
  if (!isMicrophoneSupported()) {
    alert('Микрофон недоступен. Попроси взрослого помочь настроить.');
    return;
  }
  try {
    await startRecording({
      onAutoStop: () => finishRecording(),
      onStateChange: setMicVisualState
    });
    document.getElementById('avatar')?.classList.add('listening');
  } catch (e) {
    alert('Микрофон недоступен. Попроси взрослого помочь настроить.');
    logError('mic', e.message);
    setMicVisualState('idle');
  }
}

async function finishRecording() {
  if (micEnding || !isRecording() || isProcessing) return;
  micEnding = true;
  isProcessing = true;
  setMicVisualState('processing');
  try {
    const audio = await stopRecording();
    if (audio?.size > 0) await processAudio(audio);
  } catch (e) {
    logError('record', e.message);
  } finally {
    isProcessing = false;
    micEnding = false;
    setMicVisualState('idle');
    document.getElementById('avatar')?.classList.remove('listening', 'talking');
  }
}

async function handleLongPress() {
  if (isProcessing || isRecording()) return;
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 6) {
    isProcessing = true;
    const micBtn = document.getElementById('micBtn');
    if (micBtn) micBtn.textContent = '🌙';
    try {
      const reply = await generateResponse('Расскажи сказку на ночь', getActiveChild() || {});
      if (globalThis.__lastAiMs) applyAiTiming();
      await synthesizeSpeech(reply, getCharacter());
      incrementStories();
      checkAchievements();
    } catch (e) {
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
    const text = await recognizeSpeech(audioBlob);
    if (!text?.trim()) {
      alert('Не удалось распознать речь. Попробуй ещё раз или попроси взрослого проверить микрофон.');
      return;
    }
    if (checkBadWords(text)) {
      await synthesizeSpeech('Давай говорить добрые слова', getCharacter());
      return;
    }

    saveToChildHistory({ role: 'child', text, timestamp: Date.now(), childName: getActiveChildName() });
    addToContext('child', text);

    const fears = detectFear(text);
    if (fears.length) updateFearStats(fears);

    const alerts = detectAlertWords(text);
    if (alerts.length) {
      trackEvent('alert', alerts.join(','));
      saveAlertForParent(text, alerts, 'child');
    }

    if (avatar) avatar.classList.add('talking');
    const child = getActiveChild();
    let reply = await generateResponse(text, child ? { name: child.name, age: child.age } : {});
    if (globalThis.__lastAiMs) applyAiTiming();
    reply = sanitizeText(reply);

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
    if (isSuspicious) saveAlertForParent(reply, [...botAlerts, ...botPersonal], 'ai');

    await synthesizeSpeech(reply, getCharacter());
    if (reply.length > 200) incrementStories();
    checkAchievements();
    updateStatsDisplay();
  } catch (e) {
    logError('process_audio', e.message);
    const fallback = FALLBACK_REPLIES[getCharacter()] || FALLBACK_REPLIES.lucik;
    await synthesizeSpeech(fallback, getCharacter());
  } finally {
    if (avatar) avatar.classList.remove('talking', 'listening');
  }
}

// ========================================
// GAMES
// ========================================

export function showGamesMenu() {
  if (appState.gameActive || document.getElementById('gamesMenuOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'gamesMenuOverlay';
  overlay.className = 'game-overlay';
  overlay.innerHTML = `
    <div style="text-align:center;max-width:320px;padding:10px;">
      <h2 style="margin:0 0 16px;">🎮 Выбери игру</h2>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="modal-btn" data-game="fish">🎣 Рыбалка</button>
        <button class="modal-btn" data-game="memory">🧠 Мемори</button>
        <button class="modal-btn" data-game="puzzle">🧩 Пазл</button>
        <button class="modal-btn" data-game="emotion">😊 Эмоции</button>
        <button class="modal-btn" data-game="coloring">🎨 Раскраска</button>
        <button class="modal-btn secondary" data-game="close">✕ Закрыть</button>
      </div>
    </div>`;

  const games = {
    fish: startFishGame,
    memory: startMemoryGame,
    puzzle: startPuzzleGame,
    emotion: startEmotionGame,
    coloring: startColoringGame
  };

  overlay.querySelectorAll('[data-game]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.game;
      overlay.remove();
      if (id === 'close') return;
      incrementGames();
      updateStatsDisplay();
      games[id]?.();
      checkAchievements();
      trackEvent('game_selected', id);
    };
  });

  document.body.appendChild(overlay);
}

export function launchFishGame() {
  incrementGames();
  startFishGame();
  trackEvent('fish_start', getActiveChildName());
}

// ========================================
// WINDOW EXPORTS
// ========================================

if (typeof window !== 'undefined') {
  window.selectGuestMode = selectGuestMode;
  window.setActiveChild = setActiveChild;
  window.cycleCharacter = cycleCharacter;
  window.getActiveChildName = getActiveChildName;
  window.saveToChildHistory = saveToChildHistory;
  window.saveChildData = saveChildData;
  window.initCore = initCore;
  window.updateStatsUI = updateStatsDisplay;
  window.showChildSelectModal = showChildSelectModal;
  window.showGamesMenu = showGamesMenu;
  window.launchFishGame = launchFishGame;
}

export default {
  appState, initCore, safeParseJSON,
  getChildren, getActiveChildIndex, getActiveChildName, getActiveChild,
  setActiveChild, selectGuestMode, showChildSelectModal,
  getChildStats, saveChildStats, saveToChildHistory, updateFearStats,
  incrementStories, incrementGames, updateStatsDisplay, saveChildData,
  loadState: loadState, cycleCharacter, showGamesMenu, launchFishGame
};
