// api/admin-stats.js — Статистика для админ-панели
// Обновлено: 22 мая 2026

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// Простой пароль для админ-панели (в реальном проекте используйте нормальную авторизацию)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Проверка пароля (передаётся в заголовке или query)
    const authHeader = req.headers.authorization;
    let isAuthorized = false;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token === ADMIN_PASSWORD) isAuthorized = true;
    }
    if (req.query.password === ADMIN_PASSWORD) isAuthorized = true;
    
    if (!isAuthorized) {
        return res.status(401).json({ error: 'Неавторизованный доступ' });
    }

    try {
        const client = await pool.connect();
        
        // Общая статистика
        const stats = {};
        
        // Количество пользователей
        const usersRes = await client.query('SELECT COUNT(*) as count FROM users');
        stats.totalUsers = parseInt(usersRes.rows[0].count);
        
        // Количество событий аналитики
        const eventsRes = await client.query('SELECT COUNT(*) as count FROM analytics');
        stats.totalEvents = parseInt(eventsRes.rows[0].count);
        
        // Страхи по типам
        const fearsRes = await client.query(`
            SELECT event_data->>'fear' as fear, COUNT(*) as count
            FROM analytics
            WHERE event_type = 'fear_detected' AND event_data IS NOT NULL
            GROUP BY event_data->>'fear'
            ORDER BY count DESC
        `);
        stats.fears = fearsRes.rows;
        
        // Популярные игры
        const gamesRes = await client.query(`
            SELECT event_type, COUNT(*) as count
            FROM analytics
            WHERE event_type LIKE 'game_%'
            GROUP BY event_type
            ORDER BY count DESC
        `);
        stats.games = gamesRes.rows;
        
        // Активность по дням (последние 7 дней)
        const activityRes = await client.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM analytics
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
        stats.dailyActivity = activityRes.rows;
        
        // Количество сказок
        const storiesRes = await client.query(`
            SELECT COUNT(*) as count FROM analytics WHERE event_type = 'story_generated'
        `);
        stats.totalStories = parseInt(storiesRes.rows[0].count);
        
        client.release();
        
        res.status(200).json({ success: true, stats, timestamp: new Date().toISOString() });
        
    } catch (error) {
        console.error('Ошибка admin-stats:', error);
        res.status(500).json({ error: 'Ошибка получения статистики', details: error.message });
    }
}
