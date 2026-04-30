// api/send-review.js — Отправка отзывов в Telegram (версия от 19 апреля)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    const { name, text, rating } = req.body;
    
    if (!name || !text) {
        return res.status(400).json({ error: 'Имя и отзыв обязательны' });
    }
    
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    if (!BOT_TOKEN || !CHAT_ID) {
        return res.status(200).json({ success: true, telegram: false });
    }
    
    const stars = '⭐'.repeat(rating || 5);
    const message = `📝 Новый отзыв!\n\n👤 ${name}\n⭐ ${stars}\n\n💬 ${text}`;
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: message.slice(0, 4096) })
        });
        
        const data = await response.json();
        res.status(200).json({ success: true, telegram: data.ok });
    } catch (error) {
        console.error('Telegram error:', error);
        res.status(200).json({ success: true, telegram: false });
    }
}
