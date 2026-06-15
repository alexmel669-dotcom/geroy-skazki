// ai.js
let currentCharacter = 'lucik';
let contextHistory = [];

export async function generateResponse(prompt) {
    console.log('Generating response for:', prompt);
    
    // Простая заглушка - возвращаем приветствие
    const responses = [
        'Привет! Расскажи мне сказку?',
        'Как у тебя дела?',
        'Что интересного случилось сегодня?',
        'Давай поиграем!',
        'Я люблю слушать твои истории!'
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    // Имитация задержки ответа
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return randomResponse;
}

export function detectFear(text) {
    const fears = [];
    const fearKeywords = {
        darkness: ['темно', 'страшно', 'боюсь'],
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
    const alertKeywords = ['обижают', 'бьют', 'ругают', 'страшно', 'помогите'];
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
    console.log('Character set to:', characterId);
}

export function getCharacter() {
    return currentCharacter;
}

export function addToContext(role, message) {
    contextHistory.push({ role, message, timestamp: Date.now() });
    
    // Оставляем только последние 20 сообщений
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
