// ========================================
// core.js — ЯДРО ПРИЛОЖЕНИЯ «ГЕРОЙ СКАЗОК»
// v5.0.5 (аудит безопасности и стабильности)
// ========================================

import { CONFIG, CHARACTERS, FALLBACK_REPLIES, PLANS, GAMES, migrateFearStatsObject } from './config.js';
import { getChildGender, guessGenderFromName, applyGenderToText, gladToSeePhrase } from './gender.js';
import {
  generateResponse, detectFear, detectPersonalData,
  setCharacter, getCharacter, addToContext, clearContext,
  loadChatHistory, setChatChild, extractFearsFromText,
  shouldSuggestFearGame, getFearGameSuggestion
} from './ai.js';
import {
  startRecording, stopRecording, cancelRecording, isRecording, getRecordingMimeType,
  isMicrophoneSupported, prepareAudioForStt, getLiveSttText, clearLiveSttText
} from './mic.js';
import { synthesizeSpeech } from './audio.js';
import { checkAchievements, showAchievement } from './achievements.js';
import { trackEvent, logError } from './analytics.js';
import { initSecurity, checkBadWords, sanitizeInput, sanitizeAIText, detectAlertWords } from './security.js';
import { startFishGame } from './games/fish.js';
import { startMemoryGame } from './games/memory.js';
import { startPuzzleGame } from './games/puzzle.js';
import { startRiddlesGame } from './games/riddles.js';
import { startQuestGame } from './games/quest.js';
import { startMazeGame } from './games/maze.js';
import { startQuizGame } from './games/quiz.js';
import { getGameLevel } from './games/game-ui.js';
import { setAvatarState, playPurrSound } from './ui.js';
import { getTimeContext } from './context.js';
import { detectRequestType, getDictionaryFallback, learnFromResponse, isBedtimeStoryRequest } from './dictionary.js';
import { checkDailyStreak, updateStreakUI, getDailyAdventure } from './retention.js';
import { initChildSwipe } from './child-swipe.js';
import {
  getTamagotchi, applyTamagotchiTick, onChat, onGame, onFeed, onClean, onFearTalk,
  getTamagotchiNeedsMessage
} from './tamagotchi.js';

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

const PLAN_COUNTERS_KEY = 'planDailyCounters';
let planLimitActive = false;
let tamagotchiTimer = null;

export function getUserPlan() {
  if (localStorage.getItem('guestMode') === 'true') return 'free';
  const expiry = localStorage.getItem('planExpiry');
  if (expiry && new Date(expiry) < new Date()) {
    localStorage.setItem('userPlan', 'free');
    localStorage.removeItem('planExpiry');
    return 'free';
  }
  const plan = localStorage.getItem('userPlan') || 'free';
  return PLANS[plan] ? plan : 'free';
}

export function getPlanDaysRemaining() {
  const expiry = localStorage.getItem('planExpiry');
  if (!expiry) return 0;
  const diff = new Date(expiry) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function resetDailyCounters() {
  const today = new Date().toDateString();
  const data = safeParseJSON(localStorage.getItem(PLAN_COUNTERS_KEY), {}) || {};
  if (data.date !== today) {
    localStorage.setItem(PLAN_COUNTERS_KEY, JSON.stringify({ date: today, stories: 0 }));
  }
}

function getDailyCounters() {
  resetDailyCounters();
  const counters = safeParseJSON(localStorage.getItem(PLAN_COUNTERS_KEY), {
    date: new Date().toDateString(),
    stories: 0
  });
  return counters && typeof counters === 'object' ? counters : { date: new Date().toDateString(), stories: 0 };
}

export function getStoriesRemaining() {
  const limits = PLANS[getUserPlan()];
  const counters = getDailyCounters();
  return Math.max(0, limits.storiesPerDay - (counters.stories || 0));
}

function incrementDailyStories() {
  resetDailyCounters();
  const counters = getDailyCounters();
  counters.stories = (counters.stories || 0) + 1;
  localStorage.setItem(PLAN_COUNTERS_KEY, JSON.stringify(counters));
}

export function canAccessCharacter(id) {
  return PLANS[getUserPlan()].characters.includes(id);
}

export function canAccessGame(id) {
  return PLANS[getUserPlan()].games.includes(id);
}

function updateAvatarMoodState() {
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 6) {
    setAvatarState('sleepy');
  } else {
    setAvatarState(null);
  }
}

function getChildAgeForGames() {
  const child = getActiveChild();
  if (child?.age) return child.age;
  const stored = parseInt(localStorage.getItem('profileChildAge') || '0', 10);
  return stored || 5;
}

function isGameAgeAppropriate(gameId) {
  const game = GAMES[gameId];
  if (!game?.ages) return true;
  const age = getChildAgeForGames();
  return age >= game.ages[0] && age <= game.ages[1];
}

async function syncProfileToServer(data) {
  if (localStorage.getItem('guestMode') === 'true') return;
  if (!localStorage.getItem('userToken') && localStorage.getItem('isAuth') !== 'true') return;
  try {
    await fetch('/api/profile-update', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.warn('Profile sync failed:', e);
  }
}

function saveDetectedProfile({ childName, childAge }) {
  if (childName) {
    localStorage.setItem('profileChildName', childName);
    localStorage.setItem('profileComplete', localStorage.getItem('profileChildAge') ? 'true' : 'partial');
  }
  if (childAge != null && childAge !== '') {
    localStorage.setItem('profileChildAge', String(childAge));
    localStorage.setItem('profileComplete', 'true');
  }

  const children = getChildren();
  let gender = null;
  if (childName && (children.length === 0 || getActiveChildName() === 'Гость')) {
    const ageNum = parseInt(childAge, 10) || 5;
    gender = guessGenderFromName(childName);
    const avatarRole = gender === 'male' ? 'kid2' : 'kid1';
    const avatar = gender === 'male' ? 'kid2.svg' : 'kid1.svg';
    const newChild = { name: childName, age: ageNum, gender, avatar, avatarRole, index: 0 };
    localStorage.setItem('children', JSON.stringify([newChild]));
    localStorage.setItem('childrenNames', childName);
    setActiveChild(0);
  } else if (childName && children.length) {
    const idx = getActiveChildIndex() >= 0 ? getActiveChildIndex() : 0;
    if (children[idx]) {
      children[idx].name = childName;
      if (childAge != null) children[idx].age = parseInt(childAge, 10) || children[idx].age;
      if (!children[idx].gender || children[idx].gender === 'unknown') {
        const g = guessGenderFromName(childName);
        if (g !== 'unknown') {
          children[idx].gender = g;
          children[idx].avatarRole = g === 'male' ? 'kid2' : 'kid1';
          children[idx].avatar = g === 'male' ? 'kid2.svg' : 'kid1.svg';
        }
      }
      gender = children[idx].gender;
      localStorage.setItem('children', JSON.stringify(children));
      setActiveChild(idx);
    }
  }

  syncProfileToServer({ childName, childAge, gender: gender || getChildGender(getActiveChild()) });
}

function saveParentConcerns(concerns) {
  if (!concerns?.length) return;
  const existing = safeParseJSON(localStorage.getItem('parentConcerns'), []) || [];
  const merged = [...new Set([...existing, ...concerns])];
  localStorage.setItem('parentConcerns', JSON.stringify(merged));
  syncProfileToServer({ concerns: merged });
}

function getChildContextForAI() {
  const child = getActiveChild();
  const profileName = localStorage.getItem('profileChildName');
  const profileAge = localStorage.getItem('profileChildAge');
  const gender = getChildGender(child);
  if (child?.name && child.name !== 'Гость') {
    return {
      name: child.name,
      age: child.age || parseInt(profileAge, 10) || 5,
      gender
    };
  }
  const name = profileName || 'малыш';
  return {
    name,
    age: profileAge ? parseInt(profileAge, 10) : 5,
    gender: gender !== 'unknown' ? gender : guessGenderFromName(name)
  };
}

function childAvatarImg(role) {
  const map = { kid1: 'kid1.svg', kid2: 'kid2.svg', lucik: 'avatar.svg' };
  const file = map[role] || 'avatar.svg';
  return `<img src="assets/images/${file}" alt="" class="child-chip-avatar">`;
}

function applyChildAvatar(child) {
  if (!child) return;
  const role = child.avatarRole || (String(child.avatar || '').includes('kid2') ? 'kid2' : 'kid1');
  if (CHARACTERS[role]) {
    setAvatarIcon(CHARACTERS[role].icon);
  } else if (child.avatar) {
    setAvatarIcon(`assets/images/${child.avatar}`);
  }
}

function showPlanLimitUI(show) {
  planLimitActive = show;
  const bar = document.getElementById('planLimitBar');
  const micBtn = document.getElementById('micBtn');
  if (bar) bar.style.display = show ? 'flex' : 'none';
  if (micBtn) {
    micBtn.classList.toggle('mic-disabled', show);
    micBtn.disabled = show;
  }
}

async function handlePlanLimitExceeded() {
  if (planLimitActive) return;
  showPlanLimitUI(true);
  await synthesizeSpeech(
    'Мы сегодня уже много общались! Попроси родителей открыть полный доступ.',
    getCharacter()
  );
}

function isPremiumUser() {
  const plan = getUserPlan();
  return plan === 'basic' || plan === 'family';
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
  micBtn.classList.remove('mic-recording', 'mic-processing', 'mic-idle', 'recording', 'processing');
  if (state === 'recording') {
    micBtn.classList.add('mic-recording', 'recording');
  } else if (state === 'processing') {
    micBtn.classList.add('mic-processing', 'processing');
  } else {
    micBtn.classList.add('mic-idle');
  }
}

function showThinking() {
  const dots = document.getElementById('thinkingDots');
  if (dots) dots.style.display = 'block';
}

function hideThinking() {
  const dots = document.getElementById('thinkingDots');
  if (dots) dots.style.display = 'none';
}

const MIC_RETRY_PHRASES = [
  'Я не расслышал, повтори пожалуйста',
  'Скажи ещё разок, я внимательно слушаю',
  'Давай попробуем чуть позже, я буду ждать тебя!'
];

let micFailCount = 0;
let micDisabledUntil = 0;

function isMicDisabled() {
  return Date.now() < micDisabledUntil;
}

function setMicDisabled(disabled) {
  const micBtn = document.getElementById('micBtn');
  if (!micBtn) return;
  micBtn.classList.toggle('mic-disabled', disabled);
  micBtn.disabled = disabled;
}

function resetMicFailCount() {
  micFailCount = 0;
}

async function handleMicFailure(reason) {
  console.warn('🎙️ Mic failure:', reason);
  micFailCount += 1;
  const idx = Math.min(micFailCount - 1, MIC_RETRY_PHRASES.length - 1);
  await synthesizeSpeech(MIC_RETRY_PHRASES[idx], getCharacter());
  if (micFailCount >= 3) {
    micDisabledUntil = Date.now() + 30000;
    setMicDisabled(true);
    setTimeout(() => {
      micFailCount = 0;
      setMicDisabled(false);
    }, 30000);
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
  setChatChild(getActiveChildName());
  loadChatHistory(getActiveChildName());
  updateStatsDisplay();
  resetDailyCounters();
  if (getStoriesRemaining() <= 0) showPlanLimitUI(true);
  updateAvatarMoodState();
  setMicVisualState('idle');

  checkDailyStreak();
  updateStreakUI();
  localStorage.setItem('geroy-last-visit', new Date().toISOString());

  const adventure = getDailyAdventure();
  if (adventure) {
    setTimeout(() => synthesizeSpeech(adventure.message, getCharacter()).catch(() => {}), 2000);
  }

  console.log(`🟢 Герой Сказок v${CONFIG.APP_VERSION} готов к работе`);

  if (tamagotchiTimer) clearInterval(tamagotchiTimer);
  tamagotchiTimer = setInterval(() => {
    const stats = getChildStats();
    applyTamagotchiTick(stats);
    saveChildStats(stats);
    updateStatsDisplay();
    const needMsg = getTamagotchiNeedsMessage(stats);
    if (needMsg && !isProcessing && !appState.gameActive) {
      synthesizeSpeech(needMsg, getCharacter()).catch(() => {});
    }
  }, 60000);
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

export function setActiveChild(index, options = {}) {
  activeChildIndex = index;
  appState.currentChildIndex = index;
  localStorage.setItem('activeChildIndex', String(index));

  const child = getChildren()[index];
  const label = document.getElementById('childNameLabel');
  if (label) {
    if (child) {
      label.textContent = `${child.name}, ${child.age} лет`;
    } else {
      label.textContent = 'Гость';
    }
  }

  applyChildAvatar(child);
  if (!child) {
    const saved = localStorage.getItem('currentCharacter') || 'lucik';
    setAvatarIcon(CHARACTERS[saved]?.icon || CHARACTERS.lucik.icon);
  }

  trackEvent('child_select', child?.name || 'guest');
  setChatChild(child?.name || 'guest');
  loadChatHistory(child?.name || 'guest');

  if (options.greet && child?.name) {
    const gender = getChildGender(child);
    synthesizeSpeech(`Привет, ${child.name}! ${gladToSeePhrase(gender)}`, getCharacter()).catch(() => {});
  }
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
    return `<button class="modal-btn" style="width:100%;text-align:left;display:flex;align-items:center;gap:12px;" data-index="${i}">
      ${childAvatarImg(c.avatarRole)}<span>${sanitizeInput(c.name)}, ${c.age} лет</span></button>`;
  }).join('');

  modal.style.display = 'flex';
  list.querySelectorAll('[data-index]').forEach((btn) => {
    btn.onclick = () => {
      setActiveChild(Number(btn.dataset.index), { greet: true });
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
  const tc = getTimeContext(getActiveChildName());
  const stats = getChildStats();
  stats.history.push({
    role: entry.role || 'unknown',
    text: entry.text,
    timestamp: entry.timestamp || Date.now(),
    timeOfDay: entry.timeOfDay || tc.partOfDay,
    hour: entry.hour != null ? entry.hour : tc.hour,
    dayOfWeek: entry.dayOfWeek || new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
    type: entry.type || 'chat',
    mood: entry.mood || null,
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
  onGame(stats);
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
  const t = getTamagotchi(stats);
  const mood = document.getElementById('moodFill');
  const hunger = document.getElementById('hungerFill');
  const energy = document.getElementById('energyFill');
  const bravery = document.getElementById('braveryFill');
  if (mood) mood.style.width = `${t.mood ?? 70}%`;
  if (hunger) hunger.style.width = `${t.hunger ?? 60}%`;
  if (energy) energy.style.width = `${t.energy ?? 50}%`;
  if (bravery) bravery.style.width = `${Math.max(5, Math.min(100, t.courage ?? 10))}%`;
}

// ========================================
// ANIMATIONS
// ========================================

function animateStat(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const current = parseInt(el.style.width, 10) || 0;
  const diff = target - current;
  const duration = 1500;
  const startTime = performance.now();

  function step(timestamp) {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.style.width = Math.min(100, current + diff * eased) + '%';
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function showFeedingAnimation() {
  const avatar = document.getElementById('avatar');
  const feedBtn = document.getElementById('feedBtn');
  const items = ['🍎', '🍪', '🧃'];
  const origin = feedBtn?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight * 0.7 };
  const target = avatar?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight * 0.35 };

  items.forEach((item, i) => {
    setTimeout(() => {
      const span = document.createElement('span');
      span.textContent = item;
      span.className = 'feed-fly-emoji';
      span.style.cssText = `position:fixed;font-size:28px;pointer-events:none;z-index:9999;left:${origin.left}px;top:${origin.top}px;transition:all 1.2s ease-in;`;
      document.body.appendChild(span);
      requestAnimationFrame(() => {
        span.style.left = `${target.left + (target.width || 0) / 2}px`;
        span.style.top = `${target.top}px`;
        span.style.transform = 'scale(0.4)';
        span.style.opacity = '0';
      });
      setTimeout(() => span.remove(), 1300);
    }, i * 180);
  });

  if (avatar) {
    avatar.style.transition = 'transform 0.3s ease';
    avatar.style.transform = 'scale(1.2)';
    setTimeout(() => { avatar.style.transform = 'scale(1)'; }, 400);
    setTimeout(() => { avatar.style.transform = 'scale(1.15)'; }, 700);
    setTimeout(() => { avatar.style.transform = 'scale(1)'; avatar.style.transition = ''; }, 1100);
  }
}

function showCleaningAnimation() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  avatar.style.transition = 'transform 0.25s ease';
  [-5, 5, -4, 4, 0].forEach((deg, i) => {
    setTimeout(() => { avatar.style.transform = `rotate(${deg}deg)`; }, i * 200);
  });
  setTimeout(() => { avatar.style.transition = ''; avatar.style.transform = ''; }, 1200);

  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const spark = document.createElement('span');
      spark.textContent = '✨';
      spark.style.cssText = `position:fixed;font-size:20px;pointer-events:none;z-index:9999;left:${50 + (Math.random() - 0.5) * 30}%;top:${30 + (Math.random() - 0.5) * 20}%;opacity:1;transition:opacity 1s;`;
      document.body.appendChild(spark);
      setTimeout(() => { spark.style.opacity = '0'; }, 400);
      setTimeout(() => spark.remove(), 1400);
    }, i * 120);
  }
}

// ========================================
// UI INIT
// ========================================

function initUI() {
  const avatar = document.getElementById('avatar');
  if (avatar) {
    avatar.onclick = () => {
      playPurrSound();
      cycleCharacter(1);
    };
    initChildSwipe(avatar);
  }

  const parent = document.getElementById('parentBtn');
  const isGuest = localStorage.getItem('guestMode') === 'true';
  const isChild = localStorage.getItem('childMode') === 'true';
  if (parent && !isChild && !isGuest && localStorage.getItem('userToken')) {
    parent.onclick = () => { window.location.href = '/parent.html'; };
  } else if (parent) {
    parent.style.display = 'none';
  }
}

function initEventListeners() {
  const mic = document.getElementById('micBtn');
  if (mic) {
    let pressTimer = null;
    let activePointer = null;

    const onDown = (e) => {
      if (isMicDisabled() || isProcessing) return;
      if (activePointer !== null) return;
      if (e.type === 'mousedown' && e.button !== 0) return;

      activePointer = e.type === 'touchstart' ? 'touch' : 'mouse';
      bedtimeLongPressArmed = false;
      micPressStartedAt = Date.now();
      e.preventDefault();
      pressTimer = setTimeout(armBedtimeLongPress, 1500);
      beginRecording();
    };

    const onUp = (e) => {
      if (activePointer === 'touch' && e.type === 'mouseup') return;
      if (activePointer === 'mouse' && (e.type === 'touchend' || e.type === 'touchcancel')) return;
      if (activePointer === null) return;

      if (e) e.preventDefault();
      clearTimeout(pressTimer);
      pressTimer = null;
      activePointer = null;
      finishRecording();
    };

    mic.addEventListener('mousedown', onDown);
    mic.addEventListener('mouseup', onUp);
    mic.addEventListener('touchstart', onDown, { passive: false });
    mic.addEventListener('touchend', onUp, { passive: false });
    mic.addEventListener('touchcancel', onUp, { passive: false });
  }

  const games = document.getElementById('gamesBtn');
  if (games) games.onclick = showGamesMenu;

  const feed = document.getElementById('feedBtn');
  if (feed) {
    feed.onclick = () => {
      const stats = getChildStats();
      onFeed(stats);
      saveChildStats(stats);
      animateStat('hungerFill', getTamagotchi(stats).hunger);
      animateStat('moodFill', getTamagotchi(stats).mood);
      trackEvent('feed', getActiveChildName());
      showFeedingAnimation();
    };
  }

  const room = document.getElementById('roomBtn');
  if (room) {
    room.onclick = () => {
      const stats = getChildStats();
      onClean(stats);
      saveChildStats(stats);
      animateStat('energyFill', getTamagotchi(stats).energy);
      trackEvent('clean', getActiveChildName());
      showCleaningAnimation();
    };
  }

  const avatarSection = document.querySelector('.avatar-section');
  if (avatarSection && getChildren().length < 2) {
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
    if (!canAccessCharacter(id)) { count++; continue; }

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
  if (!blob?.size) {
    const liveOnly = getLiveSttText();
    if (liveOnly) {
      clearLiveSttText();
      return { text: liveOnly, fallback: true };
    }
    return { text: '', fallback: true };
  }

  const tryServerStt = async () => {
    let prepared;
    try {
      prepared = await prepareAudioForStt(blob);
    } catch (e) {
      console.warn('Audio prepare for STT failed:', e.message);
      return null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.AUDIO_TIMEOUT);
    const token = localStorage.getItem('userToken');
    const response = await fetch('/api/speech-to-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        audio: prepared.base64,
        contentType: prepared.contentType,
        format: prepared.format,
        sampleRateHz: prepared.sampleRateHz
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.text?.trim()) {
      return { text: data.text.trim(), fallback: false };
    }
    console.warn('STT API empty/fail:', data.error || response.status, data.audioBytes ? `${data.audioBytes} bytes` : '');
    return null;
  };

  try {
    const server = await tryServerStt();
    const serverText = server?.text?.trim() || '';
    const liveText = getLiveSttText().trim();
    clearLiveSttText();

    const pickBest = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      return b.length > a.length ? b : a;
    };
    const text = pickBest(serverText, liveText);
    if (text.length >= 2) {
      console.log('🎤 Распознано:', text);
      return { text, fallback: !serverText || liveText.length > serverText.length };
    }
    if (serverText) return { text: serverText, fallback: false };
  } catch (e) {
    console.warn('STT API fail:', e.message);
    const liveText = getLiveSttText().trim();
    clearLiveSttText();
    if (liveText.length >= 2) {
      return { text: liveText, fallback: true };
    }
  }

  return { text: '', fallback: true };
}

// ========================================
// MICROPHONE
// ========================================

let micEnding = false;
let micStarting = false;
let finishQueued = false;
let bedtimeLongPressArmed = false;
let micPressStartedAt = 0;

async function beginRecording() {
  if (planLimitActive || getStoriesRemaining() <= 0) {
    await handlePlanLimitExceeded();
    return;
  }
  if (isMicDisabled() || isProcessing || isRecording() || micStarting) return;
  if (!isMicrophoneSupported()) {
    await handleMicFailure('not_supported');
    return;
  }
  micStarting = true;
  try {
    await startRecording({
      onAutoStop: () => finishRecording(),
      onStateChange: setMicVisualState
    });
    setAvatarState('listening');
    document.getElementById('avatar')?.classList.add('listening');
    if (finishQueued) {
      finishQueued = false;
      await finishRecordingInternal();
    }
  } catch (e) {
    logError('mic', e.message);
    setMicVisualState('idle');
    await handleMicFailure(e.message);
  } finally {
    micStarting = false;
  }
}

async function finishRecording() {
  if (micEnding || isProcessing) return;
  if (micStarting || !isRecording()) {
    finishQueued = true;
    return;
  }
  await finishRecordingInternal();
}

async function finishRecordingInternal() {
  if (micEnding || !isRecording() || isProcessing) return;
  micEnding = true;
  isProcessing = true;
  setMicVisualState('processing');
  try {
    const audio = await stopRecording();
    if (audio?.size > 0) {
      await processAudio(audio);
    } else {
      await handleMicFailure('empty_blob');
    }
  } catch (e) {
    logError('record', e.message);
  } finally {
    isProcessing = false;
    micEnding = false;
    finishQueued = false;
    setMicVisualState('idle');
    setAvatarState(null);
    updateAvatarMoodState();
    document.getElementById('avatar')?.classList.remove('listening', 'talking');
  }
}

function armBedtimeLongPress() {
  bedtimeLongPressArmed = true;
  console.log('🌙 Активирован режим сказки на ночь (удержание микрофона)');
  const mic = document.getElementById('micBtn');
  mic?.classList.add('mic-bedtime-armed');
}

async function runBedtimeStory(promptText) {
  if (isProcessing) return;
  if (getStoriesRemaining() <= 0) {
    await handlePlanLimitExceeded();
    return;
  }

  isProcessing = true;
  setMicVisualState('processing');
  setAvatarState('eating');
  const child = getActiveChild();
  const childName = getActiveChildName();
  const timeContext = getTimeContext(childName);
  const gender = getChildGender(child);

  try {
    showThinking();
    const aiResult = await generateResponse(promptText, {
      ...getChildContextForAI(),
      requestType: 'bedtime_story',
      timeContext
    });
    hideThinking();
    let reply = typeof aiResult === 'string' ? aiResult : aiResult.text;
    reply = applyGenderToText(sanitizeAIText(reply, child?.age || 7), gender);
    console.log('🐱 Ответ ИИ:', reply.slice(0, 100));

    saveToChildHistory({ role: 'child', text: promptText, timestamp: Date.now(), childName, type: 'bedtime_story' });
    addToContext('child', promptText);
    saveToChildHistory({
      role: 'bot', text: reply, timestamp: Date.now(), type: 'story',
      mood: aiResult.mood || 'positive',
      characterName: CHARACTERS[getCharacter()]?.name || 'Люцик'
    });
    addToContext('bot', reply);

    setAvatarState('speaking');
    await synthesizeSpeech(reply, getCharacter());
    const goodnight = childName !== 'Гость' ? `Сладких снов, ${childName}!` : 'Сладких снов!';
    await synthesizeSpeech(goodnight, getCharacter());

    const stats = getChildStats();
    onChat(stats);
    saveChildStats(stats);
    incrementStories();
    incrementDailyStories();
    checkAchievements();
  } catch (e) {
    logError('bedtime_story', e.message);
  } finally {
    isProcessing = false;
    setMicVisualState('idle');
    setAvatarState(null);
    updateAvatarMoodState();
    updateStatsDisplay();
  }
}

// ========================================
// AUDIO PROCESS
// ========================================

async function handleUserMessage(text, options = {}) {
  const avatar = document.getElementById('avatar');
  const child = getActiveChild();
  const childName = getActiveChildName();
  const timeContext = getTimeContext(childName);
  let requestType = options.forceBedtime ? 'bedtime_story' : detectRequestType(text);
  if (requestType === 'bedtime_story') {
    console.log('🌙 Активирован режим сказки на ночь');
  }
  const isStoryRequest = requestType === 'story' || requestType === 'bedtime_story';

  if (isStoryRequest) {
    if (getStoriesRemaining() <= 0) {
      await synthesizeSpeech('Мы сегодня уже рассказали все сказки! Но можем просто поболтать. О чём хочешь поговорить?', getCharacter());
      return;
    }
  }

  if (checkBadWords(text)) {
    await synthesizeSpeech('Давай говорить добрые слова', getCharacter());
    return;
  }

  saveToChildHistory({ role: 'child', text, timestamp: Date.now(), childName, type: requestType });
  addToContext('child', text);

  const fears = detectFear(text);
  if (fears.length) {
    updateFearStats(fears);
    const stats = getChildStats();
    onFearTalk(stats);
    saveChildStats(stats);
  }

  const alerts = detectAlertWords(text);
  if (alerts.length) {
    trackEvent('alert', alerts.join(','));
    saveAlertForParent(text, alerts, 'child');
  }

  const dictFallback = getDictionaryFallback(text, childName, timeContext, getChildGender(child));
  let reply;
  let responseType = requestType;
  let aiMood = null;

  if (avatar) {
    avatar.classList.add('talking');
    setAvatarState('listening');
    playPurrSound();
  }

  showThinking();
  let aiResult = null;
  try {
    console.log('🤖 Отправлено в ИИ:', text);
    aiResult = await generateResponse(text, {
      ...getChildContextForAI(),
      requestType,
      timeContext
    });
    reply = typeof aiResult === 'string' ? aiResult : aiResult.text;
    responseType = aiResult.type || requestType;
    aiMood = aiResult.mood || null;
    if (typeof aiResult === 'object' && aiResult) {
      if (aiResult.childName || aiResult.childAge != null) {
        saveDetectedProfile({ childName: aiResult.childName, childAge: aiResult.childAge });
      }
      if (aiResult.concerns?.length) saveParentConcerns(aiResult.concerns);
    }
    if (!aiResult.fromApi && dictFallback) {
      reply = dictFallback;
      console.log('📖 Словарь (API недоступен):', reply.slice(0, 100));
    } else {
      learnFromResponse(text, reply);
    }
  } finally {
    hideThinking();
  }

  if (!reply && dictFallback) {
    reply = dictFallback;
  }

  console.log('🐱 Ответ ИИ:', (reply || '').slice(0, 100));

  if (globalThis.__lastAiMs) applyAiTiming();
  reply = applyGenderToText(sanitizeAIText(reply, child?.age || 7), getChildGender(child));

  const botAlerts = detectAlertWords(reply);
  const botPersonal = detectPersonalData(reply);
  const isSuspicious = botAlerts.length > 0 || botPersonal.length > 0;

  const replyFears = extractFearsFromText(reply);
  const allFears = [...new Set([...fears, ...replyFears])];
  if (replyFears.length) updateFearStats(replyFears);

  saveToChildHistory({
    role: 'bot',
    text: reply,
    timestamp: Date.now(),
    type: responseType,
    mood: aiMood,
    characterName: CHARACTERS[getCharacter()]?.name || 'Люцик',
    alerted: isSuspicious,
    alertWords: [...botAlerts, ...botPersonal]
  });
  addToContext('bot', reply);
  if (isSuspicious) saveAlertForParent(reply, [...botAlerts, ...botPersonal], 'ai');

  const stats = getChildStats();
  onChat(stats);
  saveChildStats(stats);

  setAvatarState('speaking');
  await synthesizeSpeech(reply, getCharacter());
  setAvatarState(null);
  updateAvatarMoodState();

  if (requestType === 'bedtime_story') {
    const goodnight = childName !== 'Гость' ? `Сладких снов, ${childName}!` : 'Сладких снов!';
    await synthesizeSpeech(goodnight, getCharacter());
    incrementStories();
    incrementDailyStories();
    if (getStoriesRemaining() <= 0) showPlanLimitUI(true);
    checkAchievements();
    updateStatsDisplay();
    return;
  }

  if (shouldSuggestFearGame(allFears)) {
    await synthesizeSpeech(getFearGameSuggestion(allFears[0]), getCharacter());
  }
  if (responseType === 'story' || requestType === 'story' || reply.length > 120) {
    incrementStories();
    incrementDailyStories();
  }
  if (getStoriesRemaining() <= 0) showPlanLimitUI(true);
  checkAchievements();
  updateStatsDisplay();
}

async function processAudio(audioBlob) {
  const avatar = document.getElementById('avatar');
  const longPressBedtime = bedtimeLongPressArmed;
  bedtimeLongPressArmed = false;
  document.getElementById('micBtn')?.classList.remove('mic-bedtime-armed');

  try {
    if (audioBlob.size < 500) {
      console.warn('🎙️ Audio blob too small:', audioBlob.size);
      if (longPressBedtime) {
        console.log('🌙 Активирован режим сказки на ночь');
        await runBedtimeStory('Расскажи сказку на ночь');
        return;
      }
      await handleMicFailure('empty_blob');
      return;
    }
    const stt = await recognizeSpeech(audioBlob);
    let text = stt.text?.trim();
    if (!text && typeof window.browserSpeechRecognition === 'function') {
      console.log('🎙️ Trying browser STT fallback...');
      text = (await window.browserSpeechRecognition()).trim();
    }
    console.log('🎤 Распознано:', text || '(пусто)');

    if (!text) {
      if (longPressBedtime) {
        console.log('🌙 Активирован режим сказки на ночь');
        await runBedtimeStory('Расскажи сказку на ночь');
        return;
      }
      await handleMicFailure('stt_empty');
      return;
    }

    resetMicFailCount();

    if (longPressBedtime && !isBedtimeStoryRequest(text)) {
      console.log('🌙 Long press + речь → обычный диалог:', text);
      await handleUserMessage(text);
      return;
    }

    if (longPressBedtime || isBedtimeStoryRequest(text)) {
      console.log('🌙 Активирован режим сказки на ночь');
      await handleUserMessage(text, { forceBedtime: true });
      return;
    }

    await handleUserMessage(text);
  } catch (e) {
    logError('process_audio', e.message);
    await handleMicFailure('process_error');
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
  const gameList = Object.entries(GAMES).map(([id, g]) => {
    const lvl = getGameLevel(id);
    return { id, label: `${g.icon} ${g.name} · Ур.${lvl}` };
  });

  const buttonsHtml = gameList.map(({ id, label }) => {
    const lockedPlan = !canAccessGame(id);
    const lockedAge = !isGameAgeAppropriate(id);
    const locked = lockedPlan || lockedAge;
    const reason = lockedAge && !lockedPlan ? ' (другой возраст)' : '';
    return `<button class="modal-btn${locked ? ' disabled' : ''}" data-game="${id}" ${locked ? 'data-locked="1"' : ''}>${label}${locked ? ' 🔒' : ''}${reason}</button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="games-menu-box">
      <h2 style="margin:0 0 16px;">🎮 Выбери игру</h2>
      <div class="games-menu-grid">
        ${buttonsHtml}
      </div>
      <button class="modal-btn secondary games-menu-close" data-game="close">✕ Закрыть</button>
    </div>`;

  const games = {
    fish: startFishGame,
    memory: startMemoryGame,
    puzzle: startPuzzleGame,
    riddles: startRiddlesGame,
    quest: startQuestGame,
    maze: startMazeGame,
    quiz: startQuizGame
  };

  overlay.querySelectorAll('[data-game]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.game;
      overlay.remove();
      if (id === 'close') return;
      if (btn.dataset.locked === '1') {
        synthesizeSpeech('Эта игра доступна в полной версии. Попроси родителей открыть доступ!', getCharacter()).catch(() => {});
        return;
      }
      incrementGames();
      updateStatsDisplay();
      const lvl = getGameLevel(id);
      games[id]?.(lvl);
      checkAchievements();
      trackEvent('game_selected', id);
    };
  });

  document.body.appendChild(overlay);
}

export function launchFishGame() {
  incrementGames();
  startFishGame(getGameLevel('fish'));
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
  loadState: loadState, cycleCharacter, showGamesMenu, launchFishGame,
  getUserPlan, getStoriesRemaining, canAccessCharacter, canAccessGame, resetDailyCounters
};
