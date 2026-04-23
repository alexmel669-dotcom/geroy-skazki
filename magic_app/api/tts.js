// api/tts.js — Яндекс SpeechKit со всеми голосами
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

const VOICE_MAP = {
  lucik: 'zahar',
  mom: 'jane',
  dad: 'ermil',
  kid1: 'alena',
  kid2: 'filipp'
};

function sanitizeText(text) {
  return text
    .replace(/[^\w\s\.,!?\-а-яА-ЯёЁ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500);
}

export default async function handler(req, res) {
  const allowedOrigins = ['https://geroy-skazki.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.split(' ')[1];
    
    if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
      if (!token.startsWith('guest_token_')) {
        try {
          jwt.verify(token, JWT_SECRET);
        } catch {
          return res.status(401).json({ error: 'Неверный токен' });
        }
      }
    }

    let { text, voice = 'lucik', speed = 0.9 } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Нет текста' });
    }

    const yandexVoice = VOICE_MAP[voice] || 'zahar';

    if (voice === 'kid1' || voice === 'kid2') speed = 0.95;
    if (text.includes('сказка') || text.includes('спокойной ночи')) speed = 0.85;

    const cleanText = sanitizeText(text);

    if (cleanText.length === 0) {
      return res.status(400).json({ error: 'Нет допустимых символов' });
    }

    const apiKey = process.env.YANDEX_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API ключ не настроен' });
    }

    const params = new URLSearchParams();
    params.append('text', cleanText);
    params.append('voice', yandexVoice);
    params.append('format', 'mp3');
    params.append('sampleRateHertz', '48000');
    params.append('speed', speed.toString());

    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Ошибка синтеза' });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS ошибка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
}
