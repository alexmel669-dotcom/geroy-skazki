// ========================================
// config.js — КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ
// ========================================

export const CONFIG = {
    APP_VERSION: '4.0.11',
    MAX_HISTORY: 50,
    MAX_LOCAL_STORAGE_SIZE: 5 * 1024 * 1024,
    AUDIO_TIMEOUT: 10000,
    DEFAULT_FEAR_STATS: {
        darkness: 0,
        monsters: 0,
        loud_noises: 0,
        strangers: 0,
        separation: 0
    }
};

export const CHARACTERS = {
    lucik: {
        id: 'lucik',
        name: 'Люцик',
        icon: '/assets/images/avatar.svg',
        premium: false,
        description: 'Добрый волшебник'
    },
    kid1: {
        id: 'kid1',
        name: 'Мальчик',
        icon: '/assets/images/kid1.svg',
        premium: false,
        description: 'Веселый мальчик'
    },
    kid2: {
        id: 'kid2',
        name: 'Девочка',
        icon: '/assets/images/kid2.svg',
        premium: false,
        description: 'Добрая девочка'
    }
};

export const FALLBACK_REPLIES = {
    lucik: 'Мурр... Я немного задумался. Давай попробуем ещё раз? 🐱',
    kid1: 'Хм, что-то пошло не так. Расскажи ещё раз?',
    kid2: 'Ой, я не расслышала. Повтори, пожалуйста?'
};

export const FEAR_LABELS = {
    darkness: { name: 'Темнота', icon: '🌑' },
    monsters: { name: 'Монстры', icon: '👹' },
    loud_noises: { name: 'Громкие звуки', icon: '🔊' },
    strangers: { name: 'Незнакомцы', icon: '👤' },
    separation: { name: 'Одиночество', icon: '🧍' }
};

const OLD_FEAR_MAP = {
    'темноты': 'darkness',
    'врачей': 'monsters',
    'одиночества': 'separation',
    'нового': 'strangers',
    'обиды': 'loud_noises',
    'животных': 'monsters'
};

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
    return true;
}

export default { CONFIG, CHARACTERS, FALLBACK_REPLIES, FEAR_LABELS, validateConfig };
