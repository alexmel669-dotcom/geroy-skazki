// ========================================
// config.js — КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ
// ========================================

export const CONFIG = {
  APP_VERSION: '4.3.0',
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
    games: ['fish', 'puzzle', 'memory', 'emotion', 'coloring'],
    memoryDays: 14
  },
  family: {
    name: 'Семейный',
    storiesPerDay: 15,
    characters: ['lucik', 'mom', 'dad', 'kid1', 'kid2'],
    games: ['fish', 'puzzle', 'memory', 'emotion', 'coloring'],
    memoryDays: 14,
    maxChildren: 3
  }
};

export const ADMIN_EMAILS = ['admin@geroy-skazki.local'];

export const CHARACTERS = {
  lucik: {
    id: 'lucik',
    name: 'Люцик',
    voice: 'zahar',
    gender: 'male',
    icon: '/assets/images/avatar.png',
    avatar: 'avatar.png',
    premium: false,
    description: 'Добрый волшебник'
  },
  mom: {
    id: 'mom',
    name: 'Мама',
    voice: 'jane',
    gender: 'female',
    icon: '/assets/images/mom.png',
    avatar: 'mom.png',
    premium: false,
    description: 'Заботливая мама'
  },
  dad: {
    id: 'dad',
    name: 'Папа',
    voice: 'ermil',
    gender: 'male',
    icon: '/assets/images/dad.png',
    avatar: 'dad.png',
    premium: false,
    description: 'Надёжный папа'
  },
  kid1: {
    id: 'kid1',
    name: 'Девочка',
    voice: 'oksana',
    gender: 'female',
    icon: '/assets/images/kid1.png',
    avatar: 'kid1.png',
    premium: false,
    description: 'Добрая девочка'
  },
  kid2: {
    id: 'kid2',
    name: 'Мальчик',
    voice: 'oksana',
    gender: 'male',
    icon: '/assets/images/kid2.png',
    avatar: 'kid2.png',
    premium: false,
    description: 'Весёлый мальчик'
  }
};

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

export function getAppMode() {
  if (typeof window === 'undefined') return 'user';
  const host = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'dev' && (host === 'localhost' || host === '127.0.0.1')) return 'dev';
  if (host === 'localhost' || host === '127.0.0.1') return 'dev';
  return 'user';
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
  console.log('✅ Config validated, version:', CONFIG.APP_VERSION);
  if (getAppMode() === 'dev') console.log('🛠 Dev mode active');
  return true;
}

export default { CONFIG, PLANS, CHARACTERS, FALLBACK_REPLIES, FEAR_LABELS, ADMIN_EMAILS, validateConfig, getAppMode };
