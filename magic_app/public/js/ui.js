import { CONFIG, ENV, CHARACTERS } from './config.js';
import { ttsEngine } from './audio.js';
import { getAgeWord } from './grammar.js';

import { getActiveChildName, getActiveChild, updateStatsUI } from './core.js';
import { applyHouseDirtVisual, cleanHouse, getHouseDirtLevel } from './lucik-house.js';

// ========================================
// ОБНОВЛЕНИЕ UI
// ========================================

export function updateUI() {
    // Обновляем имя ребенка
    const childNameLabel = document.getElementById('childNameLabel');
    if (childNameLabel) {
        const child = getActiveChild();
        childNameLabel.textContent = child
            ? `${child.name}, ${child.age} лет`
            : getActiveChildName();
    }
    
    // Обновляем статистику
    updateStatsUI();
    
    // Обновляем аватар
    updateAvatar();
}

export function setAvatarState(state) {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  avatar.classList.remove(
    'avatar-listening', 'avatar-speaking', 'avatar-sleepy',
    'avatar-happy', 'avatar-eating', 'talking', 'listening'
  );
  if (!state) return;
  const map = {
    listening: 'avatar-listening',
    speaking: 'avatar-speaking',
    sleepy: 'avatar-sleepy',
    happy: 'avatar-happy',
    eating: 'avatar-eating'
  };
  if (map[state]) avatar.classList.add(map[state]);
}

export function applyChildAvatar(child) {
  if (!child) return;

  const label = document.getElementById('childNameLabel') || document.getElementById('guestLabel');
  if (!label) return;

  const age = child.age || child.childAge || '';
  const ageWord = getAgeWord(age || 7);
  label.textContent = `${child.name || child.childName || 'Гость'}${age ? `, ${age} ${ageWord}` : ''}`;
}

export function switchCharacter(charId) {
  const char = CHARACTERS[charId];
  if (!char) return;

  const avatar = document.getElementById('avatar');
  const emoji = document.getElementById('avatarEmoji');
  if (!avatar) return;

  if (emoji) emoji.style.display = 'none';
  avatar.src = char.avatar;
  avatar.style.display = 'block';

  avatar.onerror = function onPngErr() {
    const svgPath = char.avatar.replace('.png', '.svg');
    avatar.onerror = function onSvgErr() {
      avatar.style.display = 'none';
      if (emoji) {
        emoji.textContent = char.emoji || '🐱';
        emoji.style.display = 'block';
      }
      avatar.removeEventListener('error', onSvgErr);
    };
    avatar.src = svgPath;
    avatar.removeEventListener('error', onPngErr);
  };

  localStorage.setItem('currentCharacter', charId);
  console.log('🔄 Персонаж:', charId, char.name);
}

function updateAvatar() {
    const avatar = document.getElementById('avatar');
    if (!avatar) return;
    switchCharacter(localStorage.getItem('currentCharacter') || 'lucik');
}

// ========================================
// УВЕДОМЛЕНИЯ
// ========================================

export function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    const oldNotifications = document.querySelectorAll('.custom-notification');
    oldNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10001;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        font-size: 14px;
        max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Добавляем анимацию
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// ЗАГРУЗЧИК
// ========================================

let loaderElement = null;

export function showLoader() {
    if (loaderElement) return;
    
    loaderElement = document.createElement('div');
    loaderElement.className = 'custom-loader';
    loaderElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10002;
    `;
    
    loaderElement.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
            <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <p style="margin-top: 10px;">Загрузка...</p>
        </div>
    `;
    
    if (!document.querySelector('#loader-styles')) {
        const style = document.createElement('style');
        style.id = 'loader-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(loaderElement);
}

export function hideLoader() {
    if (loaderElement) {
        loaderElement.remove();
        loaderElement = null;
    }
}

// ========================================
// МОДАЛЬНЫЕ ОКНА
// ========================================

export function showModal(titleOrId, message) {
    // Режим 1: показать существующий DOM-элемент по id
    if (!message && document.getElementById(titleOrId)) {
        const modal = document.getElementById(titleOrId);
        modal.style.display = 'flex';
        return;
    }

    // Режим 2: всплывающее окно с заголовком и текстом (игры)
    const overlay = document.createElement('div');
    overlay.className = 'game-alert-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.85);
        z-index: 3000; display: flex; align-items: center; justify-content: center;
    `;
    overlay.innerHTML = `
        <div style="background:rgba(35,35,58,0.95);border-radius:20px;padding:24px;max-width:320px;text-align:center;color:#fff;">
            <h3 style="margin:0 0 12px;">${titleOrId}</h3>
            <p style="margin:0 0 20px;opacity:0.85;line-height:1.5;">${message || ''}</p>
            <button type="button" class="modal-btn" style="width:100%;">OK</button>
        </div>
    `;
    overlay.querySelector('button').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

let purrCtx = null;

export function playPurrSound() {
  try {
    if (!purrCtx) purrCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = purrCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 28;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); }, 400);
  } catch {
    /* audio optional */
  }
}

let lastAiMs = 0;

export function setLastAiTiming(ms) {
    lastAiMs = ms;
    const el = document.getElementById('devAiMs');
    if (el) el.textContent = ms ? `${ms} ms` : '—';
}

export function initDevPanel() {
    if (!ENV.isDev && !ENV.isStaging) return;
    if (document.getElementById('devPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'devPanel';
    panel.className = 'dev-panel';
    panel.innerHTML = `
      <span>🛠️ Dev Mode</span>
      <span id="devVersion">v${CONFIG.APP_VERSION}</span>
      <span id="devEnv">${ENV.mode}</span>
      <span class="dev-stat">ИИ: <span id="devAiMs">—</span></span>
      <button type="button" id="devResetBtn">🧹 Сбросить данные</button>
      <button type="button" id="devPlanBasic">⭐ Базовый</button>
      <button type="button" id="devPlanFamily">👨‍👩‍👧 Семейный</button>
    `;
    document.body.appendChild(panel);
    document.body.classList.add('has-dev-panel');

    document.getElementById('devResetBtn')?.addEventListener('click', () => {
        if (confirm('Сбросить все локальные данные приложения?')) {
            localStorage.clear();
            window.location.reload();
        }
    });

    document.getElementById('devPlanBasic')?.addEventListener('click', () => switchPlan('basic'));
    document.getElementById('devPlanFamily')?.addEventListener('click', () => switchPlan('family'));

    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
        console.log('[DEV fetch]', args[0], args[1]?.method || 'GET');
        return origFetch(...args);
    };
}

function switchPlan(planId) {
    localStorage.setItem('userPlan', planId);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    localStorage.setItem('planExpiry', expiry.toISOString());
    showNotification(`Тариф: ${planId}`, 'info');
    updateUI();
}

function onboardingDone() {
  return localStorage.getItem('ob-done') === '1'
    || localStorage.getItem('geroy-onboarding-done') === 'true';
}

export function showMicHint() {
  if (!onboardingDone()) return;
  if (localStorage.getItem('mic-hint-played')) return;
  ttsEngine.speak('Нажми на микрофон и расскажи мне что-нибудь! Я тебя внимательно слушаю.').catch(() => {});
  localStorage.setItem('mic-hint-played', 'true');
}

export function showGamesHint() {
  if (!onboardingDone()) return;
  if (localStorage.getItem('games-hint-played')) return;
  setTimeout(() => {
    if (localStorage.getItem('games-hint-played')) return;
    ttsEngine.speak('Здесь игры! Нажми на иконку, чтобы поиграть. Давай повеселимся!').catch(() => {});
    localStorage.setItem('games-hint-played', 'true');
  }, 5000);
}

export function showSwipeHint() {
  if (!onboardingDone()) return;
  if (localStorage.getItem('swipe-hint-played')) return;
  setTimeout(() => {
    if (localStorage.getItem('swipe-hint-played')) return;
    ttsEngine.speak('Свайпни по мне влево или вправо, чтобы увидеть других друзей!').catch(() => {});
    localStorage.setItem('swipe-hint-played', 'true');
  }, 8000);
}

export function showLucikHouse() {
  const avatar = document.getElementById('avatar');
  if (avatar) avatar.classList.add('avatar-cleaning');

  let popup = document.getElementById('lucikHousePopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'lucikHousePopup';
    popup.className = 'lucik-house-popup';
    document.body.appendChild(popup);
  }

  const dirtLevel = getHouseDirtLevel();
  popup.innerHTML = `<div id="houseRoom" class="house-room">🏠 Домик Люцика${dirtLevel >= 2 ? ' — нужно прибраться!' : ''}</div>`;
  popup.style.display = 'block';
  applyHouseDirtVisual(document.getElementById('houseRoom'), dirtLevel);

  if (dirtLevel < 3) {
    window.ttsEngine?.speak('Убираюсь в домике!');
  }

  setTimeout(() => {
    avatar?.classList.remove('avatar-cleaning');
    cleanHouse();
    if (popup) popup.style.display = 'none';
  }, 2000);
}

/** Голосовые подсказки для пользователей, уже прошедших онбординг */
export function initVoiceHints() {
  setTimeout(showMicHint, 2000);
  showGamesHint();
  showSwipeHint();
}

if (typeof window !== 'undefined') {
    window.resetAllData = () => {
        localStorage.clear();
        window.location.reload();
    };
    window.switchPlan = switchPlan;
}

// ========================================
// ЭКСПОРТЫ
// ========================================

export default {
    updateUI,
    switchCharacter,
    showNotification,
    showLoader,
    hideLoader,
    showModal,
    hideModal,
    initDevPanel,
    setLastAiTiming,
    setAvatarState,
    playPurrSound,
    initVoiceHints,
    showMicHint,
    showGamesHint,
    showSwipeHint,
    showLucikHouse
};
