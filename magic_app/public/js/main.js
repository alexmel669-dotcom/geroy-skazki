// ========================================
// main.js — ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ
// ========================================

import { CONFIG, validateConfig, getAppMode } from './config.js';
import {
  initCore,
  getActiveChildName,
  updateStatsUI,
  cycleCharacter,
  selectGuestMode,
  showChildSelectModal,
  saveChildData,
  appState
} from './core.js';
import { getCharacter } from './ai.js';
import { synthesizeSpeech } from './audio.js';
import { startRecording, stopRecording, isRecording } from './mic.js';
import { updateUI, showNotification, initDevPanel } from './ui.js';

async function playWelcomeGreeting() {
  const modal = document.getElementById('childSelectModal');
  if (modal?.style.display === 'flex') return;

  const name = getActiveChildName();
  const text = name !== 'Гость'
    ? `Привет, ${name}! Я Люцик, твой сказочный друг. Давай поговорим!`
    : 'Привет! Я Люцик, твой сказочный друг. Давай поговорим!';

  await synthesizeSpeech(text, getCharacter());
}

function initializeApp() {
  console.log('🚀 Initializing Main App v' + CONFIG.APP_VERSION);
  validateConfig();
  initCore();
  setupAdditionalHandlers();
  updateUI();

  if (getAppMode() === 'dev') initDevPanel();

  setTimeout(() => {
    playWelcomeGreeting().catch((err) => console.warn('Welcome greeting failed:', err));
  }, 700);

  console.log('✅ App initialized');
  console.log('👶 Активный ребёнок:', getActiveChildName());
}

function setupAdditionalHandlers() {
  const modal = document.getElementById('childSelectModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    showNotification('Произошла ошибка, попробуйте ещё раз', 'error');
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification('Ошибка: ' + (e.reason?.message || 'Неизвестная ошибка'), 'error');
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
}

export { initializeApp, startRecording, stopRecording, isRecording, synthesizeSpeech };
export default { initializeApp, startRecording, stopRecording, isRecording, synthesizeSpeech };
