// ========================================
// security.js — БЕЗОПАСНОСТЬ И ФИЛЬТРАЦИЯ
// ========================================

import { fixCommonGrammarMistakes } from './grammar.js';

// Список запрещенных слов
export const ALLOWED_SLANG = [
  'круто', 'классно', 'здорово', 'супер',
  'огонь', 'топ', 'залипательно', 'няшно',
  'милота', 'обожаю', 'ураган', 'бомба',
  'краш', 'вайб', 'чилить', 'рофл'
];

export const FORBIDDEN_WORDS = [
  'бля', 'хуй', 'пизд', 'еба', 'ёб', 'сука', 'мудак',
  'дурак', 'идиот', 'глупый', 'тупой', 'урод',
  'дебил', 'кретин', 'болван', 'придурок',
  'заткнись', 'пошел вон', 'убирайся',
  'жесть', 'страшно', 'ужас', 'кошмар',
  'fuck', 'shit', 'damn', 'stupid', 'idiot', 'bitch'
];

const BAD_WORDS = FORBIDDEN_WORDS;

// Список подозрительных слов для родителей
const ALERT_WORDS = [
    'обижают', 'бьют', 'ругают', 'кричат',
    'страшно', 'боюсь', 'помогите',
    'удар', 'синяк', 'больно'
];

// Личные данные (регулярки)
const PERSONAL_DATA_PATTERNS = [
    /(\+\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2})/, // телефон
    /(\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4})/, // номер карты
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/, // email
    /(https?:\/\/[^\s]+)/ // ссылки
];

/**
 * Инициализация системы безопасности
 */
export function initSecurity() {
    console.log('🔒 Security system initialized');
    // Можно добавить дополнительные проверки
}

/**
 * Проверка наличия плохих слов в тексте
 * @param {string} text - Текст для проверки
 * @returns {boolean} - true если есть плохие слова
 */
export function checkBadWords(text) {
    if (!text || typeof text !== 'string') return false;
    
    const lowerText = text.toLowerCase();
    
    for (const word of BAD_WORDS) {
        if (lowerText.includes(word.toLowerCase())) {
            console.warn('⚠️ Bad word detected:', word);
            return true;
        }
    }
    
    return false;
}

/**
 * Проверка наличия нецензурных слов (синоним checkBadWords)
 * @param {string} text - Текст для проверки
 * @returns {boolean} - true если есть нецензурные слова
 */
export function checkProfanity(text) {
    return checkBadWords(text);
}

/**
 * Очистка текста от плохих слов
 * @param {string} text - Исходный текст
 * @param {string} replacement - Замена для плохих слов
 * @returns {string} - Очищенный текст
 */
export function sanitizeText(text, replacement = '***') {
    return sanitizeAIText(text, 14).replace(/\*\*\*/g, replacement);
}

export function sanitizeAIText(text, age) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text;

    FORBIDDEN_WORDS.forEach((word) => {
        const regex = new RegExp(word, 'gi');
        cleaned = cleaned.replace(regex, '***');
    });

    const childAge = parseInt(age, 10) || 5;
    if (childAge < 11) {
        ALLOWED_SLANG.forEach((word) => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            cleaned = cleaned.replace(regex, 'здорово');
        });
    }

    return fixCommonGrammarMistakes(cleaned);
}

/**
 * Безопасная очистка HTML входных данных
 * @param {string} input - Входная строка
 * @returns {string} - Очищенная строка
 */
export function sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    
    return input
        .replace(/[<>]/g, '') // Удаляем HTML теги
        .replace(/[&]/g, '&amp;')
        .replace(/["]/g, '&quot;')
        .replace(/[']/g, '&#39;')
        .trim();
}

/**
 * Детектирование тревожных слов (для родителей)
 * @param {string} text - Текст для проверки
 * @returns {Array} - Массив найденных тревожных слов
 */
export function detectAlertWords(text) {
    if (!text || typeof text !== 'string') return [];
    
    const found = [];
    const lowerText = text.toLowerCase();
    
    for (const word of ALERT_WORDS) {
        if (lowerText.includes(word.toLowerCase())) {
            found.push(word);
        }
    }
    
    return found;
}

/**
 * Детектирование личных данных
 * @param {string} text - Текст для проверки
 * @returns {Array} - Массив найденных личных данных
 */
export function detectPersonalData(text) {
    if (!text || typeof text !== 'string') return [];
    
    const found = [];
    
    for (const pattern of PERSONAL_DATA_PATTERNS) {
        if (pattern.test(text)) {
            found.push('personal_data');
            break;
        }
    }
    
    return found;
}

/**
 * Валидация возраста ребенка
 * @param {number} age - Возраст
 * @returns {boolean} - Корректный ли возраст
 */
export function validateChildAge(age) {
    const numAge = parseInt(age, 10);
    return !isNaN(numAge) && numAge >= 3 && numAge <= 14;
}

/**
 * Валидация имени ребенка
 * @param {string} name - Имя
 * @returns {boolean} - Корректное ли имя
 */
export function validateChildName(name) {
    return name && typeof name === 'string' && name.length >= 2 && name.length <= 20;
}

export const TEEN_SLANG = {
  allowed: ['круто', 'классно', 'огонь', 'топ', 'залипательно', 'краш', 'вайб', 'чилить', 'рофл', 'пушка', 'бомба', 'кайф', 'имба', 'скилл', 'френд', 'го'],
  forbidden: []
};

export function getAgeBasedTone(age) {
  const a = parseInt(age, 10) || 5;
  if (a <= 7) return 'Говори как с малышом. Простые слова, ласково.';
  if (a <= 10) return 'Говори как с другом. Можно: круто, классно, здорово.';
  if (a <= 14) return `Говори на современном языке. Можно: ${TEEN_SLANG.allowed.slice(0, 10).join(', ')}. Нельзя: мат, агрессия.`;
  return '';
}

// Экспорт всех основных функций
export default {
    initSecurity,
    checkBadWords,
    checkProfanity,
    sanitizeText,
    sanitizeAIText,
    sanitizeInput,
    ALLOWED_SLANG,
    FORBIDDEN_WORDS,
    detectAlertWords,
    detectPersonalData,
    validateChildAge,
    validateChildName,
    TEEN_SLANG,
    getAgeBasedTone
};
