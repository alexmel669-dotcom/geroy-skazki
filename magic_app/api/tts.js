// api/tts.js — Яндекс SpeechKit TTS с поддержкой всех персонажей
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Маппинг персонажей на голоса Яндекс SpeechKit (из паспорта)
const VOICE_MAP = {
    'lucik': 'zahar',     // мужской, дружелюбный
    'mom': 'jane',        // женский, нежный
    'dad': 'ermil',       // мужской, уверенный
    'kid1': 'oksana',     // женский, детский
    'kid2': 'oksana',     // женский, детский
    // fallback
    'zahar': 'zahar',
    'jane': 'jane',
    'ermil': 'ermil',
    'oksana': 'oksana'
};

// Экранирование текста для Яндекс API
function sanitizeText(text) {
    return text
        .replace(/[^\w\s\.,!?\-а-яА-ЯёЁ]/g, '') // убираем спецсимволы
        .replace(/\s+/g, ' ')                     // убираем лишние пробелы
        .trim()
        .substring(0, 500);                       // ограничение длины
}

export default async function handler(req, res) {
    // CORS настройки
    const allowedOrigins = ['https://geroy-skazki.vercel.app'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        // 1. ПРОВЕРКА JWT ТОКЕНА (опционально, но рекомендую для защиты бюджета)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Для MVP можно пропустить, но лучше включить
            if (process.env.NODE_ENV === 'production') {
                return res.status(401).json({ error: 'Требуется авторизация' });
            }
        } else {
            const token = authHeader.split(' ')[1];
            if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
                try {
                    jwt.verify(token, JWT_SECRET);
                } catch (err) {
                    return res.status(401).json({ error: 'Неверный токен' });
                }
            }
        }

        // 2. ПОЛУЧЕНИЕ ПАРАМЕТРОВ
        let { text, voice = 'lucik', speed = 0.9 } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста для озвучки' });
        }

        // 3. МАППИНГ ГОЛОСА
        const yandexVoice = VOICE_MAP[voice] || 'zahar';
        
        // Для детей делаем скорость чуть медленнее
        if (voice === 'kid1' || voice === 'kid2') {
            speed = 0.95;
        }
        // Для сказок на ночь — медленнее
        if (text.includes('сказка') || text.includes('спокойной ночи')) {
            speed = 0.85;
        }

        const cleanText = sanitizeText(text);
        
        if (cleanText.length === 0) {
            return res.status(400).json({ error: 'Текст не содержит допустимых символов' });
        }

        const apiKey = process.env.YANDEX_API_KEY;
        if (!apiKey) {
            console.error('❌ Нет YANDEX_API_KEY');
            return res.status(500).json({ error: 'API ключ Яндекса не настроен' });
        }

        // 4. ФОРМИРОВАНИЕ ЗАПРОСА
        const params = new URLSearchParams();
        params.append('text', cleanText);
        params.append('voice', yandexVoice);
        params.append('format', 'mp3');
        params.append('sampleRateHertz', '48000');
        params.append('speed', speed.toString());
        params.append('emotion', 'good'); // добавляем эмоциональную окраску

        console.log('🎤 Яндекс TTS:', { 
            voice: yandexVoice, 
            originalVoice: voice,
            speed,
            textLength: cleanText.length 
        });

        // 5. ЗАПРОС К ЯНДЕКС API
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
            return res.status(response.status).json({ error: 'Ошибка синтеза речи' });
        }

        const audioBuffer = await response.arrayBuffer();
        
        // 6. ОТВЕТ
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // кэшируем на час
        res.status(200).send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('❌ TTS ошибка:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
