// api/speech.js — Яндекс SpeechKit TTS (озвучка текста)
export default async function handler(req, res) {
  // Только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'oksana' } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Нет текста для озвучки' });
    }

    const apiKey = process.env.YANDEX_API_KEY;
    if (!apiKey) {
      console.error('❌ Нет YANDEX_API_KEY в переменных окружения');
      return res.status(500).json({ error: 'API ключ не настроен' });
    }

    // Формируем запрос к Яндекс SpeechKit v3
    const requestBody = {
      text: text,
      voice: voice,           // oksana, jane, omazh, zahar, ermil
      emotion: 'neutral',     // neutral, good, evil
      speed: 1.0,
      format: 'wav',          // wav или mp3
      sampleRateHertz: 48000
    };

    console.log('🎤 Отправляем в Яндекс:', requestBody);

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
      console.error('❌ Яндекс вернул ошибку:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Ошибка SpeechKit',
        details: errorText 
      });
    }

    // Получаем аудио (binary)
    const audioBuffer = await response.arrayBuffer();
    
    // Отправляем как audio/wav
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('❌ Ошибка в speech.js:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
