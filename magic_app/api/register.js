import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }
        
        // Проверка, существует ли пользователь
        const existing = await sql`
            SELECT * FROM users WHERE email = ${email}
        `;
        
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        
        // Простое хеширование (без дополнительных пакетов)
        const crypto = require('crypto');
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        
        await sql`
            INSERT INTO users (email, password_hash, created_at)
            VALUES (${email}, ${hashedPassword}, NOW())
        `;
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
}
