import { CONFIG, CHARACTERS, FALLBACK_REPLIES, validateConfig, getAppMode } from './config.js';
import {
  initCore,
  getActiveChildName,
  getActiveChild,
  updateStatsUI,
  cycleCharacter,
  selectGuestMode,
  showChildSelectModal,
  saveToChildHistory,
  updateFearStats,
  incrementStories,
  incrementGames,
  appState,
  safeParseJSON
} from './core.js';
import { generateResponse, detectFear, detectAlertWords, detectPersonalData, setCharacter, getCharacter, addToContext } from './ai.js';
import { startRecording, stopRecording, isRecording, getRecordingMimeType, isMicrophoneSupported } from './mic.js';
import { synthesizeSpeech } from './audio.js';
import { checkAchievements } from './achievements.js';
import { trackEvent, logError } from './analytics.js';
import { initSecurity, sanitizeText } from './security.js';
import { initDevPanel, setLastAiTiming } from './ui.js';
import { startFishGame } from './games/fish.js';
import { startMemoryGame } from './games/memory.js';
import { startPuzzleGame } from './games/puzzle.js';
import { startEmotionGame } from './games/emotion.js';
import { startColoringGame } from './games/coloring.js';

let isProcessing = false;
let micEnding = false;

document.addEventListener('DOMContentLoaded', () => {
  validateConfig();
  initSecurity();
  initCore();
  initUI();
  initEventListeners();
  setMicVisualState('idle');
  if (getAppMode() === 'dev') initDevPanel();

  console.log(`🟢 Герой Сказок v${CONFIG.APP_VERSION} запущен`);
  console.log(`👶 Активный ребёнок: ${getActiveChildName()}`);
  console.log(`🎭 Персонаж: ${getCharacter()}`);
});

function initUI() {
  const avatar = document.getElementById('avatar');
  if (avatar) avatar.addEventListener('click', () => {
    cycleCharacter(1);
    trackEvent('character_change', getCharacter());
  });

  const parentBtn = document.getElementById('parentBtn');
  if (parentBtn) parentBtn.addEventListener('click', () => { window.location.href = '/parent.html'; });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    const token = localStorage.getItem('userToken') || document.cookie.includes('token=');
    if (token) logoutBtn.style.display = 'flex';
    logoutBtn.addEventListener('click', logout);
  }
}

function initEventListeners() {
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.addEventListener('mousedown', (e) => { e.preventDefault(); beginRecording(); });
    micBtn.addEventListener('mouseup', () => finishRecording());
    micBtn.addEventListener('mouseleave', () => { if (isRecording()) finishRecording(); });
    micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); beginRecording(); }, { passive: false });
    micBtn.addEventListener('touchend', (e) => { e.preventDefault(); finishRecording(); });
  }

  const feedBtn = document.getElementById('feedBtn');
  if (feedBtn) {
    feedBtn.addEventListener('click', () => {
      animateStat('hungerFill', 100);
      trackEvent('feed', getActiveChildName());
    });
  }

  const gamesBtn = document.getElementById('gamesBtn');
  if (gamesBtn) {
    gamesBtn.addEventListener('click', showGamesMenu);
  }

  const roomBtn = document.getElementById('roomBtn');
  if (roomBtn) {
    roomBtn.addEventListener('click', () => {
      animateStat('energyFill', 100);
      trackEvent('clean', getActiveChildName());
    });
  }

  const avatarSection = document.querySelector('.avatar-section');
  if (avatarSection) {
    let touchStartX = 0;
    avatarSection.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
    avatarSection.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 50) {
        cycleCharacter(diff > 0 ? -1 : 1);
        trackEvent('character_change', getCharacter());
      }
    });
  }
}

function animateStat(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const current = parseInt(el.style.width, 10) || 0;
  const diff = target - current;
  const steps = 20;
  let step = 0;

  const interval = setInterval(() => {
    step++;
    el.style.width = Math.min(100, current + (diff * step / steps)) + '%';
    if (step >= steps) {
      clearInterval(interval);
      setTimeout(() => { el.style.width = current + '%'; }, 2000);
    }
  }, 50);
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
  } catch (err) {
    console.error('❌ Mic access error:', err);
    alert('Микрофон недоступен. Попроси взрослого помочь настроить.');
    setMicVisualState('idle');
  }
}

async function finishRecording() {
  if (micEnding || !isRecording() || isProcessing) return;
  micEnding = true;
  isProcessing = true;
  setMicVisualState('processing');
  try {
    const audioBlob = await stopRecording();
    if (audioBlob && audioBlob.size > 0) await processAudio(audioBlob);
  } catch (err) {
    console.error('❌ Recording error:', err);
    logError('mic', err.message || String(err));
  } finally {
    isProcessing = false;
    micEnding = false;
    setMicVisualState('idle');
  }
}

async function processAudio(audioBlob) {
  const avatar = document.getElementById('avatar');

  try {
    if (avatar) avatar.classList.add('listening');

    const recognizedText = await recognizeSpeech(audioBlob);
    if (avatar) avatar.classList.remove('listening');

    if (!recognizedText || !recognizedText.trim()) {
      alert('Не удалось распознать речь. Попробуй ещё раз или попроси взрослого проверить микрофон.');
      return;
    }

    console.log('👶 Ребёнок:', recognizedText);

    saveToChildHistory({
      role: 'child',
      text: recognizedText,
      timestamp: Date.now(),
      childName: getActiveChildName()
    });
    addToContext('child', recognizedText);

    const fears = detectFear(recognizedText);
    if (fears.length > 0) {
      updateFearStats(fears);
      trackEvent('fear_detected', fears.join(','));
    }

    const alertWords = detectAlertWords(recognizedText);
    if (alertWords.length > 0) trackEvent('alert_words', alertWords.join(','));

    if (avatar) avatar.classList.add('talking');

    const child = getActiveChild();
    let reply = await generateResponse(recognizedText, child ? { name: child.name, age: child.age } : {});
    if (globalThis.__lastAiMs) setLastAiTiming(globalThis.__lastAiMs);
    reply = sanitizeText(reply);

    const botEntry = {
      role: 'bot',
      text: reply,
      timestamp: Date.now(),
      characterName: CHARACTERS[getCharacter()]?.name || 'Люцик'
    };
    saveToChildHistory(botEntry);
    addToContext('bot', reply);

    const botAlertWords = detectAlertWords(reply);
    const botPersonalData = detectPersonalData(reply);
    if (botAlertWords.length > 0 || botPersonalData.length > 0) {
      botEntry.alerted = true;
      botEntry.alertWords = [...botAlertWords, ...botPersonalData];
      const key = getActiveChild() ? `stats_${getActiveChild().name}` : 'stats_guest';
      const stats = safeParseJSON(localStorage.getItem(key), {});
      if (stats.history?.length > 0) {
        stats.history[stats.history.length - 1] = botEntry;
        localStorage.setItem(key, JSON.stringify(stats));
      }
    }

    await synthesizeSpeech(reply, getCharacter());

    if (reply.length > 200) incrementStories();

    updateStatsUI();
    checkAchievements();
  } catch (err) {
    console.error('❌ Process audio error:', err);
    logError('processAudio', err.message || String(err));
    const fallback = FALLBACK_REPLIES[getCharacter()] || FALLBACK_REPLIES.lucik;
    await synthesizeSpeech(fallback, getCharacter());
  } finally {
    if (avatar) {
      avatar.classList.remove('talking');
      avatar.classList.remove('listening');
    }
  }
}

async function recognizeSpeech(audioBlob) {
  if (!audioBlob?.size) return '';

  try {
    const base64 = await blobToBase64(audioBlob);
    const response = await fetch('/api/speech-to-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: base64,
        contentType: audioBlob.type || getRecordingMimeType()
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.text?.trim()) {
      return data.text.trim();
    }

    if (data.fallback || response.status === 503) {
      console.warn('STT not configured on server');
    } else {
      console.warn('STT failed:', response.status, data.error);
    }
  } catch (err) {
    console.warn('⚠️ STT API failed:', err);
  }

  return '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function logout() {
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

window.showChildSelectModal = showChildSelectModal;
window.selectGuestMode = selectGuestMode;

function showGamesMenu() {
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
    </div>
  `;

  const games = {
    fish: startFishGame,
    memory: startMemoryGame,
    puzzle: startPuzzleGame,
    emotion: startEmotionGame,
    coloring: startColoringGame
  };

  overlay.querySelectorAll('[data-game]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.game;
      overlay.remove();
      if (id === 'close') return;
      incrementGames();
      updateStatsUI();
      games[id]?.();
      checkAchievements();
      trackEvent('game_selected', id);
    });
  });

  document.body.appendChild(overlay);
}
