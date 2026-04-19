export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { text } = req.body;
    
    const API_KEY = process.env.YANDEX_API_KEY;
    const FOLDER_ID = process.env.YANDEX_FOLDER_ID;
    
    // Диагностика: возвращаем информацию о настройках
    return res.status(200).json({
        status: 'diagnostic',
        hasApiKey: !!API_KEY,
        hasFolderId: !!FOLDER_ID,
        apiKeyPrefix: API_KEY ? API_KEY.substring(0, 10) + '...' : null,
        folderId: FOLDER_ID,
        receivedText: text
    });
}
