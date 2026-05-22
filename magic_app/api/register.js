// api/register.js — регистрация
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

    try {
        const { email, password, parentName, childName, childAge, children } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Некорректный email' });
        if (password.length < 6) return res.status(400).json({ error: 'Пароль не менее 6 символов' });

        const client = await pool.connect();
        const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (existing.rows.length > 0) { client.release(); return res.status(409).json({ error: 'Email уже зарегистрирован' }); }

        const hashedPassword = await bcrypt.hash(password, 10);
        const childrenData = children && children.length ? JSON.stringify(children) : null;
        const result = await client.query(
            `INSERT INTO users (email, password_hash, parent_name, child_name, child_age, children, created_at, updated_at) 
             VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW()) RETURNING id, email`,
            [email.toLowerCase().trim(), hashedPassword, parentName || null, childName || null, childAge ? parseInt(childAge) : null, childrenData]
        );
        client.release();

        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ success: true, token, email: user.email, userId: user.id, message: 'Регистрация успешна!' });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
