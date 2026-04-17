export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { name, text, rating } = req.body;
    
    if (!name || !text) {
        return res.status(400).json({ error: 'Имя и отзыв обязательны' });
    }
    
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    let telegramSent = false;
    
    if (BOT_TOKEN && CHAT_ID) {
        const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - (rating || 5));
        
        const message = `📝 **НОВЫЙ ОТЗЫВ!**
        
👤 **От:** ${name}
⭐ **Оценка:** ${stars} (${rating || 5}/5)

💬 **Текст:**
${text}

🕐 ${new Date().toLocaleString()}`;
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: message,
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
        telegram: telegramSent,
        message: telegramSent ? 'Отзыв отправлен в Telegram' : 'Отзыв сохранён'
    });
}
