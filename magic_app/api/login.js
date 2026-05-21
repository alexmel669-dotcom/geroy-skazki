// api/login.js — с расширенным логированием ошибок
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,  // 10 секунд таймаут
    query_timeout: 5000
});

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    // Проверка JWT_SECRET
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
        console.error('❌ JWT_SECRET не настроен');
        return res.status(500).json({ error: 'Ошибка конфигурации сервера (JWT_SECRET)' });
    }
    
    // Проверка POSTGRES_URL
    if (!process.env.POSTGRES_URL) {
        console.error('❌ POSTGRES_URL не настроен');
        return res.status(500).json({ error: 'Ошибка конфигурации базы данных' });
    }
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }
        
        console.log(`🔐 Попытка входа: ${email}`);
        
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
            const result = await client.query(
                `SELECT id, email, password_hash, parent_name, child_name, child_age, children 
                 FROM users 
                 WHERE email = $1`,
                [email.toLowerCase().trim()]
            );
            
            console.log(`📊 Результат запроса: найдено ${result.rows.length} пользователей`);
            
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }
            
            const user = result.rows[0];
            
            // Проверка пароля
            const valid = await bcrypt.compare(password, user.password_hash);
            
            if (!valid) {
                console.log(`❌ Неверный пароль для: ${email}`);
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }
            
            // Парсим детей
            let children = [];
            if (user.children) {
                try {
                    children = typeof user.children === 'string' 
                        ? JSON.parse(user.children) 
                        : user.children;
                } catch { children = []; }
            }
            
            // Создаём JWT токен
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email,
                    parentName: user.parent_name,
                    childName: user.child_name,
                    childAge: user.child_age
                }, 
                JWT_SECRET, 
                { expiresIn: '30d' }
            );
            
            console.log(`✅ Успешный вход: ${email} (id: ${user.id})`);
            
            res.status(200).json({ 
                success: true, 
                token,
                email: user.email,
                userId: user.id,
                parentName: user.parent_name,
                childName: user.child_name,
                childAge: user.child_age,
                children: children
            });
            
        } catch (queryError) {
            console.error('❌ Ошибка запроса:', queryError);
            return res.status(500).json({ error: 'Ошибка выполнения запроса' });
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера',
            message: error.message 
        });
    }
}
