export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { text, voice = 'alexander', emotion = 'good', speed = 1.0 } = req.body;
    
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
        // Формируем тело запроса для SpeechKit API v3
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
        
        console.log('Sending request to Yandex TTS...', JSON.stringify(requestBody));
        
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
            return res.status(response.status).json({ error: 'Ошибка синтеза речи: ' + errorText });
        }
        
        const audioBuffer = await response.arrayBuffer();
        console.log('Audio received, size:', audioBuffer.byteLength);
        
        // Проверяем, что это действительно MP3 (начинается с ID3 или 0xFF)
        const firstByte = new Uint8Array(audioBuffer)[0];
        console.log('First byte:', firstByte.toString(16));
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(Buffer.from(audioBuffer));
        
    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
    }
}
