// api/tts.js — Яндекс SpeechKit со всеми голосами
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

const VOICE_MAP = {
    lucik: 'zahar',
    mom: 'jane',
    dad: 'ermil',
    kid1: 'oksana',
    kid2: 'oksana'
};

function sanitizeText(text) {
    return text
        .replace(/[^\w\s\.,!?\-а-яА-ЯёЁ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500);
}

export default async function handler(req, res) {
    // CORS
    const allowedOrigins = ['https://geroy-skazki.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        // Проверка JWT (опционально, пропускаем если гость)
        const authHeader = req.headers.authorization;
        let isGuest = false;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
                try {
                    jwt.verify(token, JWT_SECRET);
                } catch {
                    // Токен невалидный, но мы можем разрешить гостевой режим
                    isGuest = true;
                }
            }
        } else {
            isGuest = true;
        }

        let { text, voice = 'lucik', speed = 0.9 } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста' });
        }

        const yandexVoice = VOICE_MAP[voice] || 'zahar';

        // Настройка скорости для разных персонажей
        if (voice === 'kid1' || voice === 'kid2') speed = 0.95;
        if (text.includes('сказка') || text.includes('спокойной ночи')) speed = 0.85;

        const cleanText = sanitizeText(text);
        if (cleanText.length === 0) {
            return res.status(400).json({ error: 'Нет допустимых символов' });
        }

        const apiKey = process.env.YANDEX_API_KEY;
        if (!apiKey) {
            console.error('YANDEX_API_KEY не настроен');
            return res.status(500).json({ error: 'API ключ не настроен' });
        }

        const params = new URLSearchParams();
        params.append('text', cleanText);
        params.append('voice', yandexVoice);
        params.append('format', 'mp3');
        params.append('sampleRateHertz', '48000');
        params.append('speed', speed.toString());
        params.append('lang', 'ru-RU');

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
            console.error('Yandex TTS error:', response.status, errorText);
            return res.status(response.status).json({ error: 'Ошибка синтеза речи' });
        }

        const audioBuffer = await response.arrayBuffer();

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('TTS ошибка:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
