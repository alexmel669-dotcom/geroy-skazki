import { setCors } from './_middleware/cors.js';

const ALLOWED_VOICES = ['zahar', 'alena', 'filipp', 'ermil', 'jane', 'oksana'];

const voiceMap = {
  'lucik': 'zahar',
  'mom': 'jane',
  'dad': 'ermil',
  'kid1': 'oksana',
  'kid2': 'oksana'
};

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice, speed, emotion } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const mappedVoice = voiceMap[voice] || voice || 'zahar';
    const safeVoice = ALLOWED_VOICES.includes(mappedVoice) ? mappedVoice : 'zahar';

    const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
    const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      return res.status(503).json({ error: 'TTS not configured', fallback: true });
    }

    const ttsUrl = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize';
    
    const params = new URLSearchParams({
      text: text,
      lang: 'ru-RU',
      voice: safeVoice,
      speed: speed || '1.0',
      emotion: emotion || 'neutral',
      format: 'mp3',
      folderId: YANDEX_FOLDER_ID
    });

    console.log(`📡 TTS: голос=${safeVoice}, текст="${text.substring(0, 40)}..."`);

    const response = await fetch(`${ttsUrl}?${params}`, {
      method: 'POST',
      headers: { 'Authorization': `Api-Key ${YANDEX_API_KEY}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Yandex TTS error:', response.status, errorText);
      return res.status(500).json({ error: 'TTS synthesis failed' });
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');
    const audioDataUrl = `data:audio/mp3;base64,${audioBase64}`;

    return res.status(200).json({
      audioUrl: audioDataUrl,
      format: 'mp3',
      size: audioArrayBuffer.byteLength
    });

  } catch (error) {
    console.error('❌ TTS error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
