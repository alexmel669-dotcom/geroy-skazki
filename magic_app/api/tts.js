export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { text, voice = 'ermil', emotion = 'good', speed = 1.0 } = req.body;
    
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Текст обязателен' });
    }
    
    const API_KEY = process.env.YANDEX_API_KEY;
    const FOLDER_ID = process.env.YANDEX_FOLDER_ID;
    
    if (!API_KEY || !FOLDER_ID) {
        console.error('Yandex Cloud не настроен');
        return res.status(500).json({ error: 'Сервис временно недоступен' });
    }
    
    try {
        const requestBody = {
            text: text.slice(0, 500),
            hints: [
                { voice: voice },
                { role: emotion },
                { speed: speed }
            ],
            outputAudioSpec: {
                containerAudio: {
                    containerAudioType: 'MP3'
                }
            }
        };
        
        const response = await fetch('https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis', {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Yandex TTS error:', response.status, errorText);
            return res.status(response.status).json({ error: 'Ошибка синтеза речи' });
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(audioBuffer));
        
    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
