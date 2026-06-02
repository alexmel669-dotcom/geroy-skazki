import { setCors } from './_cors.js';
import { checkRateLimit, getRateLimitKey } from './_rateLimit.js';

// Кеш для частых фраз
const ttsCache = new Map();
const MAX_CACHE_SIZE = 50;
const CACHE_TTL = 3600000; // 1 час

// Часто используемые фразы для предварительного кеширования
const COMMON_PHRASES = new Set([
  'Привет!',
  'Мурр!',
  'Отлично!',
  'Давай играть!',
  'Ты молодец!',
  'Не бойся!',
  'Всё хорошо!',
  'Пока!',
  'Мурр... Давай ещё раз?',
  'Подожди...',
  'Привет, малыш!',
  'Как дела?',
  'Что будем делать?',
  'Расскажи сказку!'
]);

export default async function handler(req, res) {
  // CORS
  if (setCors(req, res)) return;
  
  // Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Rate limiting
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit('tts_' + clientKey, 30, 60000)) {
    return res.status(429).json({ 
      error: 'Слишком много запросов. Подожди минутку!',
      retryAfter: 60 
    });
  }
  
  try {
    const { 
      text, 
      voice = 'lucik', 
      emotion = 'good', 
      speed = 1.0,
      format = 'mp3'
    } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Ограничение длины текста
    const truncatedText = text.substring(0, 500);
    
    // Проверяем кеш
    const cacheKey = `${truncatedText}_${voice}_${emotion}_${speed}`;
    
    if (ttsCache.has(cacheKey)) {
      const cached = ttsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(cached.buffer);
      } else {
        ttsCache.delete(cacheKey);
      }
    }
    
    console.log('🎤 Запрос TTS:', { 
      textLength: truncatedText.length, 
      voice, 
      emotion, 
      speed,
      cached: false 
    });
    
    // Запрос к Яндекс SpeechKit
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const yandexResponse = await fetch(
      'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}`
        },
        body: new URLSearchParams({
          text: truncatedText,
          lang: 'ru-RU',
          voice: getYandexVoice(voice),
          emotion,
          speed: speed.toString(),
          format
        }).toString(),
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!yandexResponse.ok) {
      const errorText = await yandexResponse.text();
      console.error('Yandex TTS error:', yandexResponse.status, errorText);
      throw new Error(`Yandex TTS returned ${yandexResponse.status}`);
    }
    
    const buffer = Buffer.from(await yandexResponse.arrayBuffer());
    
    if (buffer.length < 100) {
      throw new Error('Empty audio response');
    }
    
    // Кешируем частые фразы
    if (COMMON_PHRASES.has(truncatedText) || ttsCache.size < MAX_CACHE_SIZE) {
      // Очищаем старые записи если кеш переполнен
      if (ttsCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = ttsCache.keys().next().value;
        ttsCache.delete(oldestKey);
      }
      
      ttsCache.set(cacheKey, {
        buffer,
        timestamp: Date.now()
      });
    }
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    return res.status(200).send(buffer);
    
  } catch (error) {
    console.error('TTS error:', error.message);
    
    // Возвращаем тишину вместо ошибки
    const silentBuffer = generateSilentAudio();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(silentBuffer);
  }
}

function getYandexVoice(voice) {
  const voiceMap = {
    'lucik': 'alena',
    'mom': 'alena',
    'dad': 'filipp',
    'kid1': 'alena',
    'kid2': 'alena'
  };
  return voiceMap[voice] || 'alena';
}

function generateSilentAudio() {
  // Генерируем минимальный валидный MP3 файл с тишиной
  // Это заглушка, в реальности лучше использовать готовый файл
  return Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);
}
