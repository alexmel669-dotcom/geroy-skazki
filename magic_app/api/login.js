// api/login.js — JWT авторизация
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') return res.status(500).json({ error: 'Ошибка конфигурации' });

    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

        const client = await pool.connect();
        const result = await client.query(`SELECT id, email, password_hash, parent_name, child_name, child_age, children FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        client.release();

        if (result.rows.length === 0) return res.status(401).json({ error: 'Неверный email или пароль' });
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

        let children = [];
        if (user.children) try { children = typeof user.children === 'string' ? JSON.parse(user.children) : user.children; } catch(e) {}

        const token = jwt.sign({ userId: user.id, email: user.email, parentName: user.parent_name, childName: user.child_name, childAge: user.child_age }, JWT_SECRET, { expiresIn: '30d' });

        res.status(200).json({ success: true, token, email: user.email, userId: user.id, parentName: user.parent_name, childName: user.child_name, childAge: user.child_age, children });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
