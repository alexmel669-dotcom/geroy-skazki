// api/login.js — JWT авторизация с возвратом детей (версия от 4 мая 2026)
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
        
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT id, email, password_hash, children FROM users WHERE email = $1',
                [email.toLowerCase().trim()]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }
            
            const user = result.rows[0];
            const valid = await bcrypt.compare(password, user.password_hash);
            
            if (!valid) {
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }
            
            const token = jwt.sign(
                { userId: user.id, email: user.email }, 
                JWT_SECRET, 
                { expiresIn: '7d' }
            );
            
            // Парсим детей
            let children = [];
            if (user.children) {
                try {
                    children = typeof user.children === 'string' 
                        ? JSON.parse(user.children) 
                        : user.children;
                } catch { children = []; }
            }
            
            res.status(200).json({ 
                success: true, 
                token, 
                email: user.email,
                userId: user.id,
                children: children
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}
