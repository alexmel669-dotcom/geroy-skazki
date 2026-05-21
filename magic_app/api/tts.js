// api/tts.js — Яндекс SpeechKit TTS
// Обновлено: 21 мая 2026
// Поддержка эмоций и улучшенная обработка ошибок

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Карта голосов
const VOICE_MAP = {
    lucik: 'zahar',   // мужской, добрый
    mom: 'jane',      // женский, мягкий
    dad: 'ermil',     // мужской, уверенный
    kid1: 'oksana',   // детский женский
    kid2: 'oksana'    // детский женский
};

// Карта эмоций (влияет на скорость и тон)
const EMOTION_SETTINGS = {
    good: { speed: 1.0, volume: 1.0 },
    friendly: { speed: 0.95, volume: 1.0 },
    calm: { speed: 0.85, volume: 0.9 },
    cheerful: { speed: 1.05, volume: 1.0 },
    sad: { speed: 0.8, volume: 0.85 },
    scared: { speed: 0.9, volume: 0.9 }
};

function sanitizeText(text) {
    if (!text) return '';
    // Оставляем буквы, цифры, базовые знаки препинания, русские буквы
    return text
        .replace(/[^\w\s\.,!?\-а-яА-ЯёЁ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500);
}

// Fallback озвучка через Web Speech API (на стороне клиента)
function getFallbackResponse(text, voice) {
    // Возвращаем специальный статус для клиентского fallback
    return {
        useFallback: true,
        text: text,
        voice: voice
    };
}

export default async function handler(req, res) {
    // CORS для всех доменов (для разработки и production)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        // ========== ПРОВЕРКА АВТОРИЗАЦИИ (необязательная для TTS) ==========
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me' && token && !token.startsWith('guest_token_')) {
                try {
                    jwt.verify(token, JWT_SECRET);
                } catch (jwtError) {
                    // Токен невалидный, но озвучку всё равно даём
                    console.log('JWT verification failed for TTS, continuing:', jwtError.message);
                }
            }
        }

        // ========== ПРИНИМАЕМ ПАРАМЕТРЫ ==========
        let { 
            text, 
            voice = 'lucik', 
            speed: inputSpeed, 
            emotion = 'good' 
        } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста для озвучки' });
        }

        // Очищаем текст
        const cleanText = sanitizeText(text);
        if (cleanText.length === 0) {
            return res.status(400).json({ error: 'Текст не содержит допустимых символов' });
        }

        // Определяем голос
        const yandexVoice = VOICE_MAP[voice] || 'zahar';
        
        // Определяем скорость (приоритет: inputSpeed > emotion > дефолт)
        let finalSpeed = 1.0;
        if (inputSpeed && !isNaN(parseFloat(inputSpeed))) {
            finalSpeed = parseFloat(inputSpeed);
        } else {
            const emotionConfig = EMOTION_SETTINGS[emotion] || EMOTION_SETTINGS.good;
            finalSpeed = emotionConfig.speed;
        }
        
        // Корректировки для детских голосов
        if (voice === 'kid1' || voice === 'kid2') {
            finalSpeed = Math.min(1.0, finalSpeed + 0.05);
        }
        
        // Для сказок на ночь - медленнее
        if (cleanText.includes('сказка') || cleanText.includes('спокойной ночи') || emotion === 'calm') {
            finalSpeed = Math.min(0.9, finalSpeed - 0.1);
        }
        
        // Ограничиваем скорость в разумных пределах
        finalSpeed = Math.max(0.5, Math.min(1.5, finalSpeed));

        // ========== ВЫЗОВ ЯНДЕКС TTS API ==========
        const apiKey = process.env.YANDEX_API_KEY;
        if (!apiKey) {
            console.error('❌ Нет YANDEX_API_KEY, используем fallback');
            // Возвращаем статус для клиентского fallback
            return res.status(503).json({ 
                error: 'TTS service unavailable',
                useFallback: true,
                message: 'YANDEX_API_KEY not configured'
            });
        }

        const params = new URLSearchParams();
        params.append('text', cleanText);
        params.append('voice', yandexVoice);
        params.append('format', 'mp3');
        params.append('sampleRateHertz', '48000');
        params.append('speed', finalSpeed.toString());

        console.log(`🎤 TTS запрос: voice=${yandexVoice}, speed=${finalSpeed}, text_len=${cleanText.length}`);

        const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Яндекс ошибка:', response.status, errorText);
            
            // При ошибке Яндекс API возвращаем статус для клиентского fallback
            return res.status(503).json({ 
                error: 'Yandex TTS error',
                status: response.status,
                useFallback: true,
                message: errorText.substring(0, 200)
            });
        }

        // Получаем аудио
        const audioBuffer = await response.arrayBuffer();
        
        if (!audioBuffer || audioBuffer.byteLength < 100) {
            console.error('❌ Получен пустой аудиофайл');
            return res.status(503).json({ 
                error: 'Empty audio received',
                useFallback: true
            });
        }

        // Успешный ответ
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Length', audioBuffer.byteLength);
        res.status(200).send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('❌ TTS ошибка:', error);
        // Возвращаем статус для клиентского fallback
        res.status(503).json({ 
            error: 'Internal server error',
            useFallback: true,
            message: error.message
        });
    }
}
