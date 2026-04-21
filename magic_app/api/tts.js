// api/tts.js — Яндекс SpeechKit TTS (голос Оксана и Zahar)
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
      console.error('❌ Нет YANDEX_API_KEY');
      return res.status(500).json({ error: 'API ключ не настроен' });
    }

    // Очищаем текст
    const cleanText = text.replace(/[^\w\s\.,!?а-яА-ЯёЁ-]/g, '').substring(0, 500);
    
    // Используем form-urlencoded как требует v1 API
    const params = new URLSearchParams();
    params.append('text', cleanText);
    params.append('voice', voice);
    params.append('format', 'mp3');
    params.append('sampleRateHertz', '48000');
    params.append('speed', speed.toString());

    console.log('🎤 Отправляем в Яндекс:', { text: cleanText.substring(0, 50), voice });

    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Яндекс ошибка:', response.status, errorText);
      return res.status(response.status).json({ error: 'Ошибка SpeechKit' });
    }

    const audioBuffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('❌ TTS ошибка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
}
