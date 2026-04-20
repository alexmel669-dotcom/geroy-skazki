// api/tts.js — Яндекс SpeechKit TTS v3
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'oksana', speed = 0.9 } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Нет текста' });
    }

    const apiKey = process.env.YANDEX_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API ключ не настроен' });
    }

    // v3 API — другой эндпоинт и формат
    const requestBody = {
      text: text,
      voice: voice,
      speed: speed,
      outputAudioSpec: {
        containerAudio: {
          containerAudioType: 'WAV'
        }
      }
    };

    const response = await fetch('https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Яндекс v3 ошибка:', response.status, errorText);
      return res.status(response.status).json({ error: 'TTS ошибка' });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/wav');
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('❌ TTS ошибка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
}
