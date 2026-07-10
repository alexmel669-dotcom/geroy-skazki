// ========================================
// core.js — ЯДРО ПРИЛОЖЕНИЯ «ГЕРОЙ СКАЗОК»
// v5.4.3
// ========================================

import { CONFIG, CHARACTERS, FALLBACK_REPLIES, PLANS, GAMES, migrateFearStatsObject, avatarImgHtml, assetUrl, initAvatarImages } from './config.js';
import { getChildGender, guessGenderFromName, normalizeGender, applyGenderToText, gladToSeePhrase } from './gender.js';
import {
  generateResponse, detectFear, detectPersonalData,
  setCharacter, getCharacter, addToContext, clearContext,
  loadChatHistory, setChatChild, extractFearsFromText,
  shouldSuggestFearGame, getFearGameSuggestion
} from './ai.js';
import {
  startRecording, stopRecording, cancelRecording, isRecording, getRecordingMimeType,
  isMicrophoneSupported, prepareAudioForStt, getLiveSttText, clearLiveSttText,
  getMicState, setMicState, startMicSession, finishMicSession, onMicProcessingDone,
  isProcessingLocked, releaseMicrophone, onMicError, armRecordingFromUser, disarmRecordingFromUser,
  incrementMicFailCount, resetMicFailCount as resetMicSttFailCount, checkMicFailFallback,
  disableBrowserSttOnly, isBrowserSttEnabled, isAndroid
} from './mic.js';
import { getAgeWord } from './grammar.js';
import { synthesizeSpeech } from './audio.js';
import { checkAchievements, showAchievement } from './achievements.js';
import { trackEvent, logError } from './analytics.js';
import { getEasterEggReply } from './easter-eggs.js';
import { initSecurity, checkBadWords, sanitizeInput, sanitizeAIText, detectAlertWords } from './security.js';
import { startFishGame } from './games/fish.js';
import { startMemoryGame } from './games/memory.js';
import { startPuzzleGame } from './games/puzzle.js';
import { startRiddlesGame } from './games/riddles.js';
import { startQuestGame } from './games/quest.js';
import { startMazeGame } from './games/maze.js';
import { startQuizGame } from './games/quiz.js';
import { startRunnerGame } from './games/runner.js';
import { startDrawAIGame } from './games/draw-ai.js';
import { startMusicCatGame } from './games/music-cat.js';
import { startConstellationGame } from './games/constellation.js';
import { startPopFearsGame } from './games/pop-fears.js';
import { getGameLevel, createConfetti, resetGameSession } from './games/game-ui.js';
import { setAvatarState, playPurrSound, switchCharacter, showMicHint, showGamesHint, showSwipeHint } from './ui.js';
import { getTimeContext } from './context.js';
import { detectRequestType, getDictionaryFallback, learnFromResponse, getLearnedDictionary, isBedtimeStoryRequest } from './dictionary.js';
import { checkDailyStreak, updateStreakUI } from './retention.js';
import { addXP, updateXPBar } from './progression.js';
import {
  getTamagotchi, applyTamagotchiTick, onChat, onGame, onFeed, onClean, onFearTalk,
  getTamagotchiNeedsMessage
} from './tamagotchi.js';
import { updateHouseButton } from './lucik-house.js';

// ========================================
// STATE
// ========================================

let activeChildIndex = -1;
let isProcessing = false;

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
  if (localStorage.getItem('guestMode') === 'true') return true;
  const child = getActiveChild();
  if (!child?.age) {
    const stored = parseInt(localStorage.getItem('profileChildAge') || '0', 10);
    if (!stored) return true;
  }
  const age = getChildAgeForGames();
  return age >= game.ages[0] && age <= game.ages[1];
}

export function onGameClose() {
  document.body.classList.remove('game-active');
  appState.gameActive = false;
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
  if (childName && childAge != null && (children.length === 0 || getActiveChildName() === 'Гость')) {
    const ageNum = parseInt(childAge, 10) || 5;
    gender = guessGenderFromName(childName);
    const avatarRole = getAvatarRoleForChild({ gender, name: childName });
    const avatar = `${avatarRole}.svg`;
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
          children[idx].avatarRole = getAvatarRoleForChild({ ...children[idx], gender: g });
          children[idx].avatar = `${children[idx].avatarRole}.svg`;
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
  const isGuest = isGuestUser();
  if (child?.name && child.name !== 'Гость') {
    return {
      name: child.name,
      age: child.age || parseInt(profileAge, 10) || null,
      gender,
      isGuest: false
    };
  }
  if (isGuest && !profileName) {
    return { name: null, age: null, gender: 'unknown', isGuest: true };
  }
  const name = profileName || null;
  return {
    name,
    age: profileAge ? parseInt(profileAge, 10) : null,
    gender: gender !== 'unknown' ? gender : guessGenderFromName(name),
    isGuest
  };
}

export function isGuestUser() {
  return localStorage.getItem('guestMode') === 'true'
    || getActiveChildIndex() < 0
    || getActiveChildName() === 'Гость';
}

export function getCurrentUser() {
  const child = getActiveChild();
  const profileName = localStorage.getItem('profileChildName') || '';
  const profileAgeRaw = localStorage.getItem('profileChildAge');
  const isGuest = isGuestUser();
  let childName = null;
  let childAge = null;
  let childGender = 'unknown';

  if (child?.name && child.name !== 'Гость') {
    childName = child.name;
    childAge = child.age ?? null;
    childGender = getChildGender(child);
  } else if (profileName) {
    childName = profileName;
    childAge = profileAgeRaw ? parseInt(profileAgeRaw, 10) : null;
    childGender = guessGenderFromName(profileName);
  }

  const storedParentGender = normalizeGender(localStorage.getItem('parentGender'));
  const parentGender = storedParentGender !== 'unknown'
    ? storedParentGender
    : guessGenderFromName(localStorage.getItem('parentName') || '');

  let role = 'guest';
  if (!isGuest && child) role = 'child';
  else if (localStorage.getItem('userRole') === 'parent') role = 'parent';

  return {
    isGuest,
    role,
    gender: parentGender,
    childName,
    childAge,
    childGender,
    profileComplete: localStorage.getItem('profileComplete') === 'true'
  };
}

export function getAvatarForUser(user) {
  if (!user) return 'lucik';
  if (user.isGuest || user.role === 'guest') return 'lucik';
  if (user.role === 'parent') {
    return user.gender === 'female' ? 'mom' : 'dad';
  }
  if (user.childGender === 'female') return 'kid1';
  if (user.childGender === 'male') return 'kid2';
  return 'lucik';
}

export function getUserCharacter(user) {
  const id = getAvatarForUser(user);
  setCharacter(id);
  localStorage.setItem('currentCharacter', id);
  switchCharacter(id);
  console.log('👤 Персонаж по пользователю:', id);
  return id;
}

function extractGuestName(text) {
  const skip = new Set(['меня', 'зовут', 'называют', 'я', 'это', 'привет', 'кот', 'люцик', 'меня зовут']);
  const lower = text.toLowerCase();
  const named = lower.match(/(?:меня\s+зовут|зовут\s+меня|я\s+)([а-яё]{2,15})/i);
  if (named?.[1]) return named[1].charAt(0).toUpperCase() + named[1].slice(1);
  const words = text.match(/\b([А-ЯЁ][а-яё]{1,15})\b/g);
  if (!words) return text.trim().slice(0, 20) || null;
  for (const w of words) {
    if (!skip.has(w.toLowerCase())) return w;
  }
  return words[words.length - 1];
}

function extractGuestAge(text) {
  const match = text.match(/\b(\d{1,2})\b/);
  if (!match) return null;
  const age = parseInt(match[1], 10);
  return age >= 3 && age <= 14 ? age : null;
}

async function handleGuestIntroduction(text) {
  const user = getCurrentUser();
  if (!user.isGuest) return false;
  if (user.childName && user.childAge) return false;

  const profileName = localStorage.getItem('profileChildName');
  const profileAge = localStorage.getItem('profileChildAge');

  if (!profileName && !user.childName) {
    const name = extractGuestName(text);
    if (!name) return false;
    localStorage.setItem('profileChildName', name);
    localStorage.setItem('profileComplete', 'partial');
    saveDetectedProfile({ childName: name, childAge: null });
    refreshGuestLabel();
    updateTextInputVisibility();
    await synthesizeSpeech(`Очень приятно, ${name}! А сколько тебе лет?`, getCharacter());
    return true;
  }

  if (!profileAge && !user.childAge) {
    const age = extractGuestAge(text);
    if (!age) return false;
    const name = profileName || user.childName;
    localStorage.setItem('profileChildAge', String(age));
    localStorage.setItem('profileComplete', 'true');
    saveDetectedProfile({ childName: name, childAge: age });
    refreshGuestLabel();
    updateTextInputVisibility();
    const ageWord = getAgeWord(age);
    await synthesizeSpeech(`${age} ${ageWord} — это здорово! Теперь расскажи, что тебе интересно?`, getCharacter());
    return true;
  }

  return false;
}

export function updateTextInputVisibility() {
  const user = getCurrentUser();
  const age = user.childAge || 0;
  const row = document.querySelector('.text-chat-row');
  if (row) {
    row.style.display = age >= 7 ? 'flex' : 'none';
  }
}

function refreshGuestLabel() {
  const label = document.getElementById('childNameLabel');
  const user = getCurrentUser();
  if (!label) return;
  if (user.childName && user.childAge) {
    label.textContent = `${user.childName}, ${user.childAge} лет`;
  } else if (user.childName) {
    label.textContent = user.childName;
  }
}

export async function playWelcomeGreeting() {
  const modal = document.getElementById('childSelectModal');
  if (modal?.style.display === 'flex') return;
  if (localStorage.getItem('ob-done') !== '1' && localStorage.getItem('geroy-onboarding-done') !== 'true') return;

  const user = getCurrentUser();
  const timeContext = getTimeContext(user.childName || '');

  if (user.childName && user.childAge) {
    const greeting = timeContext.greeting.replace(user.childName, user.childName);
    await synthesizeSpeech(greeting, getCharacter());
  } else if (user.isGuest || !user.profileComplete) {
    await synthesizeSpeech('Привет! Я кот Люцик. Давай познакомимся! Как тебя зовут?', getCharacter());
  }
}

function childAvatarImg(role, gender) {
  const resolved = role || getAvatarRoleForChild({ gender });
  const map = { kid1: 'kid1', kid2: 'kid2', lucik: 'lucik' };
  return avatarImgHtml(map[resolved] || 'lucik', 36);
}

function updateGuestLabel(child) {
  const label = document.getElementById('childNameLabel') || document.getElementById('guestLabel');
  if (!label) return;
  if (!child) {
    label.textContent = 'Гость';
    return;
  }
  const age = child.age || child.childAge || '';
  const ageWord = getAgeWord(age || 7);
  label.textContent = `${child.name || child.childName || 'Гость'}${age ? `, ${age} ${ageWord}` : ''}`;
}

function showPlanLimitUI(show) {
  planLimitActive = show;
  const bar = document.getElementById('planLimitBar');
  const micBtn = document.getElementById('micButton') || document.getElementById('mic-button');
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


function setMicVisualState(state) {
  setMicState(state || 'idle');
  const micBtn = document.getElementById('micButton') || document.getElementById('mic-button');
  if (!micBtn) return;
  if (state === 'idle' || !state) {
    micBtn.disabled = isMicDisabled();
    if (isMicDisabled()) micBtn.classList.add('mic-disabled');
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

let micDisabledUntil = 0;

function isMicDisabled() {
  return Date.now() < micDisabledUntil;
}

function resetMicFailCount() {
  resetMicSttFailCount();
}

async function handleMicFailure(reason) {
  console.warn('🎙️ Mic failure:', reason);
  onMicError(reason);
  const count = incrementMicFailCount();
  if (count >= 2) {
    disableBrowserSttOnly();
  }
  if (count >= 3) {
    checkMicFailFallback();
    return;
  }
  const idx = Math.min(count - 1, MIC_RETRY_PHRASES.length - 1);
  await synthesizeSpeech(MIC_RETRY_PHRASES[idx], getCharacter());
}

// ========================================
// APP READY (после splash)
// ========================================

let appReady = false;

export function isAppReady() {
  return appReady;
}

function syncGeroyUser() {
  const child = getActiveChild();
  const existing = JSON.parse(localStorage.getItem('geroy-user') || '{}');
  if (child?.name) {
    localStorage.setItem('geroy-user', JSON.stringify({
      ...existing,
      childName: child.name,
      childAge: child.age,
      birthday: child.birthday || existing.birthday || null
    }));
  }
}

export function checkBirthday() {
  const user = JSON.parse(localStorage.getItem('geroy-user') || '{}');
  if (!user?.birthday) return;

  const todayKey = new Date().toISOString().split('T')[0];
  if (localStorage.getItem('geroy-birthday-shown') === todayKey) return;

  const today = new Date();
  const bday = new Date(user.birthday);
  if (today.getMonth() !== bday.getMonth() || today.getDate() !== bday.getDate()) return;

  localStorage.setItem('geroy-birthday-shown', todayKey);
  const age = today.getFullYear() - bday.getFullYear();
  window.ttsEngine?.speak(`С днём рождения, ${user.childName}! Тебе ${age} ${getAgeWord(age)}!`);

  createConfetti(document.body);

  const streak = JSON.parse(localStorage.getItem('geroy-streak') || '{}');
  streak.stars = (streak.stars || 0) + 50;
  localStorage.setItem('geroy-streak', JSON.stringify(streak));
  updateStreakUI();
}

export function claimDailyGift() {
  const today = new Date().toISOString().split('T')[0];
  if (localStorage.getItem('geroy-gift-date') === today) {
    window.ttsEngine?.speak('Ты уже получил подарок сегодня!');
    return;
  }

  const gifts = ['⭐ +5', '🌟 +10', '💎 +1', '🎁 сюрприз'];
  const gift = gifts[Math.floor(Math.random() * gifts.length)];
  localStorage.setItem('geroy-gift-date', today);

  const streak = JSON.parse(localStorage.getItem('geroy-streak') || '{}');
  streak.stars = (streak.stars || 0) + parseInt(gift.match(/\d+/)?.[0] || '5', 10);
  localStorage.setItem('geroy-streak', JSON.stringify(streak));
  updateStreakUI();

  window.ttsEngine?.speak(`Твой подарок: ${gift}!`);
}

export function playLullaby() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    window.ttsEngine?.speak('Сладких снов...');
    return;
  }

  const ctx = new AudioCtx();
  const notes = [523, 494, 440, 494, 523, 440];
  let t = ctx.currentTime;

  notes.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.start(t);
    osc.stop(t + 0.5);
    t += 0.5;
  });

  setTimeout(() => {
    const purr = new Audio('assets/audio/purr.mp3');
    purr.loop = true;
    purr.volume = 0.3;
    purr.play().catch(() => playPurrSound());
    setTimeout(() => {
      purr.pause();
      window.ttsEngine?.speak('Сладких снов...');
    }, 8000);
  }, t * 1000);
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') console.log('🔔 Notifications allowed');
    });
  }
}

export function sendTestNotification() {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification('Герой Сказок', {
        body: 'Люцик ждёт тебя!',
        icon: 'assets/images/icon-192.png',
        vibrate: [200, 100, 200]
      });
    }).catch(() => {});
  }
}

function onAppReady() {
  if (appReady) return;
  appReady = true;
  console.log('🟢 App ready');

  syncGeroyUser();
  checkBirthday();

  setTimeout(() => {
    playWelcomeGreeting().catch((err) => console.warn('Welcome failed:', err));
  }, 500);

  setTimeout(() => {
    const checkVoice = setInterval(() => {
      if (!window.ttsEngine?.isSpeaking) {
        clearInterval(checkVoice);
        checkEveningMode();
      }
    }, 500);
  }, 3000);

  setTimeout(requestNotificationPermission, 3000);

  setTimeout(() => {
    if (!window.ttsEngine?.isSpeaking) {
      showMicHint();
      showGamesHint();
    }
  }, 5000);

  updateFeedButton();
  updateHouseButton();
  setInterval(() => {
    updateFeedButton();
    updateHouseButton();
  }, 60000);
}

function getTodayDialogs() {
  const history = getChildStats().history || [];
  const today = new Date().toDateString();
  return history
    .filter((h) => h.timestamp && new Date(h.timestamp).toDateString() === today)
    .filter((h) => h.role === 'child' || h.role === 'user')
    .map((h) => ({ question: h.text || '', mood: h.mood }));
}

function getAverageMood(dialogs) {
  if (!dialogs.length) return 'хорошее';
  const moods = dialogs.map((d) => d.mood).filter(Boolean);
  if (!moods.length) return 'хорошее';
  const positive = moods.filter((m) => m === 'positive' || m === 'happy').length;
  const concerned = moods.filter((m) => m === 'concerned' || m === 'anxious').length;
  if (concerned > positive) return 'встревоженное';
  if (positive > moods.length / 2) return 'радостное';
  return 'спокойное';
}

async function checkEveningMode() {
  const hour = new Date().getHours();
  if (hour < 20 || hour > 23) return;
  if (localStorage.getItem('geroy-evening-shown') === new Date().toISOString().split('T')[0]) return;

  const user = getCurrentUser();
  const age = user.childAge || 7;

  if (age <= 8) {
    await synthesizeSpeech('Уже поздно. Я расскажу тебе сказку на ночь.', getCharacter());
    setTimeout(() => {
      generateEveningStory().catch((err) => console.warn('Evening story failed:', err));
    }, 2000);
  } else {
    await synthesizeSpeech('Давай подведём итоги дня! О чём мы сегодня говорили? Хочешь послушать весёлую историю о себе?', getCharacter());
    await generateDaySummary();
  }

  localStorage.setItem('geroy-evening-shown', new Date().toISOString().split('T')[0]);
}

async function generateEveningStory() {
  const user = getCurrentUser();
  const age = user.childAge || 7;
  if (getStoriesRemaining() <= 0) return;

  const todayDialogs = getTodayDialogs();
  const mood = getAverageMood(todayDialogs);
  const childName = user.childName || 'малыш';

  const prompt = `
Сочини короткую спокойную сказку на ночь (2-3 минуты) для ${childName} (${age} лет).
Настроение за день: ${mood}.
${todayDialogs.length ? 'Темы дня: ' + todayDialogs.slice(-3).map((d) => d.question).join('; ') : ''}
Заканчивается спокойно и умиротворяюще.`.trim();

  try {
    const aiResult = await generateResponse(prompt, {
      ...getChildContextForAI(),
      requestType: 'bedtime_story',
      childName,
      childAge: age
    });
    const story = typeof aiResult === 'string' ? aiResult : aiResult.text;
    if (!story) return;

    const child = getActiveChild();
    const reply = applyGenderToText(sanitizeAIText(story, age), getChildGender(child));
    await synthesizeSpeech(reply, getCharacter());
    incrementStories();
    incrementDailyStories();
    window.storybook?.add('Сказка на ночь', reply);
  } catch (e) {
    console.warn('Evening story failed:', e);
  }
}

async function generateDaySummary() {
  const user = getCurrentUser();
  const todayDialogs = getTodayDialogs();

  if (!todayDialogs.length) return;

  const topics = todayDialogs.map((d) => d.question).join('; ');
  const mood = getAverageMood(todayDialogs);

  try {
    const token = localStorage.getItem('userToken');
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        message: `Ребёнок ${user.childName || 'герой'} (${user.childAge || 7} лет) сегодня говорил о: ${topics}.
Настроение: ${mood}.
Сочини короткую весёлую историю о сегодняшнем дне от лица ребёнка.
Как будто это он сам рассказывает другу. Весело, но без насмешек.`,
        requestType: 'chat',
        childName: user.childName,
        childAge: user.childAge
      })
    });

    const data = await res.json();
    const text = data.message || data.text;
    if (text) await synthesizeSpeech(text, getCharacter());
  } catch (e) {
    console.warn('Day summary failed:', e);
  }
}

function waitForAppReady() {
  const splash = document.getElementById('splashOverlay');
  if (!splash) {
    onAppReady();
    return;
  }

  let scheduled = false;
  const finish = () => {
    if (scheduled) return;
    scheduled = true;
    clearInterval(checkSplash);
    setTimeout(onAppReady, 300);
  };

  window.addEventListener('appReady', finish, { once: true });

  const checkSplash = setInterval(() => {
    const el = document.getElementById('splashOverlay');
    if (!el || el.style.opacity === '0') {
      finish();
    }
  }, 200);
}

// ========================================
// INIT
// ========================================

function initAvatar() {
  const avatar = document.getElementById('avatar');
  const emoji = document.getElementById('avatarEmoji');
  if (emoji) emoji.style.display = 'none';
  if (avatar) {
    avatar.style.display = 'block';
    avatar.onerror = null;
  }
}

export function initCore() {
  console.log('🔵 initCore started');
  initSecurity();
  migrateAllStoredStats();
  activeChildIndex = getActiveChildIndex();
  appState.currentChildIndex = activeChildIndex;
  loadState();
  initUI();
  initEventListeners();
  setupCharacterSwipe();
  initAvatar();
  checkChildSelection();
  setChatChild(getActiveChildName());
  loadChatHistory(getActiveChildName());
  updateStatsDisplay();
  updateXPBar();
  updateTextInputVisibility();
  resetDailyCounters();
  if (getStoriesRemaining() <= 0) showPlanLimitUI(true);
  updateAvatarMoodState();
  setMicVisualState('idle');
  if (typeof window !== 'undefined' && window.tamagotchi?.start) {
    window.tamagotchi.start();
  }

  checkDailyStreak();
  updateStreakUI();
  syncGeroyUser();
  localStorage.setItem('geroy-last-visit', new Date().toISOString());

  console.log(`🟢 Герой Сказок v${CONFIG.APP_VERSION} готов к работе`);

  waitForAppReady();

  if (tamagotchiTimer) clearInterval(tamagotchiTimer);
  tamagotchiTimer = setInterval(() => {
    const stats = getChildStats();
    applyTamagotchiTick(stats);
    saveChildStats(stats);
    updateStatsDisplay();
    const needMsg = getTamagotchiNeedsMessage(stats);
    if (needMsg && getMicState() === 'idle' && !appState.gameActive) {
      synthesizeSpeech(needMsg, getCharacter()).catch(() => {});
    }
  }, 60000);
}

// ========================================
// CHILDREN
// ========================================

function resolveChildGenderExplicit(child) {
  if (!child) return 'unknown';
  const g = normalizeGender(child.gender);
  if (g !== 'unknown') return g;
  return guessGenderFromName(child.name);
}

/** Аватар ребёнка: мальчик → kid2, девочка → kid1, неизвестно → lucik */
export function getAvatarRoleForChild(child) {
  if (!child) return 'lucik';
  const gender = resolveChildGenderExplicit(child);
  if (gender === 'male') return 'kid2';
  if (gender === 'female') return 'kid1';
  return 'lucik';
}

/** Персонаж по умолчанию для ребёнка (не переключает автоматически при выборе) */
export function getDefaultCharacterForChild(child) {
  return getAvatarRoleForChild(child);
}

function normalizeChildRecord(child) {
  if (!child || typeof child !== 'object') return child;
  const gender = resolveChildGenderExplicit(child);
  const avatarRole = gender === 'male' ? 'kid2' : gender === 'female' ? 'kid1' : (child.avatarRole || 'lucik');
  const out = { ...child, avatarRole, avatar: `${avatarRole}.svg` };
  if (child.birthday) out.birthday = child.birthday;
  if (gender !== 'unknown') out.gender = gender;
  return out;
}

export function getChildren() {
  const raw = safeParseJSON(localStorage.getItem('children') || '[]', []);
  const normalized = raw.map(normalizeChildRecord);
  if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
    localStorage.setItem('children', JSON.stringify(normalized));
  }
  return normalized;
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
  const prevIndex = activeChildIndex >= 0 ? activeChildIndex : getActiveChildIndex();
  activeChildIndex = index;
  appState.currentChildIndex = index;
  localStorage.setItem('activeChildIndex', String(index));

  const child = getChildren()[index];

  if (prevIndex !== index) clearContext();
  getUserCharacter(getCurrentUser());

  if (child) {
    updateGuestLabel(child);
  } else {
    updateGuestLabel(null);
  }

  trackEvent('child_select', child?.name || 'guest');
  setChatChild(child?.name || 'guest');
  loadChatHistory(child?.name || 'guest');
  syncGeroyUser();

  if (options.greet && child?.name) {
    const gender = getChildGender(child);
    synthesizeSpeech(`Привет, ${child.name}! ${gladToSeePhrase(gender)}`, getCharacter()).catch(() => {});
  }

  updateXPBar();
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
      ${childAvatarImg(c.avatarRole, c.gender)}<span>${sanitizeInput(c.name)}, ${c.age} лет</span></button>`;
  }).join('');
  initAvatarImages();

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
  localStorage.setItem('guestMode', 'true');
  setActiveChild(-1);
  const modal = document.getElementById('childSelectModal');
  if (modal) modal.style.display = 'none';
  updateStatsDisplay();
  updateTextInputVisibility();
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
  updateXPBar();
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

// ========================================
// UI INIT
// ========================================

function initUI() {
  const avatar = document.getElementById('avatar');
  if (avatar) {
    avatar.onclick = () => playPurrSound();
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

function isAssistantSpeaking() {
  return window.ttsEngine?.isSpeaking === true;
}

export function getHungerLevel() {
  const lastFed = localStorage.getItem('geroy-last-fed');
  if (!lastFed) return 99;
  return Math.floor((Date.now() - new Date(lastFed)) / 3600000);
}

export function updateFeedButton() {
  const btn = document.getElementById('feedBtn');
  if (!btn) return;

  const hours = getHungerLevel();

  if (hours > 8) {
    btn.textContent = '🍎😿';
    btn.style.animation = 'hungerShake 0.5s infinite';
    const warnKey = 'geroy-hunger-warned-' + new Date().toISOString().split('T')[0];
    if (!localStorage.getItem(warnKey)) {
      window.ttsEngine?.speak('Я проголодался! Покорми меня, пожалуйста!');
      localStorage.setItem(warnKey, '1');
    }
  } else if (hours > 4) {
    btn.textContent = '🍎😐';
    btn.style.animation = '';
  } else {
    btn.textContent = '🍎😊';
    btn.style.animation = '';
  }
}

export function feedLucik() {
  performFeedLucik();
}

function spawnCrumbs(element) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  for (let i = 0; i < 8; i++) {
    const crumb = document.createElement('div');
    crumb.textContent = '🍪';
    const dx = Math.random() * 60 - 30;
    const rot = Math.random() * 360;
    const dur = 0.5 + Math.random();
    crumb.style.cssText = `position:fixed;left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;font-size:12px;z-index:2000;pointer-events:none;animation:crumbFall ${dur}s ease-out forwards;--crumb-dx:${dx}px;--crumb-rot:${rot}deg;`;
    document.body.appendChild(crumb);
    setTimeout(() => crumb.remove(), 1500);
  }
}

export function performFeedLucik() {
  const avatar = document.getElementById('avatar');
  avatar?.classList.add('avatar-eating');
  spawnCrumbs(avatar);

  const stats = getChildStats();
  onFeed(stats);
  saveChildStats(stats);
  animateStat('hungerFill', getTamagotchi(stats).hunger);
  animateStat('moodFill', getTamagotchi(stats).mood);
  trackEvent('feed', getActiveChildName());

  localStorage.setItem('geroy-last-fed', new Date().toISOString());
  updateFeedButton();
  window.ttsEngine?.speak('Ням-ням! Спасибо, очень вкусно!');

  setTimeout(() => {
    avatar?.classList.remove('avatar-eating');
    avatar?.classList.add('avatar-happy');
    setTimeout(() => avatar?.classList.remove('avatar-happy'), 2000);
  }, 2000);
}

export function performCleanLucikRoom() {
  const stats = getChildStats();
  onClean(stats);
  saveChildStats(stats);
  animateStat('energyFill', getTamagotchi(stats).energy);
  trackEvent('clean', getActiveChildName());
}

function initEventListeners() {
  const mic = document.getElementById('micButton') || document.getElementById('mic-button');
  if (mic) {
    let activePointer = null;

    const onDown = (e) => {
      if (getMicState() === 'processing' || isProcessingLocked() || isMicDisabled() || isAssistantSpeaking()) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (activePointer !== null) return;
      if (e.type === 'mousedown' && e.button !== 0) return;

      if (document.getElementById('splashOverlay') && typeof window.skipSplash === 'function') {
        window.skipSplash();
      }

      activePointer = e.type === 'touchstart' ? 'touch' : 'mouse';
      e.preventDefault();
      beginRecording();
    };

    const onUp = (e) => {
      if (activePointer === 'touch' && e.type === 'mouseup') return;
      if (activePointer === 'mouse' && (e.type === 'touchend' || e.type === 'touchcancel')) return;
      if (activePointer === null) return;

      if (e) e.preventDefault();
      activePointer = null;
      finishRecording();
    };

    mic.addEventListener('mousedown', onDown);
    mic.addEventListener('mouseup', onUp);
    mic.addEventListener('mouseleave', onUp);
    mic.addEventListener('touchstart', onDown, { passive: false });
    mic.addEventListener('touchend', onUp, { passive: false });
    mic.addEventListener('touchcancel', onUp, { passive: false });
  }

  window.addEventListener('blur', () => {
    if (isRecording() || getMicState() === 'recording') {
      finishRecording();
      releaseMicrophone();
    }
  });

  window.addEventListener('beforeunload', () => {
    releaseMicrophone();
  });
}

function setupCharacterSwipe() {
  const avatar = document.getElementById('avatar');
  if (!avatar || avatar.dataset.characterSwipe === '1') return;

  let startX = 0;
  let isSwiping = false;

  function onStart(x) {
    startX = x;
    isSwiping = true;
  }

  function onEnd(x) {
    if (!isSwiping) return;
    isSwiping = false;
    if (Math.abs(x - startX) > 50) {
      cycleActiveChild(x - startX > 0 ? -1 : 1);
    }
  }

  avatar.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onStart(e.clientX);
  });

  document.addEventListener('mouseup', (e) => onEnd(e.clientX));

  avatar.addEventListener('touchstart', (e) => {
    onStart(e.touches[0].clientX);
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (e.changedTouches?.[0]) onEnd(e.changedTouches[0].clientX);
  });

  avatar.dataset.characterSwipe = '1';
  console.log('🔄 Child swipe ready');
}

function cycleActiveChild(direction) {
  const children = getChildren();
  if (children.length < 2) return;

  let idx = getActiveChildIndex();
  if (idx < 0) idx = 0;

  idx = (idx + direction + children.length) % children.length;
  setActiveChild(idx, { greet: true });
  playPurrSound();
}

function loadState() {
  getUserCharacter(getCurrentUser());
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
  const tryServerStt = async (audioBlob = blob) => {
    if (!audioBlob?.size) return null;
    let prepared;
    try {
      prepared = await prepareAudioForStt(audioBlob);
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
        sampleRateHertz: prepared.sampleRateHertz,
        platform: isAndroid ? 'android' : 'web'
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

  if (!blob?.size) {
    if (isAndroid) return { text: '', fallback: true };
    const liveOnly = isBrowserSttEnabled() ? getLiveSttText() : '';
    if (liveOnly) {
      clearLiveSttText();
      return { text: liveOnly, fallback: true };
    }
    return { text: '', fallback: true };
  }

  if (isAndroid) {
    console.log('🎙️ Android: sending to Yandex STT');
    try {
      const server = await tryServerStt(blob);
      if (server?.text?.trim()) {
        console.log('🎤 Распознано:', server.text);
        return server;
      }
    } catch (e) {
      console.warn('Android Yandex STT fail:', e.message);
    }
    window.ttsEngine?.speak('Я не расслышал. Скажи громче, пожалуйста.');
    return { text: '', fallback: true };
  }

  try {
    const server = await tryServerStt();
    const serverText = server?.text?.trim() || '';
    const liveText = isBrowserSttEnabled() ? getLiveSttText().trim() : '';
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
    const liveText = isBrowserSttEnabled() ? getLiveSttText().trim() : '';
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
let firstMicUse = !localStorage.getItem('first-mic-done');

function onFirstMicSuccess() {
  if (!firstMicUse) return;
  setTimeout(() => {
    window.ttsEngine?.speak('Отлично! Я тебя услышал. Теперь мы можем общаться!');
  }, 1500);
  localStorage.setItem('first-mic-done', 'true');
  firstMicUse = false;
}

function checkStoryLimit() {
  if (getStoriesRemaining() > 0) return true;
  synthesizeSpeech(
    'Мы сегодня уже рассказали все сказки! Но можем просто поболтать. О чём хочешь поговорить?',
    getCharacter()
  ).catch(() => {});
  return false;
}

async function beginRecording() {
  if (isAssistantSpeaking()) {
    console.warn('🎙️ Mic blocked: assistant is speaking');
    return;
  }
  if (!startMicSession()) {
    console.warn('🎙️ Mic busy, state:', getMicState());
    return;
  }
  if (isMicDisabled() || isRecording() || micStarting) {
    console.warn('🎙️ Mic busy, state:', getMicState());
    return;
  }
  if (!isMicrophoneSupported()) {
    await handleMicFailure('not_supported');
    return;
  }
  micStarting = true;
  try {
    armRecordingFromUser();
    const started = await startRecording({
      onAutoStop: (reason) => {
        if (reason === 'max_time') finishRecording();
      }
    });
    if (!started) {
      disarmRecordingFromUser();
      onMicProcessingDone();
      await handleMicFailure('start_failed');
      return;
    }
    setAvatarState('listening');
    document.getElementById('avatar')?.classList.add('listening');
    if (finishQueued) {
      finishQueued = false;
      await finishRecordingInternal();
    }
  } catch (e) {
    logError('mic', e.message);
    disarmRecordingFromUser();
    onMicProcessingDone();
    await handleMicFailure(e.message);
  } finally {
    micStarting = false;
  }
}

async function finishRecording() {
  if (getMicState() === 'processing' || micEnding) return;
  if (micStarting || !isRecording()) {
    finishQueued = true;
    return;
  }
  await finishRecordingInternal();
}

async function finishRecordingInternal() {
  if (micEnding || !isRecording() || getMicState() === 'processing') return;
  micEnding = true;
  finishMicSession();
  isProcessing = true;
  try {
    const audio = await stopRecording();
    if (audio?.size > 0) {
      await processAudio(audio);
    } else {
      await handleMicFailure('empty_blob');
      onMicProcessingDone();
    }
  } catch (e) {
    logError('record', e.message);
    onMicProcessingDone();
  } finally {
    isProcessing = false;
    micEnding = false;
    finishQueued = false;
    setAvatarState(null);
    updateAvatarMoodState();
    document.getElementById('avatar')?.classList.remove('listening', 'talking');
  }
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
    saveToLearnedDictionary(promptText, reply);

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
    window.storybook?.add(promptText.slice(0, 40) || 'Сказка на ночь', reply);
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

export async function sendTextMessage(text) {
  if (!text || !String(text).trim()) return;
  await handleUserMessage(String(text).trim());
}

function suggestFollowUp(aiResult, childAge) {
  const followUps = {
    happy: ['Здорово! А что ещё весёлого случилось?', 'Ты так интересно рассказываешь!'],
    neutral: ['А что бы ты хотел сейчас сделать?', 'Расскажи мне ещё что-нибудь.'],
    sad: ['Я тебя понимаю. Давай вместе подышим.', 'Знаешь, когда мне грустно, я представляю волшебный лес...']
  };

  const replyLen = aiResult?.length || 0;
  if (replyLen < 100 && Math.random() < 0.3) {
    const moodKey = aiResult.mood === 'positive' || aiResult.mood === 'happy'
      ? 'happy'
      : aiResult.mood === 'concerned' || aiResult.mood === 'sad'
        ? 'sad'
        : 'neutral';
    const options = followUps[moodKey] || followUps.neutral;
    const msg = options[Math.floor(Math.random() * options.length)];
    if (msg) setTimeout(() => window.ttsEngine?.speak(msg), 2000);
  }
}

function saveToLearnedDictionary(userMessage, aiResponse) {
  if (!userMessage || !aiResponse) return;
  Promise.resolve(learnFromResponse(userMessage, aiResponse))
    .then(() => {
      console.log('📚 Словарь обновлён. Ключей:', Object.keys(getLearnedDictionary()).length);
    })
    .catch(() => {});
}

async function handleUserMessage(text, options = {}) {
  const avatar = document.getElementById('avatar');
  const child = getActiveChild();
  const childName = getActiveChildName();
  const timeContext = getTimeContext(childName);
  let requestType = options.forceChat ? 'chat' : (options.forceBedtime ? 'bedtime_story' : detectRequestType(text));
  if (requestType === 'bedtime_story') {
    console.log('🌙 Активирован режим сказки на ночь');
  }
  const isStoryRequest = requestType === 'story' || requestType === 'bedtime_story';

  if (isStoryRequest && !checkStoryLimit()) {
    requestType = 'chat';
  }

  if (checkBadWords(text)) {
    await synthesizeSpeech('Давай говорить добрые слова', getCharacter());
    return;
  }

  const easterEgg = getEasterEggReply(text);
  if (easterEgg) {
    window.ttsEngine?.speak(easterEgg.reply);

    if (easterEgg.notifyCreator) {
      const user = getCurrentUser();
      fetch('/api/notify-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'thanks',
          userName: user.childName || 'Гость',
          userAge: user.childAge || null,
          message: text
        })
      }).catch(() => {});
    }

    return;
  }

  if (await handleGuestIntroduction(text)) {
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
  saveToLearnedDictionary(text, reply);

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
  addXP('dialog');

  setAvatarState('speaking');
  await synthesizeSpeech(reply, getCharacter());
  setAvatarState(null);
  updateAvatarMoodState();
  suggestFollowUp({ mood: aiMood, length: reply?.length || 0 }, child?.age || 7);

  if (requestType === 'bedtime_story') {
    const goodnight = childName !== 'Гость' ? `Сладких снов, ${childName}!` : 'Сладких снов!';
    await synthesizeSpeech(goodnight, getCharacter());
    incrementStories();
    incrementDailyStories();
    window.storybook?.add(text.slice(0, 40) || 'Сказка на ночь', reply);
    if (getStoriesRemaining() <= 0) showPlanLimitUI(true);
    checkAchievements();
    updateStatsDisplay();
    return;
  }

  if (shouldSuggestFearGame(allFears)) {
    await synthesizeSpeech(getFearGameSuggestion(allFears[0]), getCharacter());
  }
  if (responseType === 'story' || requestType === 'story') {
    incrementStories();
    incrementDailyStories();
    window.storybook?.add(text.slice(0, 40) || 'Сказка', reply);
  }
  if (getStoriesRemaining() <= 0) showPlanLimitUI(true);
  checkAchievements();
  updateStatsDisplay();
}

async function processAudio(audioBlob) {
  const avatar = document.getElementById('avatar');

  try {
    if (audioBlob.size < 500) {
      console.warn('🎙️ Audio blob too small:', audioBlob.size);
      await handleMicFailure('empty_blob');
      return;
    }
    const stt = await recognizeSpeech(audioBlob);
    const text = stt.text?.trim();
    console.log('🎤 Распознано:', text || '(пусто)');

    if (!text) {
      await handleMicFailure('stt_empty');
      return;
    }

    resetMicFailCount();
    onFirstMicSuccess();

    if (isBedtimeStoryRequest(text)) {
      console.log('🌙 Активирован режим сказки на ночь');
      await handleUserMessage(text, { forceBedtime: true });
      return;
    }

    await handleUserMessage(text);
  } catch (e) {
    logError('process_audio', e.message);
    await handleMicFailure('process_error');
  } finally {
    releaseMicrophone();
    onMicProcessingDone();
    if (avatar) avatar.classList.remove('talking', 'listening');
  }
}

// ========================================
// GAMES
// ========================================

export function showGamesMenu() {
  if (document.getElementById('gamesMenuOverlay')) return;
  if (appState.gameActive || document.body.classList.contains('game-active')) {
    if (!document.querySelector('.game-screen')) resetGameSession();
    else return;
  }

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
      <button type="button" class="modal-btn" id="gamesLeaderboardBtn">🏆 Таблица лидеров</button>
      <button class="modal-btn secondary games-menu-close" data-game="close">✕ Закрыть</button>
    </div>`;

  overlay.querySelector('#gamesLeaderboardBtn')?.addEventListener('click', () => {
    overlay.remove();
    if (typeof window.showLeaderboard === 'function') window.showLeaderboard();
  });

  overlay.querySelectorAll('[data-game]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.game;
      overlay.remove();
      if (id === 'close') return;
      if (btn.dataset.locked === '1') {
        synthesizeSpeech('Эта игра доступна в полной версии. Попроси родителей открыть доступ!', getCharacter()).catch(() => {});
        return;
      }
      const launchers = {
        fish: (lvl) => startFishGame(lvl),
        memory: (lvl) => startMemoryGame(lvl),
        puzzle: (lvl) => startPuzzleGame(lvl),
        riddles: (lvl) => startRiddlesGame(lvl),
        quest: (lvl) => startQuestGame(lvl),
        maze: (lvl) => startMazeGame(lvl),
        quiz: (lvl) => startQuizGame(lvl),
        runner: (lvl) => startRunnerGame(lvl),
        drawAi: (lvl) => startDrawAIGame(lvl),
        musicCat: (lvl) => startMusicCatGame(lvl),
        constellation: (lvl) => startConstellationGame(lvl),
        popFears: (lvl) => startPopFearsGame(lvl)
      };
      const launch = launchers[id];
      if (typeof launch !== 'function') {
        console.error('[games] Не найден запуск игры:', id);
        return;
      }
      resetGameSession();
      incrementGames();
      updateStatsDisplay();
      const lvl = getGameLevel(id);
      try {
        launch(lvl);
      } catch (err) {
        appState.gameActive = false;
        document.body.classList.remove('game-active');
        console.error('[games] Ошибка запуска', id, err);
        logError('game_launch_failed', { gameId: id, message: err?.message });
      }
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
  window.getActiveChildName = getActiveChildName;
  window.saveToChildHistory = saveToChildHistory;
  window.saveChildData = saveChildData;
  window.initCore = initCore;
  window.updateStatsUI = updateStatsDisplay;
  window.showChildSelectModal = showChildSelectModal;
  window.showGamesMenu = showGamesMenu;
  window.onGameClose = onGameClose;
  window.startMazeGame = startMazeGame;
  window.startPuzzleGame = startPuzzleGame;
  window.startConstellationGame = startConstellationGame;
  window.startRunnerGame = startRunnerGame;
  window.launchFishGame = launchFishGame;
  window.isAppReady = isAppReady;
  window.sendTestNotification = sendTestNotification;
}

export default {
  appState, initCore, safeParseJSON,
  getChildren, getActiveChildIndex, getActiveChildName, getActiveChild,
  setActiveChild, selectGuestMode, showChildSelectModal,
  getChildStats, saveChildStats, saveToChildHistory, updateFearStats,
  incrementStories, incrementGames, updateStatsDisplay, saveChildData,
  loadState: loadState, showGamesMenu, launchFishGame,
  getUserPlan, getStoriesRemaining, canAccessCharacter, canAccessGame, resetDailyCounters
};
