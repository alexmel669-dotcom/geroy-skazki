// api/login.js — JWT авторизация
// Обновлено: 21 мая 2026
// Исправлено: импорт pg, убрана колонка children (хранится в localStorage)

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    // CORS для всех доменов (для разработки и production)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
        console.error('JWT_SECRET не настроен');
        return res.status(500).json({ error: 'Ошибка конфигурации сервера' });
    }
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }
        
        // Проверяем подключение к БД
        let client;
        try {
            client = await pool.connect();
        } catch (dbError) {
            console.error('Ошибка подключения к БД:', dbError);
            return res.status(503).json({ error: 'База данных временно недоступна' });
        }
        
        try {
            const result = await client.query(
                'SELECT id, email, password_hash FROM users WHERE email = $1',
                [email.toLowerCase().trim()]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }
            
            const user = result.rows[0];
            
            // Проверка пароля
            const valid = await bcrypt.compare(password, user.password_hash);
            
            if (!valid) {
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }
            
            // Создаём JWT токен
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email,
                    iat: Math.floor(Date.now() / 1000)
                }, 
                JWT_SECRET, 
                { expiresIn: '30d' }  // 30 дней
            );
            
            // Дети хранятся в localStorage на клиенте, не в БД
            // (согласно техпаспорту)
            
            res.status(200).json({ 
                success: true, 
                token,
                email: user.email,
                userId: user.id
            });
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
