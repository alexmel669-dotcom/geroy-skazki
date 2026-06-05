import { setCors } from './_middleware/cors.js';

// Разрешённые голоса Yandex SpeechKit
const ALLOWED_VOICES = ['alena', 'filipp', 'ermil', 'jane'];

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

    // Проверяем и подменяем неподдерживаемый голос
    const safeVoice = ALLOWED_VOICES.includes(voice) ? voice : 'alena';
    
    if (voice && !ALLOWED_VOICES.includes(voice)) {
      console.log(`⚠️ Голос "${voice}" не поддерживается, заменён на "${safeVoice}"`);
    }

    const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
    const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      console.error('❌ Missing Yandex credentials');
      return res.status(500).json({ error: 'TTS not configured' });
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

    console.log(`📡 TTS запрос: голос=${safeVoice}, текст="${text.substring(0, 40)}..."`);

    const response = await fetch(`${ttsUrl}?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${YANDEX_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Yandex TTS error:', response.status, errorText);
      return res.status(500).json({ error: 'TTS synthesis failed', status: response.status });
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(audioArrayBuffer);
    
    // Конвертируем в base64 без Buffer
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const audioBase64 = btoa(binary);
    const audioDataUrl = `data:audio/mp3;base64,${audioBase64}`;

    console.log(`✅ TTS успешно: ${uint8Array.length} bytes`);

    return res.status(200).json({ 
      audioUrl: audioDataUrl,
      format: 'mp3',
      size: uint8Array.length
    });

  } catch (error) {
    console.error('❌ TTS error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
