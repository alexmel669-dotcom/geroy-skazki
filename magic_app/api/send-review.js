export default async function handler(req, res) {
    const allowedOrigins = ['https://geroy-skazki.vercel.app'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { name, text, rating } = req.body;
    
    if (!name || typeof name !== 'string' || name.length > 50) {
        return res.status(400).json({ error: 'Некорректное имя' });
    }
    
    if (!text || typeof text !== 'string' || text.length > 1000) {
        return res.status(400).json({ error: 'Некорректный отзыв' });
    }
    
    const validRating = Math.min(5, Math.max(1, parseInt(rating) || 5));
    
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    let telegramSent = false;
    
    if (BOT_TOKEN && CHAT_ID) {
        const stars = '⭐'.repeat(validRating) + '☆'.repeat(5 - validRating);
        
        const safeName = name.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
        const safeText = text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
        
        const message = `📝 **НОВЫЙ ОТЗЫВ!**
        
👤 **От:** ${safeName}
⭐ **Оценка:** ${stars}

💬 **Текст:**
${safeText}

🕐 ${new Date().toLocaleString()}`;
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: message.slice(0, 4096),
                    parse_mode: 'Markdown'
                })
            });
            
            const data = await response.json();
            telegramSent = data.ok;
        } catch (error) {
            console.error('Telegram error:', error);
        }
    }
    
    res.status(200).json({ 
        success: true, 
        telegram: telegramSent
    });
}
