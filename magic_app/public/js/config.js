// ========================================
// config.js — КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ
// ========================================

export const PROMOCODES = {
  TESTER2026: { plan: 'basic', days: 30 },
  FAMILYTEST: { plan: 'family', days: 14 },
  PSYCHOLOGIST: { plan: 'basic', days: 90 },
  FRIENDLYCAT: { plan: 'basic', days: 7 }
};

const AVATAR_FILES = { lucik: 'avatar', mom: 'mom', dad: 'dad', kid1: 'kid1', kid2: 'kid2' };

let _assetBase = null;

/** Базовый путь к картинкам: file:// → относительный, иначе от корня сайта */
export function resolveAssetBase() {
  if (_assetBase) return _assetBase;
  if (typeof window === 'undefined') {
    _assetBase = '/assets/images/';
  } else if (window.location.protocol === 'file:') {
    _assetBase = 'assets/images/';
  } else {
    _assetBase = '/assets/images/';
  }
  return _assetBase;
}

export const ASSET_BASE = '/assets/images/';

export function avatarUrl(role, ext = 'svg') {
  const name = AVATAR_FILES[role] || AVATAR_FILES.lucik;
  return `${resolveAssetBase()}${name}.${ext}`;
}

export function getAvatarIcon(role) {
  return avatarUrl(role, 'svg');
}

export const AVATAR_ICONS = new Proxy({}, {
  get(_t, prop) {
    return getAvatarIcon(String(prop));
  }
});

export function assetUrl(path) {
  if (!path) return avatarUrl('lucik');
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const file = path.replace(/^\/?assets\/images\//, '');
  return `${resolveAssetBase()}${file}`;
}

export function avatarImgHtml(role, size = 36, className = 'child-chip-avatar') {
  const svg = avatarUrl(role, 'svg');
  const png = avatarUrl(role, 'png');
  return `<img src="${svg}" data-png="${png}" data-avatar="${role}" width="${size}" height="${size}" alt="" class="${className}" style="border-radius:50%;object-fit:cover;vertical-align:middle;" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src=this.dataset.png}">`;
}

export const CONFIG = {
  APP_VERSION: '5.0.14',
  MAX_HISTORY: 50,
  MAX_LOCAL_STORAGE_SIZE: 5 * 1024 * 1024,
  AUDIO_TIMEOUT: 10000,
  SILENCE_THRESHOLD: -45,
  SILENCE_TIMEOUT: 5000,
  MAX_RECORD_TIME: 60000,
  MIN_USER_AGE: 3,
  MAX_USER_AGE: 14,
  DEFAULT_FEAR_STATS: {
    darkness: 0,
    monsters: 0,
    loud_noises: 0,
    strangers: 0,
    separation: 0,
    school: 0,
    peers: 0
  }
};

export const PLANS = {
  free: {
    name: 'Бесплатный',
    storiesPerDay: 3,
    characters: ['lucik'],
    games: ['fish', 'memory'],
    memoryDays: 3
  },
  basic: {
    name: 'Базовый',
    storiesPerDay: 15,
    characters: ['lucik', 'mom', 'dad', 'kid1', 'kid2'],
    games: ['fish', 'puzzle', 'memory', 'riddles', 'quest', 'maze', 'quiz'],
    memoryDays: 14
  },
  family: {
    name: 'Семейный',
    storiesPerDay: 15,
    characters: ['lucik', 'mom', 'dad', 'kid1', 'kid2'],
    games: ['fish', 'puzzle', 'memory', 'riddles', 'quest', 'maze', 'quiz'],
    memoryDays: 14,
    maxChildren: 3
  }
};

export const ADMIN_EMAILS = ['admin@geroy-skazki.local'];

export const GAMES = {
  fish: { name: 'Рыбалка', ages: [3, 14], icon: '🎣' },
  puzzle: { name: 'Пазл', ages: [3, 14], icon: '🧩', levels: [3, 4, 6] },
  memory: { name: 'Мемори', ages: [3, 14], icon: '🧠' },
  riddles: { name: 'Загадки', ages: [8, 14], icon: '❓' },
  quest: { name: 'Квест', ages: [10, 14], icon: '🗺️' },
  maze: { name: 'Лабиринт', ages: [6, 14], icon: '🌀' },
  quiz: { name: 'Викторина', ages: [8, 14], icon: '❓' }
};

export const CHARACTERS = {
  lucik: {
    id: 'lucik',
    name: 'Люцик',
    voice: 'zahar',
    gender: 'male',
    avatar: 'assets/images/avatar.svg',
    emoji: '🐱',
    icon: 'assets/images/avatar.svg',
    premium: false,
    description: 'Добрый волшебник'
  },
  mom: {
    id: 'mom',
    name: 'Мама',
    voice: 'jane',
    gender: 'female',
    avatar: 'assets/images/mom.svg',
    emoji: '👩',
    icon: 'assets/images/mom.svg',
    premium: false,
    description: 'Заботливая мама'
  },
  dad: {
    id: 'dad',
    name: 'Папа',
    voice: 'ermil',
    gender: 'male',
    avatar: 'assets/images/dad.svg',
    emoji: '👨',
    icon: 'assets/images/dad.svg',
    premium: false,
    description: 'Надёжный папа'
  },
  kid1: {
    id: 'kid1',
    name: 'Девочка',
    voice: 'oksana',
    gender: 'female',
    avatar: 'assets/images/kid1.svg',
    emoji: '👧',
    icon: 'assets/images/kid1.svg',
    premium: false,
    description: 'Добрая девочка'
  },
  kid2: {
    id: 'kid2',
    name: 'Мальчик',
    voice: 'oksana',
    gender: 'male',
    avatar: 'assets/images/kid2.svg',
    emoji: '👦',
    icon: 'assets/images/kid2.svg',
    premium: false,
    description: 'Весёлый мальчик'
  }
};

export function refreshCharacterIcons() {
  for (const c of Object.values(CHARACTERS)) {
    if (c.avatar) c.icon = assetUrl(c.avatar);
  }
}

export function initAvatarImages() {
  refreshCharacterIcons();
  const fix = (img) => {
    if (!img || img.dataset.avatarReady) return;
    if (img.id === 'avatar') {
      img.dataset.avatarReady = '1';
      return;
    }
    const role = img.dataset.avatar;
    if (role) {
      img.src = avatarUrl(role, 'svg');
      img.dataset.png = avatarUrl(role, 'png');
    } else {
      const file = (img.getAttribute('src') || '').split('/').pop() || '';
      const map = { 'avatar.svg': 'lucik', 'avatar.png': 'lucik', 'mom.svg': 'mom', 'dad.svg': 'dad', 'kid1.svg': 'kid1', 'kid2.svg': 'kid2' };
      const r = map[file];
      if (r) {
        img.src = avatarUrl(r, 'svg');
        img.dataset.png = avatarUrl(r, 'png');
      } else if (file) {
        img.src = assetUrl(file);
        img.dataset.png = img.src.replace(/\.svg(\?.*)?$/i, '.png');
      }
    }
    img.dataset.avatarReady = '1';
    img.onerror = () => {
      if (img.dataset.fb) return;
      img.dataset.fb = '1';
      if (img.dataset.png) img.src = img.dataset.png;
    };
  };
  document.querySelectorAll(
    'img[data-avatar], .header-avatar, .avatar-img, #avatar, .auth-avatar img, .landing-hero-img, .child-chip-avatar, .feature-avatar-img'
  ).forEach(fix);
}

export const FALLBACK_REPLIES = {
  lucik: 'Мурр... Я немного задумался. Давай попробуем ещё раз? 🐱',
  mom: 'Дорогой, я тебя слушаю. Расскажи ещё раз?',
  dad: 'Хм, не расслышал. Повтори, пожалуйста?',
  kid1: 'Ой, я не расслышала. Повтори, пожалуйста?',
  kid2: 'Хм, что-то пошло не так. Расскажи ещё раз?'
};

export const FEAR_LABELS = {
  darkness: { name: 'Темнота', icon: '🌑' },
  monsters: { name: 'Монстры', icon: '👹' },
  loud_noises: { name: 'Громкие звуки', icon: '🔊' },
  strangers: { name: 'Незнакомцы', icon: '👤' },
  separation: { name: 'Одиночество', icon: '🧍' },
  school: { name: 'Школа', icon: '🏫' },
  peers: { name: 'Сверстники', icon: '👥' }
};

const OLD_FEAR_MAP = {
  темноты: 'darkness',
  врачей: 'monsters',
  одиночества: 'separation',
  нового: 'strangers',
  обиды: 'loud_noises',
  животных: 'monsters',
  школы: 'school',
  сверстников: 'peers'
};

const APP_MODE = (() => {
  if (typeof window === 'undefined') return 'production';
  const host = window.location.hostname;
  if (host === 'localhost' || host.includes('127.0.0.1')) return 'local';
  if (host.includes('dev.') || host.includes('staging.')) return 'staging';
  if (window.location.search.includes('mode=dev')) return 'dev';
  return 'production';
})();

export const ENV = {
  mode: APP_MODE,
  isDev: APP_MODE === 'local' || APP_MODE === 'dev',
  isStaging: APP_MODE === 'staging',
  isProduction: APP_MODE === 'production'
};

export function getAppMode() {
  return ENV.isDev || ENV.isStaging ? 'dev' : 'user';
}

export function migrateFearStatsObject(fearStats) {
  const fs = { ...CONFIG.DEFAULT_FEAR_STATS, ...(fearStats || {}) };
  for (const [oldKey, newKey] of Object.entries(OLD_FEAR_MAP)) {
    if (fearStats?.[oldKey] !== undefined) {
      fs[newKey] = (fs[newKey] || 0) + fearStats[oldKey];
      delete fs[oldKey];
    }
  }
  return fs;
}

export function getFearDisplayName(key) {
  return FEAR_LABELS[key]?.name || key;
}

export function validateConfig() {
  refreshCharacterIcons();
  console.log('✅ Config validated, version:', CONFIG.APP_VERSION, 'env:', ENV.mode);
  if (ENV.isDev || ENV.isStaging) console.log('🛠 Dev/staging mode active');
  return true;
}

export default {
  CONFIG, PLANS, GAMES, PROMOCODES, CHARACTERS, FALLBACK_REPLIES, FEAR_LABELS, ADMIN_EMAILS, ENV,
  ASSET_BASE, AVATAR_ICONS, assetUrl, avatarUrl, avatarImgHtml, initAvatarImages, resolveAssetBase,
  migrateFearStatsObject, getFearDisplayName, validateConfig, getAppMode
};
