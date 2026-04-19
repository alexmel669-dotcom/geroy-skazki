export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { text, voice = 'alexander' } = req.body;
    
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Текст обязателен' });
    }
    
    const API_KEY = process.env.YANDEX_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'Yandex API Key не настроен' });
    }
    
    try {
        // Используем старый, но стабильный API v1
        const url = `https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize`;
        
        const formData = new URLSearchParams();
        formData.append('text', text.slice(0, 500));
        formData.append('voice', voice);
        formData.append('emotion', 'good');
        formData.append('speed', '1.0');
        formData.append('format', 'mp3');
        formData.append('sampleRateHertz', '48000');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Yandex TTS error:', response.status, errorText);
            return res.status(response.status).json({ error: 'Ошибка синтеза речи: ' + errorText });
        }
        
        const audioBuffer = await response.arrayBuffer();
        console.log('Audio received, size:', audioBuffer.byteLength);
        
        // Проверяем первые байты (должны быть MP3)
        const bytes = new Uint8Array(audioBuffer).slice(0, 3);
        console.log('First bytes:', Array.from(bytes).map(b => b.toString(16)).join(' '));
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(Buffer.from(audioBuffer));
        
    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
}
