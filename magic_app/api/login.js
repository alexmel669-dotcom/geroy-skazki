import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';

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
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (!valid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
        
        res.status(200).json({ success: true, token, email: user.email });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
}
