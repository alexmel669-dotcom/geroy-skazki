import { setCors } from './_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from './_middleware/rate-limit.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 20)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { audio } = req.body;
    if (!audio) {
      return res.status(400).json({ error: 'Audio is required' });
    }

    const YANDEX_API_KEY = process.env.YANDEX_API_KEY?.trim();
    const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID?.trim();

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      console.warn('STT: Yandex keys not configured');
      return res.status(503).json({ text: '', fallback: true, error: 'STT not configured' });
    }

    // Исправление: используем Uint8Array вместо Buffer
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const contentType = req.body.contentType || 'audio/ogg;codecs=opus';
    const format = contentType.includes('ogg') ? 'oggopus' : 'lpcm';
    const params = new URLSearchParams({
      lang: 'ru-RU',
      folderId: YANDEX_FOLDER_ID,
      format
    });

    const sttUrl = `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?${params}`;

    console.log(`STT: sending ${bytes.length} bytes, format=${format}`);

    const response = await fetch(sttUrl, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': contentType
      },
      body: bytes
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yandex STT error:', response.status, errorText);
      return res.status(502).json({ error: 'Speech recognition failed', details: errorText.substring(0, 200) });
    }

    const data = await response.json();
    console.log('STT result:', data.result?.substring(0, 50) || '(empty)');
    
    return res.status(200).json({ text: data.result || '' });
  } catch (error) {
    console.error('STT error:', error.message);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
