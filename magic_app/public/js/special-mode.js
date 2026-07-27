// ========================================
// special-mode.js — РЕЖИМЫ ДЛЯ ОСОБЫХ ДЕТЕЙ
// ========================================

export const SPECIAL_MODES = {
  autism: {
    name: 'РАС',
    icon: '🧩',
    maxMessageLength: 50,
    responseStyle: 'simple',
    visualSupports: true,
    predictability: 'high',
    description: 'Простые фразы, визуальные подсказки, предсказуемые ответы'
  },
  hearing: {
    name: 'Слабослышащие',
    icon: '👂',
    subtitles: true,
    visualEmotions: true,
    vibrationFeedback: true,
    description: 'Субтитры, визуализация эмоций, вибро-отклик'
  },
  vision: {
    name: 'Слабовидящие',
    icon: '👁️',
    fontSize: 'large',
    highContrast: true,
    voiceNavigation: true,
    description: 'Крупный шрифт, контрастный режим, голосовое управление'
  },
  speech: {
    name: 'Речевые нарушения',
    icon: '🗣️',
    quickReplies: true,
    simplifiedInput: true,
    patience: 'high',
    description: 'Кнопки-подсказки, упрощённый ввод'
  },
  adhd: {
    name: 'СДВГ',
    icon: '⚡',
    sessionLength: 5,
    activitySwitch: 'frequent',
    rewards: 'instant',
    description: 'Короткие сессии, частая смена активности, мгновенные награды'
  }
};

const QUICK_REPLIES = [
  'Да',
  'Нет',
  'Расскажи сказку',
  'Давай поиграем',
  'Помоги'
];

let sessionTimerId = null;

export function applySpecialMode(mode) {
  if (!SPECIAL_MODES[mode]) return null;

  const config = SPECIAL_MODES[mode];
  localStorage.setItem('specialMode', mode);

  document.body.classList.remove('large-font', 'high-contrast');
  if (config.fontSize === 'large') {
    document.body.classList.add('large-font');
  }
  if (config.highContrast) {
    document.body.classList.add('high-contrast');
  }

  window.showSubtitles = Boolean(config.subtitles);
  window.showQuickReplies = Boolean(config.quickReplies);
  window.specialVisualSupports = Boolean(config.visualSupports);
  window.sessionMaxTime = config.sessionLength ? config.sessionLength * 60 : null;
  window.specialModeConfig = config;

  if (window.showQuickReplies) {
    renderQuickReplies();
  } else {
    document.getElementById('specialQuickReplies')?.remove();
  }

  if (window.sessionMaxTime) {
    startSessionTimer(window.sessionMaxTime);
  } else if (sessionTimerId) {
    clearTimeout(sessionTimerId);
    sessionTimerId = null;
  }

  return config;
}

export function getSpecialModeConfig() {
  const mode = localStorage.getItem('specialMode');
  return mode ? SPECIAL_MODES[mode] : null;
}

export function clearSpecialMode() {
  localStorage.removeItem('specialMode');
  document.body.classList.remove('large-font', 'high-contrast');
  window.showSubtitles = false;
  window.showQuickReplies = false;
  window.specialVisualSupports = false;
  window.sessionMaxTime = null;
  window.specialModeConfig = null;
  document.getElementById('specialQuickReplies')?.remove();
  document.getElementById('subtitleOverlay')?.remove();
  if (sessionTimerId) {
    clearTimeout(sessionTimerId);
    sessionTimerId = null;
  }
}

export function enrichWithEmoji(reply) {
  if (!reply) return reply;
  const text = String(reply);
  if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) return text;
  const endings = [' 🐱', ' ✨', ' 🌟', ' 💛'];
  return text + endings[Math.floor(Math.random() * endings.length)];
}

export function simplifyReply(reply, maxLen = 50) {
  if (!reply) return reply;
  const text = String(reply).trim();
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

export function showSubtitleOverlay(reply) {
  if (!reply) return;
  let el = document.getElementById('subtitleOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'subtitleOverlay';
    el.className = 'subtitle-overlay';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = String(reply);
  el.classList.add('visible');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.classList.remove('visible');
  }, Math.min(12000, 3000 + String(reply).length * 40));
}

export function startSessionTimer(seconds) {
  if (sessionTimerId) clearTimeout(sessionTimerId);
  sessionTimerId = setTimeout(() => {
    const tip = document.createElement('div');
    tip.className = 'subtitle-overlay visible';
    tip.textContent = 'Давай сделаем перерыв! Можно вернуться чуть позже 🌟';
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 5000);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }, seconds * 1000);
}

function renderQuickReplies() {
  let wrap = document.getElementById('specialQuickReplies');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'specialQuickReplies';
    wrap.className = 'quick-replies';
    const anchor =
      document.getElementById('textInputWrap') ||
      document.getElementById('micBtn')?.parentElement ||
      document.querySelector('.controls') ||
      document.body;
    anchor.appendChild(wrap);
  }
  wrap.innerHTML = '';
  QUICK_REPLIES.forEach((label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (typeof window.sendTextMessage === 'function') {
        window.sendTextMessage(label);
      } else {
        const input = document.getElementById('textInput');
        if (input) {
          input.value = label;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          document.getElementById('sendBtn')?.click();
        }
      }
    });
    wrap.appendChild(btn);
  });
}

export function applyReplySpecialMode(reply) {
  const config = getSpecialModeConfig() || window.specialModeConfig;
  if (!config || !reply) return reply;

  let result = String(reply);
  if (config.responseStyle === 'simple') {
    result = simplifyReply(result, config.maxMessageLength || 50);
  }
  if (config.visualSupports || window.specialVisualSupports) {
    result = enrichWithEmoji(result);
  }
  if (window.showSubtitles || config.subtitles) {
    showSubtitleOverlay(result);
  }
  if (config.vibrationFeedback && navigator.vibrate) {
    navigator.vibrate(30);
  }
  return result;
}

if (typeof window !== 'undefined') {
  window.SPECIAL_MODES = SPECIAL_MODES;
  window.applySpecialMode = applySpecialMode;
  window.getSpecialModeConfig = getSpecialModeConfig;
  window.clearSpecialMode = clearSpecialMode;
  window.applyReplySpecialMode = applyReplySpecialMode;
}

export default {
  SPECIAL_MODES,
  applySpecialMode,
  getSpecialModeConfig,
  clearSpecialMode,
  enrichWithEmoji,
  simplifyReply,
  showSubtitleOverlay,
  startSessionTimer,
  applyReplySpecialMode
};
