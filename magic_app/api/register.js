// api/register.js — JWT регистрация (версия от 19 апреля)
import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    const allowedOrigins = ['https://geroy-skazki.vercel.app'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
        return res.status(500).json({ error: 'Ошибка конфигурации' });
    }
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
        }
        
        const client = await pool.connect();
        try {
            const existing = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase().trim()]
            );
            
            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Email уже зарегистрирован' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const result = await client.query(
                'INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, NOW()) RETURNING id, email',
                [email.toLowerCase().trim(), hashedPassword]
            );
            
            const user = result.rows[0];
            
            const token = jwt.sign(
                { userId: user.id, email: user.email }, 
                JWT_SECRET, 
                { expiresIn: '7d' }
            );
            
            res.status(201).json({ 
                success: true, 
                token, 
                email: user.email,
                userId: user.id
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}
