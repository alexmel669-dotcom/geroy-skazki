// api/tts.js — Яндекс SpeechKit с fallback
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const VOICE_MAP = { lucik:'zahar', mom:'jane', dad:'ermil', kid1:'oksana', kid2:'oksana' };
const EMOTION_SETTINGS = { good:1.0, friendly:0.95, calm:0.85, cheerful:1.05, sad:0.8 };

function sanitizeText(text) { return text.replace(/[^\w\s\.,!?\-а-яА-ЯёЁ]/g, ' ').replace(/\s+/g,' ').trim().substring(0,400); }

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        const { text, voice='lucik', emotion='good', speed: customSpeed } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ error: 'Нет текста' });

        const cleanText = sanitizeText(text);
        if (!cleanText) return res.status(400).json({ error: 'Текст не содержит допустимых символов' });

        const yandexVoice = VOICE_MAP[voice] || 'zahar';
        let finalSpeed = customSpeed ? parseFloat(customSpeed) : (EMOTION_SETTINGS[emotion] || 1.0);
        if (voice === 'kid1' || voice === 'kid2') finalSpeed = Math.min(1.0, finalSpeed + 0.05);
        if (cleanText.includes('сказка')) finalSpeed = Math.min(0.9, finalSpeed - 0.1);
        finalSpeed = Math.max(0.6, Math.min(1.4, finalSpeed));

        const apiKey = process.env.YANDEX_API_KEY;
        if (!apiKey) {
            console.error('Нет YANDEX_API_KEY');
            return res.status(503).json({ useFallback: true, error: 'YANDEX_API_KEY not configured' });
        }

        const params = new URLSearchParams();
        params.append('text', cleanText);
        params.append('voice', yandexVoice);
        params.append('format', 'mp3');
        params.append('sampleRateHertz', '48000');
        params.append('speed', finalSpeed.toString());

        const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
            method: 'POST', headers: { 'Authorization': `Api-Key ${apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!response.ok) {
            console.error('Яндекс ошибка', response.status);
            return res.status(503).json({ useFallback: true });
        }

        const audioBuffer = await response.arrayBuffer();
        if (!audioBuffer || audioBuffer.byteLength < 100) return res.status(503).json({ useFallback: true });

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(Buffer.from(audioBuffer));
    } catch (error) {
        console.error('TTS error', error);
        res.status(503).json({ useFallback: true });
    }
}
