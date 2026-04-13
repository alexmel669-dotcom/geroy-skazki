import { sql } from '@vercel/postgres';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
        const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Email уже используется' });
        const hashed = crypto.createHash('sha256').update(password).digest('hex');
        await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${hashed})`;
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}
