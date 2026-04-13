// api/login.js
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
        
        const result = await sql`
            SELECT * FROM users WHERE email = ${email}
        `;
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        const user = result.rows[0];
        const crypto = require('crypto');
        const hashedInput = crypto.createHash('sha256').update(password).digest('hex');
        
        if (hashedInput !== user.password_hash) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
        
        res.status(200).json({ success: true, token, email: user.email });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}
