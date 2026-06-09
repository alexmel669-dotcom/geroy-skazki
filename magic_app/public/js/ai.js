import { CONFIG, CHARACTERS, FEAR_KEYWORDS, SYSTEM_PROMPT_SAFETY } from './config.js';

let conversationContext = [];
let currentCharacterId = 'lucik';

export function setCharacter(characterId) {
  currentCharacterId = characterId;
  // Сбрасываем контекст при смене персонажа
  conversationContext = [];
}

export function getCharacter() {
  return currentCharacterId;
}

export function addToContext(role, text) {
  conversationContext.push({ role, text, timestamp: Date.now() });
  if (conversationContext.length > CONFIG.HISTORY_FOR_API) {
    conversationContext = conversationContext.slice(-CONFIG.HISTORY_FOR_API);
  }
}

export function getContext() {
  return conversationContext;
}

export function clearContext() {
  conversationContext = [];
}

function buildSystemPrompt() {
  const char = CHARACTERS[currentCharacterId] || CHARACTERS['lucik'];
  return `${char.style}

${SYSTEM_PROMPT_SAFETY}

Ребёнок говорит с тобой голосом. Отвечай устно, коротко и понятно для ребёнка 3-7 лет.
Не используй списки, маркдаун или длинные предложения.
Твой ответ будет озвучен голосом — пиши так, как говоришь.
Продолжай контекст разговора. Если ребёнок говорит "давай" или "расскажи ещё" — продолжай тему.`;
}

export function detectFear(text) {
  const lower = text.toLowerCase();
  const detected = [];
  
  for (const [fearKey, keywords] of Object.entries(FEAR_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        detected.push(fearKey);
        break;
      }
    }
  }
  
  return detected;
}

export function detectAlertWords(text) {
  const lower = text.toLowerCase();
  return CONFIG.ALERT_KEYWORDS.filter(kw => lower.includes(kw));
}

export function detectPersonalData(text) {
  const lower = text.toLowerCase();
  return CONFIG.PERSONAL_DATA_KEYWORDS.filter(kw => lower.includes(kw));
}

export async function generateResponse(childText) {
  const systemPrompt = buildSystemPrompt();
  
  // Формируем историю для API
  const messages = [
    { role: 'system', content: systemPrompt }
  ];
  
  // Добавляем контекст (последние 10 сообщений)
  const recentContext = conversationContext.slice(-10);
  recentContext.forEach(ctx => {
    const role = ctx.role === 'child' ? 'user' : 'assistant';
    messages.push({ role, content: ctx.text });
  });
  
  // Добавляем текущее сообщение
  messages.push({ role: 'user', content: childText });
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getApiKey()}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 300,
        temperature: 0.8,
        top_p: 0.95
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ DeepSeek API error:', response.status, errorData);
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    
    // Очищаем ответ от маркдауна и лишних символов
    const cleanReply = reply
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_~`]/g, '')
      .trim();
    
    return cleanReply;
    
  } catch (error) {
    console.error('❌ Generate response error:', error.message);
    
    // Fallback ответы
    const char = CHARACTERS[currentCharacterId] || CHARACTERS['lucik'];
    const fallbacks = {
      lucik: ['Мурр... Давай ещё раз?', 'Мяу! Я немного задумался. Повтори, пожалуйста!', 'Ой, кажется связь прервалась. Скажи ещё разок?'],
      mom: ['Ой, задумалась... Давай ещё раз, солнышко?', 'Повтори, мой хороший, я не расслышала.', 'Что-то со связью. Скажи ещё раз, родной.'],
      dad: ['Хм, повтори ещё раз?', 'Не расслышал. Давай ещё разок.', 'Связь барахлит. Повтори, пожалуйста.'],
      kid1: ['Ой, давай ещё раз!', 'Я не понял(а). Повтори!', 'Ещё раз скажи!'],
      kid2: ['Давай ещё раз!', 'Не понял(а). Повтори!', 'Скажи ещё разок!']
    };
    
    const list = fallbacks[currentCharacterId] || fallbacks['lucik'];
    return list[Math.floor(Math.random() * list.length)];
  }
}

async function getApiKey() {
  // Пробуем получить ключ из разных источников
  if (typeof window !== 'undefined' && window.__DEEPSEEK_KEY__) {
    return window.__DEEPSEEK_KEY__;
  }
  
  try {
    const response = await fetch('/api/get-key');
    if (response.ok) {
      const data = await response.json();
      return data.key;
    }
  } catch (e) {
    // Используем встроенный ключ если есть
  }
  
  // Запасной ключ (если определён в переменных окружения клиента)
  return 'sk-placeholder-replace-with-real-key';
}

// Экспорт для использования в main.js
export function getConversationContext() {
  return conversationContext;
}
