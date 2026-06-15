// ========================================
// config.js — КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ
// ========================================

export const CONFIG = {
    APP_VERSION: '4.0.8',
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
        icon: '/assets/images/avatar.png',
        premium: false,
        description: 'Добрый волшебник'
    },
    kid1: {
        id: 'kid1',
        name: 'Мальчик',
        icon: '/assets/images/kid1.png',
        premium: false,
        description: 'Веселый мальчик'
    },
    kid2: {
        id: 'kid2',
        name: 'Девочка',
        icon: '/assets/images/kid2.png',
        premium: false,
        description: 'Добрая девочка'
    }
};

export function validateConfig() {
    console.log('✅ Config validated, version:', CONFIG.APP_VERSION);
    return true;
}

export default { CONFIG, CHARACTERS, validateConfig };
