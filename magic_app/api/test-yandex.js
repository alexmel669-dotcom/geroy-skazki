// api/test-yandex.js — Тест Яндекс SpeechKit (версия от 19 апреля)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const apiKey = process.env.YANDEX_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ error: 'YANDEX_API_KEY не настроен' });
    }
    
    try {
        const params = new URLSearchParams();
        params.append('text', 'Привет, это тестовое сообщение');
        params.append('voice', 'oksana');
        params.append('format', 'mp3');
        
        const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });
        
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Ошибка синтеза' });
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.status(200).send(Buffer.from(audioBuffer));
        
    } catch (error) {
        console.error('Test Yandex error:', error);
        res.status(500).json({ error: 'Ошибка' });
    }
}
