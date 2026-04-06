// api/send-feedback.js — отправка отзывов в Telegram
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { rating, comment, childAge, childName, totalHours, fear } = req.body;

        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({ error: 'Telegram не настроен' });
        }

        const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        const message = `🦁 <b>Новый отзыв о Герое Сказок!</b>\n\n⭐ Оценка: ${stars} (${rating}/5)\n👶 Ребёнок: ${childName || 'не указан'} (${childAge || '?'} лет)\n😨 Страх: ${fear || 'не указан'}\n⏱️ Часов в приложении: ${totalHours || 0}\n\n💬 <b>Комментарий:</b>\n${comment || '—'}\n\n📅 ${new Date().toLocaleString()}`;

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });

        const result = await response.json();
        
        if (!response.ok) {
            console.error('Telegram error:', result);
            return res.status(500).json({ error: 'Ошибка отправки в Telegram: ' + result.description });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: error.message });
    }
}
