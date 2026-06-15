// ========================================
// security.js — БЕЗОПАСНОСТЬ И ФИЛЬТРАЦИЯ
// ========================================

const BAD_WORDS = ['дурак', 'идиот', 'тупой', 'глупый', 'урод', 'дебил', 'кретин', 'болван', 'придурок', 'заткнись', 'пошел вон', 'убирайся', 'fuck', 'shit', 'damn', 'stupid', 'idiot'];

const ALERT_WORDS = ['обижают', 'бьют', 'ругают', 'кричат', 'страшно', 'боюсь', 'помогите', 'удар', 'синяк', 'больно'];

const PERSONAL_DATA_PATTERNS = [
    /(\+\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2})/,
    /(\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4})/,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    /(https?:\/\/[^\s]+)/
];

export function initSecurity() {
    console.log('🔒 Security system initialized');
}

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

export function sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[<>]/g, '').replace(/[&]/g, '&amp;').replace(/["]/g, '&quot;').replace(/[']/g, '&#39;').trim().substring(0, 500);
}

export function checkProfanity(text) {
    return checkBadWords(text);
}

export function sanitizeText(text, replacement = '***') {
    if (!text || typeof text !== 'string') return '';
    let result = text;
    for (const word of BAD_WORDS) {
        const regex = new RegExp(word, 'gi');
        result = result.replace(regex, replacement);
    }
    return result;
}

export function validateChildAge(age) {
    const numAge = parseInt(age);
    return !isNaN(numAge) && numAge >= 3 && numAge <= 12;
}

export function validateChildName(name) {
    return name && typeof name === 'string' && name.length >= 2 && name.length <= 20;
}

export default {
    initSecurity, checkBadWords, detectAlertWords, detectPersonalData, sanitizeInput, checkProfanity, sanitizeText, validateChildAge, validateChildName
};
