// ========================================
// ai.js — ИИ И ГЕНЕРАЦИЯ ОТВЕТОВ
// ========================================

let currentCharacter = 'lucik';
let contextHistory = [];

const RESPONSES = [
    'Привет! Расскажи мне сказку?',
    'Как у тебя дела?',
    'Что интересного случилось сегодня?',
    'Давай поиграем!',
    'Я люблю слушать твои истории!',
    'Расскажи что-нибудь интересное!',
    'Ты сегодня молодец!',
    'Продолжай в том же духе!'
];

export async function generateResponse(prompt) {
    console.log('🤖 AI generating response for:', prompt);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (prompt && prompt.length > 0) {
        if (prompt.includes('сказк') || prompt.includes('расскажи')) {
            return 'Жил-был маленький волшебник. Он путешествовал по сказочной стране и помогал всем, кто попадал в беду. Хочешь узнать, что было дальше?';
        }
        if (prompt.includes('страш') || prompt.includes('боюсь')) {
            return 'Не бойся! Ты очень смелый(ая). Помни, что все страхи можно победить, если быть храбрым. Я всегда рядом с тобой!';
        }
        if (prompt.includes('игр') || prompt.includes('поигра')) {
            return 'Отлично! Давай поиграем. Нажми на кнопку "Игры" - там есть много интересного!';
        }
    }
    
    const randomResponse = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    return randomResponse;
}

export function detectFear(text) {
    const fears = [];
    const fearKeywords = {
        darkness: ['темно', 'страшно', 'боюсь', 'тьма'],
        monsters: ['монстр', 'чудовище', 'бабайка'],
        loud_noises: ['громко', 'шумно', 'взрыв'],
        strangers: ['чужой', 'незнакомец', 'посторонний'],
        separation: ['один', 'без мамы', 'без папы']
    };
    
    const lowerText = text.toLowerCase();
    for (const [fear, keywords] of Object.entries(fearKeywords)) {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
            fears.push(fear);
        }
    }
    return fears;
}

export function detectAlertWords(text) {
    const alerts = [];
    const alertKeywords = ['обижают', 'бьют', 'ругают', 'кричат', 'страшно', 'помогите'];
    const lowerText = text.toLowerCase();
    for (const word of alertKeywords) {
        if (lowerText.includes(word)) {
            alerts.push(word);
        }
    }
    return alerts;
}

export function detectPersonalData(text) {
    const found = [];
    const phonePattern = /(\+\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2})/;
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    
    if (phonePattern.test(text)) found.push('phone');
    if (emailPattern.test(text)) found.push('email');
    
    return found;
}

export function setCharacter(characterId) {
    currentCharacter = characterId;
    console.log('🎭 Character set to:', characterId);
}

export function getCharacter() {
    return currentCharacter;
}

export function addToContext(role, message) {
    contextHistory.push({ role, message, timestamp: Date.now() });
    if (contextHistory.length > 20) {
        contextHistory = contextHistory.slice(-20);
    }
}

export function clearContext() {
    contextHistory = [];
    console.log('Context cleared');
}

export function getContext() {
    return [...contextHistory];
}

export default { generateResponse, detectFear, detectAlertWords, detectPersonalData, setCharacter, getCharacter, addToContext, clearContext, getContext };
