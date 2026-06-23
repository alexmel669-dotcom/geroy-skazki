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
import { updateUI, showNotification, initDevPanel } from './ui.js';

function initializeApp() {
  console.log('🚀 Initializing Main App v' + CONFIG.APP_VERSION);
  validateConfig();
  initCore();
  setupAdditionalHandlers();
  updateUI();

  if (getAppMode() === 'dev') initDevPanel();

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

export { initializeApp };
export default { initializeApp };
