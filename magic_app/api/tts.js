// api/tts.js — Яндекс SpeechKit TTS
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'oksana', speed = 1.0 } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Нет текста' });
    }

    const apiKey = process.env.YANDEX_API_KEY;
    if (!apiKey) {
      console.error('❌ Нет YANDEX_API_KEY');
      return res.status(500).json({ error: 'API ключ не настроен' });
    }

    // Правильный формат для Яндекс SpeechKit v3
    const requestBody = {
      text: text,
      voice: voice,        // oksana, jane, omazh, zahar, ermil
      speed: speed,
      format: 'wav',
      sampleRateHertz: 48000
    };

    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Яндекс ошибка:', response.status, errorText);
      return res.status(response.status).json({ error: 'TTS ошибка' });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('❌ TTS ошибка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
}
