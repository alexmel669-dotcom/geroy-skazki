// api/register.js — с расширенным логированием
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
        console.error('❌ JWT_SECRET не настроен');
        return res.status(500).json({ error: 'Ошибка конфигурации сервера' });
    }
    
    if (!process.env.POSTGRES_URL) {
        console.error('❌ POSTGRES_URL не настроен');
        return res.status(500).json({ error: 'Ошибка конфигурации базы данных' });
    }
    
    try {
        const { email, password, parentName, childName, childAge, children } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }
        
        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Введите корректный email' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
        }
        
        console.log(`📝 Регистрация: ${email}`);
        
        let client;
        try {
            client = await pool.connect();
            console.log('✅ Подключение к БД установлено');
        } catch (dbError) {
            console.error('❌ Ошибка подключения к БД:', dbError.message);
            return res.status(503).json({ 
                error: 'База данных временно недоступна',
                details: dbError.message
            });
        }
        
        try {
            // Проверка существующего пользователя
            const existing = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase().trim()]
            );
            
            if (existing.rows.length > 0) {
                console.log(`❌ Email уже существует: ${email}`);
                return res.status(409).json({ error: 'Email уже зарегистрирован' });
            }
            
            // Хеширование пароля
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            const childrenData = children && children.length > 0 
                ? JSON.stringify(children) 
                : null;
            
            const result = await client.query(
                `INSERT INTO users (
                    email, 
                    password_hash, 
                    parent_name, 
                    child_name, 
                    child_age, 
                    children,
                    created_at, 
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
                RETURNING id, email`,
                [
                    email.toLowerCase().trim(), 
                    hashedPassword, 
                    parentName || null,
                    childName || null,
                    childAge ? parseInt(childAge) : null,
                    childrenData
                ]
            );
            
            const user = result.rows[0];
            console.log(`✅ Пользователь создан: ${email} (id: ${user.id})`);
            
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email
                }, 
                JWT_SECRET, 
                { expiresIn: '30d' }
            );
            
            res.status(201).json({ 
                success: true, 
                token,
                email: user.email,
                userId: user.id,
                message: 'Регистрация успешна!'
            });
            
        } catch (queryError) {
            console.error('❌ Ошибка запроса:', queryError);
            return res.status(500).json({ error: 'Ошибка при создании пользователя' });
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера',
            message: error.message 
        });
    }
}
