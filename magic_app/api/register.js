// api/register.js — JWT регистрация
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
    // CORS для всех доменов
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
        
        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Введите корректный email' });
        }
        
        // Валидация пароля
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
        }
        
        // Проверка подключения к БД
        let client;
        try {
            client = await pool.connect();
        } catch (dbError) {
            console.error('Ошибка подключения к БД:', dbError);
            return res.status(503).json({ error: 'База данных временно недоступна' });
        }
        
        try {
            // Проверка существующего пользователя
            const existing = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase().trim()]
            );
            
            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Email уже зарегистрирован' });
            }
            
            // Хеширование пароля
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            // Создание пользователя (без колонки children, согласно техпаспорту)
            const result = await client.query(
                `INSERT INTO users (email, password_hash, created_at) 
                 VALUES ($1, $2, NOW()) 
                 RETURNING id, email, created_at`,
                [email.toLowerCase().trim(), hashedPassword]
            );
            
            const user = result.rows[0];
            
            // Создание JWT токена
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email,
                    iat: Math.floor(Date.now() / 1000)
                }, 
                JWT_SECRET, 
                { expiresIn: '30d' }
            );
            
            // Дети будут созданы на клиенте и сохранены в localStorage
            // (это позволяет иметь разных детей для одного аккаунта)
            
            res.status(201).json({ 
                success: true, 
                token,
                email: user.email,
                userId: user.id,
                message: 'Регистрация успешна!'
            });
            
        } catch (queryError) {
            console.error('Ошибка запроса к БД:', queryError);
            return res.status(500).json({ error: 'Ошибка при создании пользователя' });
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
