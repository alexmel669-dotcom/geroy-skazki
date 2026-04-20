// api/tts.js — Яндекс SpeechKit TTS (голос Оксана)
export default async function handler(req, res) {
  // 1. Разрешаем только POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Метод не разрешён. Используйте POST.' });
  }

  // 2. Разбираем тело запроса
  let text = '';
  let voice = 'oksana';
  let speed = 1.0;

  try {
    const body = req.body;
    text = body.text || '';
    voice = body.voice || 'oksana';
    speed = body.speed || 1.0;
  } catch (err) {
    return res.status(400).json({ error: 'Неверный формат JSON' });
  }

  // 3. Проверяем текст
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Нет текста для озвучки' });
  }

  // 4. Проверяем API-ключ
  const apiKey = process.env.YANDEX_API_KEY;
  if (!apiKey) {
    console.error('❌ Нет YANDEX_API_KEY в переменных окружения');
    return res.status(500).json({ error: 'API ключ не настроен на сервере' });
  }

  try {
    // 5. Формируем запрос к Яндекс SpeechKit v1 (более стабильный)
    const requestBody = {
      text: text,
      voice: voice,        // oksana, jane, omazh, zahar, ermil
      format: 'wav',
      sampleRateHertz: 48000,
      speed: speed
    };

    console.log('🎤 Отправляем в Яндекс:', { text: text.substring(0, 50), voice, speed });

    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // 6. Обрабатываем ответ Яндекса
    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorJson = await response.json();
        errorDetails = JSON.stringify(errorJson);
      } catch(e) {
        errorDetails = await response.text();
      }
      console.error('❌ Яндекс SpeechKit ошибка:', response.status, errorDetails);
      return res.status(response.status).json({ 
        error: 'Ошибка Яндекс SpeechKit',
        status: response.status,
        details: errorDetails
      });
    }

    // 7. Получаем аудио и отправляем клиенту
    const audioBuffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('❌ Внутренняя ошибка TTS:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', message: error.message });
  }
}
