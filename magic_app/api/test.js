// api/test.js — Тестовый эндпоинт (версия от 19 апреля)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.status(200).json({ 
        status: 'ok', 
        message: 'API работает',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
}
