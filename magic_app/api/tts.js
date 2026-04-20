// api/tts.js — Яндекс SpeechKit TTS (голос Оксана)
export default async function handler(req, res) {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён. Используйте POST.' });
  }

  let text = '';
  let voice = 'oksana';
  let speed = 0.9;

  try {
    const body = req.body;
    text = body.text || '';
    voice = body.voice || 'oksana';
    speed = body.speed || 0.9;
    
    // Очищаем текст от эмодзи и спецсимволов
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
    // ⚠️ ВАЖНО: Яндекс SpeechKit v1 НЕ принимает JSON!
    // Используем URLSearchParams для x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('voice', voice);
    params.append('format', 'wav');
    params.append('sampleRateHertz', '48000');
    params.append('speed', speed.toString());

    console.log('🎤 Отправляем в Яндекс (form-urlencoded):', { text: text.substring(0, 50), voice, speed });

    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'  // ← КЛЮЧЕВОЙ МОМЕНТ!
      },
      body: params.toString()  // ← НЕ JSON, а form-urlencoded
    });

    if (!response.ok) {
      let errorText = await response.text();
      console.error('❌ Яндекс ошибка:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Ошибка SpeechKit',
        status: response.status,
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
