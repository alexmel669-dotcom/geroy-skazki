import { CONFIG, validateConfig, ENV, CHARACTERS, initAvatarImages } from './config.js';
import {
  initCore, getActiveChildName, getActiveChild, updateStatsUI, cycleCharacter,
  selectGuestMode, showChildSelectModal, saveChildData, appState, sendTextMessage
} from './core.js';
import { getCharacter } from './ai.js';
import { ttsEngine, synthesizeSpeech } from './audio.js';
import { startRecording, stopRecording, isRecording, browserSpeechRecognition } from './mic.js';
import { updateUI, showNotification, initDevPanel } from './ui.js';
import { initNotificationScheduler, checkPlanExpiryNotification } from './notifications.js';
import { startOnboarding } from './onboarding.js';

async function playWelcomeGreeting() {
  const modal = document.getElementById('childSelectModal');
  if (modal?.style.display === 'flex') return;
  if (localStorage.getItem('geroy-onboarding-done') !== 'true') return;
  const name = getActiveChildName();
  const charId = getCharacter();
  const charName = CHARACTERS[charId]?.name || 'Люцик';
  const text = name !== 'Гость' && localStorage.getItem('profileComplete') === 'true'
    ? `Привет, ${name}! Я ${charName}. Давай поговорим или поиграем!`
    : 'Привет! Я кот Люцик. Как тебя зовут?';
  await ttsEngine.speak(text, charId);
}

async function tryBrowserSpeechRecognition() {
  return browserSpeechRecognition();
}

function initializeApp() {
  console.log('🚀 Initializing Main App v' + CONFIG.APP_VERSION);
  localStorage.setItem('appVersion', CONFIG.APP_VERSION);
  validateConfig();
  initAvatarImages();
  initCore();
  setupAdditionalHandlers();
  updateUI();
  initAvatarImages();
  if (ENV.isDev || ENV.isStaging) initDevPanel();
  initNotificationScheduler().catch(() => {});
  checkPlanExpiryNotification();
  setTimeout(() => startOnboarding(), 1500);
  setTimeout(() => {
    playWelcomeGreeting().catch((err) => console.warn('Welcome failed:', err));
  }, 1000);
  console.log('✅ App initialized, child:', getActiveChildName());
}

function setupAdditionalHandlers() {
  const modal = document.getElementById('childSelectModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  document.getElementById('send-text-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('textChatInput');
    const text = input?.value?.trim();
    if (!text) return;
    input.value = '';
    try {
      await sendTextMessage(text);
    } catch (e) {
      showNotification('Не удалось отправить сообщение', 'error');
    }
  });

  document.getElementById('textChatInput')?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') document.getElementById('send-text-btn')?.click();
  });

  document.getElementById('achievements-btn')?.addEventListener('click', () => {
    showNotification('Собирай звёзды за сказки и игры! ⭐', 'info');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

if (typeof window !== 'undefined') {
  window.selectGuestMode = selectGuestMode;
  window.cycleCharacter = () => cycleCharacter(1);
  window.showChildSelectModal = showChildSelectModal;
  window.getActiveChildName = getActiveChildName;
  window.updateStatsUI = updateStatsUI;
  window.saveChildData = saveChildData;
  window.appState = appState;
  window.browserSpeechRecognition = browserSpeechRecognition;
  window.sendTextMessage = sendTextMessage;
}

export {
  initializeApp, startRecording, stopRecording, isRecording,
  synthesizeSpeech, browserSpeechRecognition, tryBrowserSpeechRecognition, ttsEngine
};
export default {
  initializeApp, startRecording, stopRecording, isRecording,
  synthesizeSpeech, browserSpeechRecognition, tryBrowserSpeechRecognition, ttsEngine
};
