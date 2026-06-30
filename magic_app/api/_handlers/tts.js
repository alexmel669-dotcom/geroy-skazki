import { setCors } from '../_middleware/cors.js';
import { checkRateLimit } from '../_middleware/ai-rate-limit.js';
import { arrayBufferToBase64 } from '../_lib/base64.js';

const ALLOWED_VOICES = ['zahar', 'alena', 'filipp', 'ermil', 'jane', 'oksana'];

const voiceMap = {
  lucik: 'zahar',
  mom: 'jane',
  dad: 'ermil',
  kid1: 'oksana',
  kid2: 'oksana'
};

function normalizeApiKey(raw) {
  if (!raw) return '';
  let key = raw.trim();
  if (key.startsWith('Api-Key ')) key = key.slice(8).trim();
  if (key.startsWith('Bearer ')) key = key.slice(7).trim();
  return key;
}

function authHeaderForKey(key) {
  if (key.startsWith('t1.') || key.startsWith('y0_')) {
    return `Bearer ${key}`;
  }
  return `Api-Key ${key}`;
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateCheck = checkRateLimit(req, 'tts');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Слишком много запросов', retryAfter: rateCheck.retryAfter });
  }

  try {
    const { text, voice, speed } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const mappedVoice = voiceMap[voice] || voice || 'zahar';
    const safeVoice = ALLOWED_VOICES.includes(mappedVoice) ? mappedVoice : 'zahar';

    const YANDEX_API_KEY = normalizeApiKey(process.env.YANDEX_API_KEY);
    const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID?.trim();

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      console.error('TTS: Missing credentials', {
        hasKey: !!YANDEX_API_KEY,
        hasFolder: !!YANDEX_FOLDER_ID
      });
      return res.status(503).json({ error: 'TTS not configured', fallback: true });
    }

    console.log('TTS request:', {
      keyLen: YANDEX_API_KEY.length,
      folderId: YANDEX_FOLDER_ID,
      voice: safeVoice,
      textLen: text.length
    });

    const params = new URLSearchParams({
      text,
      lang: 'ru-RU',
      voice: safeVoice,
      folderId: YANDEX_FOLDER_ID,
      format: 'mp3',
      sampleRateHertz: '48000'
    });
    if (speed) params.set('speed', String(speed));

    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        Authorization: authHeaderForKey(YANDEX_API_KEY),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('TTS Error:', response.status, errText);
      return res.status(503).json({
        error: 'TTS failed',
        status: response.status,
        detail: errText.slice(0, 200),
        fallback: true
      });
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioArrayBuffer);

    return res.status(200).json({
      audioUrl: `data:audio/mp3;base64,${audioBase64}`,
      format: 'mp3',
      size: audioArrayBuffer.byteLength
    });
  } catch (error) {
    console.error('TTS Error:', error.message);
    return res.status(503).json({ error: 'TTS error', detail: error.message, fallback: true });
  }
}
