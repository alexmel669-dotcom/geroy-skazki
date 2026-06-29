import { setCors } from '../_middleware/cors.js';
import { applyAiRateLimit } from '../_middleware/ai-rate-limit.js';
import { arrayBufferToBase64 } from '../_lib/base64.js';

const ALLOWED_VOICES = ['zahar', 'alena', 'filipp', 'ermil', 'jane', 'oksana'];

const voiceMap = {
  lucik: 'zahar',
  mom: 'jane',
  dad: 'ermil',
  kid1: 'oksana',
  kid2: 'oksana'
};

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { allowed } = applyAiRateLimit(req, res, { authMax: 15, anonMax: 6 });
  if (!allowed) return;

  try {
    const { text, voice, speed } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const mappedVoice = voiceMap[voice] || voice || 'zahar';
    const safeVoice = ALLOWED_VOICES.includes(mappedVoice) ? mappedVoice : 'zahar';

    const YANDEX_API_KEY = process.env.YANDEX_API_KEY?.trim();
    const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID?.trim();

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      console.error('TTS: Missing Yandex credentials');
      return res.status(503).json({ error: 'TTS not configured', fallback: true });
    }

    const params = new URLSearchParams({
      text,
      lang: 'ru-RU',
      voice: safeVoice,
      speed: speed || '1.0',
      format: 'mp3',
      folderId: YANDEX_FOLDER_ID
    });

    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS Error: Yandex', response.status, errorText);
      return res.status(503).json({
        error: 'TTS synthesis failed',
        details: errorText.slice(0, 200),
        fallback: true,
        yandexStatus: response.status
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
    return res.status(503).json({ error: 'TTS error', details: error.message, fallback: true });
  }
}
