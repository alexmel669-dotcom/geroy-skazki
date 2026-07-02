import { setCors } from '../_middleware/cors.js';
import { checkRateLimit } from '../_middleware/ai-rate-limit.js';
import { base64ToBytes } from '../_lib/base64.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateCheck = checkRateLimit(req, 'stt');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Слишком много запросов', retryAfter: rateCheck.retryAfter });
  }

  try {
    const { audio } = req.body;
    if (!audio) {
      return res.status(400).json({ error: 'Audio is required' });
    }

    const YANDEX_API_KEY = process.env.YANDEX_API_KEY?.trim();
    const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID?.trim();

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      return res.status(503).json({ text: '', fallback: true, error: 'STT not configured' });
    }

    const audioBytes = base64ToBytes(audio);
    if (audioBytes.length < 3200) {
      return res.status(400).json({ text: '', error: 'Audio too short', fallback: true });
    }

    const contentType = req.body.contentType || 'audio/ogg;codecs=opus';
    const format = req.body.format || (contentType.includes('ogg') ? 'oggopus' : 'lpcm');
    const isAndroidClient = req.body.platform === 'android' || contentType.includes('ogg');
    const params = new URLSearchParams({
      lang: 'ru-RU',
      folderId: YANDEX_FOLDER_ID,
      format,
      topic: 'general',
      profanityFilter: 'false'
    });
    if (format === 'lpcm') {
      params.set('sampleRateHz', String(req.body.sampleRateHz || 16000));
    }

    const sttUrl = `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?${params}`;

    const yandexContentType = format === 'lpcm'
      ? 'application/octet-stream'
      : (isAndroidClient || format === 'oggopus' ? 'audio/ogg' : contentType);

    const response = await fetch(sttUrl, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': yandexContentType
      },
      body: audioBytes
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yandex STT error:', response.status, errorText);
      return res.status(502).json({ text: '', error: 'Speech recognition failed', fallback: true });
    }

    const data = await response.json();
    const text = (data.result || '').trim();
    if (!text) {
      console.warn('Yandex STT empty result', {
        audioBytes: audioBytes.length,
        format,
        sampleRateHz: params.get('sampleRateHz') || 'n/a'
      });
    }
    return res.status(200).json({ text, audioBytes: audioBytes.length, empty: !text });
  } catch (error) {
    console.error('STT error:', error);
    return res.status(500).json({ text: '', error: 'Internal server error', fallback: true });
  }
}
