import './error-monitor.js';
import './storybook.js';
import './leaderboard.js';
import { CONFIG, validateConfig, ENV, initAvatarImages } from './config.js';
import {
  initCore, getActiveChildName, getActiveChild, updateStatsUI, cycleCharacter,
  selectGuestMode, showChildSelectModal, saveChildData, appState, sendTextMessage,
  showGamesMenu, performFeedLucik, performCleanLucikRoom
} from './core.js';
import { getCharacter } from './ai.js';
import { ttsEngine, synthesizeSpeech } from './audio.js';
import { startRecording, stopRecording, isRecording, browserSpeechRecognition } from './mic.js';
import { updateUI, showNotification, initDevPanel, initVoiceHints, feedLucik, showLucikHouse } from './ui.js';
import { initNotificationScheduler, checkPlanExpiryNotification } from './notifications.js';
import { startOnboarding } from './onboarding.js';

var initializeApp;
var tryBrowserSpeechRecognition;

try {
  tryBrowserSpeechRecognition = async function tryBrowserSpeechRecognition() {
    return browserSpeechRecognition();
  };

  initializeApp = function initializeApp() {
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
    setTimeout(() => startOnboarding(), 2000);
    console.log('✅ App initialized, child:', getActiveChildName());
  };

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

  function showFatalError(e) {
    console.error('FATAL:', e);
    document.body.innerHTML = `
    <div style="text-align:center;padding:40px;color:#fff;background:#6C63FF;height:100vh;">
      <h2>😿 Что-то пошло не так</h2>
      <p>Мы уже чиним! Попробуй обновить страницу.</p>
      <button onclick="location.reload()" style="padding:12px 24px;border-radius:12px;border:none;background:#FFD700;color:#333;font-size:16px;">🔄 Обновить</button>
    </div>
  `;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        initializeApp();
      } catch (e) {
        showFatalError(e);
      }
    });
  } else {
    try {
      initializeApp();
    } catch (e) {
      showFatalError(e);
    }
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
    window.showGamesMenu = () => {
      if (!document.body.classList.contains('game-active') && !appState.gameActive) {
        showGamesMenu();
      }
    };
    window.feedLucik = () => {
      performFeedLucik();
      feedLucik();
    };
    window.showLucikHouse = () => {
      performCleanLucikRoom();
      showLucikHouse();
    };
  }
} catch (e) {
  console.error('FATAL:', e);
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = `
    <div style="text-align:center;padding:40px;color:#fff;background:#6C63FF;height:100vh;">
      <h2>😿 Что-то пошло не так</h2>
      <p>Мы уже чиним! Попробуй обновить страницу.</p>
      <button onclick="location.reload()" style="padding:12px 24px;border-radius:12px;border:none;background:#FFD700;color:#333;font-size:16px;">🔄 Обновить</button>
    </div>
  `;
  }
}

export {
  initializeApp, startRecording, stopRecording, isRecording,
  synthesizeSpeech, browserSpeechRecognition, tryBrowserSpeechRecognition, ttsEngine
};
export default {
  initializeApp, startRecording, stopRecording, isRecording,
  synthesizeSpeech, browserSpeechRecognition, tryBrowserSpeechRecognition, ttsEngine
};
