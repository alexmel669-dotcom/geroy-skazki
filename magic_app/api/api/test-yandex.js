export default async function handler(req, res) {
    const API_KEY = process.env.YANDEX_API_KEY;
    const FOLDER_ID = process.env.YANDEX_FOLDER_ID;
    
    // Проверяем переменные
    if (!API_KEY || !FOLDER_ID) {
        return res.status(500).json({
            error: 'Переменные не найдены',
            hasApiKey: !!API_KEY,
            hasFolderId: !!FOLDER_ID
        });
    }
    
    // Пробуем сделать прямой запрос к Yandex API
    try {
        const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                text: 'Привет',
                voice: 'alexander',
                format: 'mp3',
                folderId: FOLDER_ID
            })
        });
        
        const status = response.status;
        let details = '';
        
        if (!response.ok) {
            details = await response.text();
        }
        
        res.status(200).json({
            yandexStatus: status,
            yandexResponse: details || 'OK (audio received)',
            apiKeyPrefix: API_KEY.substring(0, 10) + '...',
            folderId: FOLDER_ID
        });
        
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}
