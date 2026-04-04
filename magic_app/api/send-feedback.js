// api/send-feedback.js — только PostgreSQL, без Telegram
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { rating, comment, childAge, childName, totalHours, fear } = req.body;

        await sql`
            INSERT INTO feedback (rating, comment, child_name, child_age, fear, total_hours)
            VALUES (${rating}, ${comment}, ${childName}, ${childAge}, ${fear}, ${totalHours})
        `;

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: error.message });
    }
}
