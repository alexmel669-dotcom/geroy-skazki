export default async function handler(req, res) {
    // Разрешаем CORS для тестов
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    const { text, voice = 'alexander' } = req.body;
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Текст обязателен' });
    }

    // Получаем переменные окружения
    const API_KEY = process.env.YANDEX_API_KEY;
    const FOLDER_ID = process.env.YANDEX_FOLDER_ID;

    // Логируем наличие переменных (важно для отладки!)
    console.log('YANDEX_API_KEY exists:', !!API_KEY);
    console.log('YANDEX_FOLDER_ID exists:', !!FOLDER_ID);
    console.log('FOLDER_ID value:', FOLDER_ID);

    if (!API_KEY || !FOLDER_ID) {
        console.error('Ошибка: переменные окружения не найдены');
        return res.status(500).json({ error: 'Сервер не настроен. Обратитесь к администратору.' });
    }

    try {
        // Используем правильный API v1 формат
        const requestBody = new URLSearchParams();
        requestBody.append('text', text.slice(0, 500));
        requestBody.append('voice', voice);
        requestBody.append('emotion', 'good');
        requestBody.append('speed', '1.0');
        requestBody.append('format', 'mp3');
        requestBody.append('sampleRateHertz', '48000');
        // Критически важно: folderId для v1 API передается в заголовке
        const url = `https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize?folderId=${FOLDER_ID}`;

        console.log('Sending request to Yandex...');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: requestBody.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Yandex API error:', response.status, errorText);
            // Возвращаем статус и текст ошибки Яндекса для отладки
            return res.status(response.status).json({ 
                error: 'Ошибка от Yandex Cloud', 
                status: response.status,
                details: errorText 
            });
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('Audio received, size:', audioBuffer.byteLength);
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.status(200).send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
