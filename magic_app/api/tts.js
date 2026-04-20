// api/tts.js — Яндекс SpeechKit TTS (голос Оксана)
export default async function handler(req, res) {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён. Используйте POST.' });
  }

  let text = '';
  let voice = 'oksana';

  try {
    // Парсим тело запроса
    const body = req.body;
    text = body.text || '';
    voice = body.voice || 'oksana';
    
    // Убираем лишние символы
    text = text.replace(/[^\w\s\.,!?а-яА-ЯёЁ-]/g, '').trim();
    
    if (!text) {
      return res.status(400).json({ error: 'Нет текста для озвучки' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Неверный формат запроса' });
  }

  const apiKey = process.env.YANDEX_API_KEY;
  if (!apiKey) {
    console.error('❌ Нет YANDEX_API_KEY');
    return res.status(500).json({ error: 'API ключ не настроен' });
  }

  try {
    // Правильный запрос к Яндекс SpeechKit
    const requestBody = {
      text: text,
      voice: voice,
      format: 'wav',
      sampleRateHertz: 48000,
      speed: 0.9
    };

    console.log('🎤 Отправляем в Яндекс:', { text: text.substring(0, 50), voice });

    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorText = await response.text();
      console.error('❌ Яндекс ошибка:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Ошибка SpeechKit',
        details: errorText 
      });
    }

    const audioBuffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('❌ TTS ошибка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
