import { appState } from './core.js';
import { containsBadWords, sanitizeInput } from './security.js';
import { FALLBACK_REPLIES, FEAR_KEYWORDS, CONFIG } from './config.js';

// Очередь запросов для предотвращения гонки
let pendingRequest = null;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // Минимальный интервал между запросами

export async function askDeepSeek(text, isLong = false) {
  // Проверка на плохие слова
  if (containsBadWords(text)) {
    return "Мяу! Давай говорить добрые слова! 🌟";
  }
  
  // Санитизация ввода
  const cleanedText = sanitizeInput(text);
  if (!cleanedText) {
    return "Мурр... Я не понял. Скажи ещё раз!";
  }
  
  // Ждем завершения предыдущего запроса
  if (pendingRequest) {
    await pendingRequest;
  }
  
  // Соблюдаем интервал между запросами
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  const avatar = document.getElementById('avatar');
  if (avatar) avatar.classList.add('thinking');
  
  pendingRequest = (async () => {
    try {
      lastRequestTime = Date.now();
      
      // Формируем историю для API (последние 12 сообщений)
      const historyForAPI = (appState.conversationHistory || [])
        .slice(-CONFIG.HISTORY_FOR_API)
        .filter(msg => msg.role && msg.content)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // Определяем эмоциональный контекст
      const emotionalContext = analyzeEmotionalState();
      
      console.log('🤖 Sending to AI:', {
        text: cleanedText.substring(0, 50),
        historyLength: historyForAPI.length,
        character: appState.currentChar,
        isLong,
        emotionalContext
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanedText,
          history: historyForAPI,
          character: appState.currentChar,
          childName: appState.childName,
          childAge: appState.childAge,
          isLong,
          fearStats: appState.fearStats || {},
          emotionalContext,
          appVersion: CONFIG.APP_VERSION
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Обрабатываем обнаруженный страх
      if (data.detectedFear) {
        const { updateFear } = await import('./core.js');
        updateFear(data.detectedFear);
      }
      
      // Валидируем ответ
      let reply = data.reply;
      if (!reply || reply.length < 2) {
        reply = getFallbackReply();
      }
      
      // Проверяем ответ на плохие слова (защита от ИИ)
      if (containsBadWords(reply)) {
        reply = "Извини, давай поговорим о чём-нибудь добром! 🌈";
      }
      
      console.log('✅ AI Response:', reply.substring(0, 50));
      return reply;
      
    } catch (error) {
      console.error('AI request failed:', error.message);
      return getFallbackReply();
    } finally {
      if (avatar) avatar.classList.remove('thinking');
      pendingRequest = null;
    }
  })();
  
  return await pendingRequest;
}

// Анализ эмоционального состояния ребенка
function analyzeEmotionalState() {
  const stats = appState.fearStats || {};
  const bravery = appState.bravery || 0;
  const mood = appState.mood || 70;
  
  // Находим главный страх
  const mainFear = Object.entries(stats)
    .sort(([,a], [,b]) => b - a)[0];
  
  // Определяем уровень тревожности
  let anxietyLevel = 'low';
  if (Object.values(stats).some(v => v > 5)) anxietyLevel = 'high';
  else if (Object.values(stats).some(v => v > 2)) anxietyLevel = 'medium';
  
  return {
    mainFear: mainFear ? mainFear[0] : null,
    mainFearLevel: mainFear ? mainFear[1] : 0,
    anxietyLevel,
    bravery,
    mood,
    isTired: appState.energy < 30,
    isHungry: appState.hunger < 30
  };
}

// Получение fallback ответа
function getFallbackReply() {
  const replies = FALLBACK_REPLIES;
  const char = appState.currentChar || 'lucik';
  
  if (replies[char]) {
    return replies[char];
  }
  
  // Если нет ответа для персонажа, используем Люцика
  return replies.lucik || "Мурр... Давай ещё раз?";
}

// Локальное определение страхов (быстрая проверка до API)
export function detectFearLocally(text) {
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  for (const [fear, keywords] of Object.entries(FEAR_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return fear;
    }
  }
  
  return null;
}

// Получение контекстных подсказок для ИИ
export function getEmotionalHints() {
  const context = analyzeEmotionalState();
  const hints = [];
  
  if (context.anxietyLevel === 'high') {
    hints.push('Ребёнок тревожен, будь особенно мягким');
  }
  
  if (context.isTired) {
    hints.push('Ребёнок устал, говори тише и спокойнее');
  }
  
  if (context.isHungry) {
    hints.push('Ребёнок голоден, можно предложить "покормить" персонажа');
  }
  
  return hints;
}
