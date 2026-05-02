// api/admin-stats.js — Админ-статистика (версия от 3 мая 2026)
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

function verifyAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Требуется авторизация');
    }
    
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            throw new Error('Недостаточно прав');
        }
        return decoded;
    } catch (error) {
        throw new Error('Недействительный токен');
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    try {
        verifyAuth(req);
    } catch (error) {
        return res.status(401).json({ error: error.message });
    }
    
    const client = await pool.connect();
    
    try {
        // Всего событий
        let totalEvents = 0;
        try {
            const r = await client.query('SELECT COUNT(*) FROM analytics');
            totalEvents = parseInt(r.rows[0]?.count || 0);
        } catch { totalEvents = 0; }
        
        // Активные пользователи (из analytics, без JOIN на users)
        let activeUsers = [];
        try {
            const r = await client.query(`
                SELECT user_id, user_email, child_name,
                       COUNT(*) as events_count, MAX(created_at) as last_active
                FROM analytics
                WHERE created_at > NOW() - INTERVAL '7 days' AND user_id IS NOT NULL
                GROUP BY user_id, user_email, child_name
                ORDER BY last_active DESC LIMIT 20
            `);
            activeUsers = r.rows.map(row => ({
                user_id: row.user_id,
                user_email: row.user_email,
                child_name: row.child_name,
                events_count: parseInt(row.events_count),
                last_active: row.last_active
            }));
        } catch { activeUsers = []; }
        
        // Дневная статистика
        let dailyStats = [];
        try {
            const r = await client.query(`
                SELECT DATE(created_at) as date,
                       COUNT(*) as total_events,
                       COUNT(DISTINCT user_id) as unique_users
                FROM analytics
                WHERE created_at > NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at) ORDER BY date DESC
            `);
            dailyStats = r.rows.map(row => ({
                date: row.date,
                total_events: parseInt(row.total_events),
                unique_users: parseInt(row.unique_users)
            }));
        } catch { dailyStats = []; }
        
        // Статистика игр
        let gameStats = [];
        try {
            const r = await client.query(`
                SELECT event_type, COUNT(*) as count,
                       AVG(COALESCE((event_data->>'score')::numeric, 0)) as avg_score
                FROM analytics WHERE event_type LIKE 'game_%'
                GROUP BY event_type ORDER BY count DESC
            `);
            gameStats = r.rows.map(row => ({
                event_type: row.event_type,
                count: parseInt(row.count),
                avg_score: Math.round(parseFloat(row.avg_score))
            }));
        } catch { gameStats = []; }
        
        // Статистика страхов
        let fearStats = [];
        try {
            const r = await client.query(`
                SELECT event_data->>'fear' as fear, COUNT(*) as count
                FROM analytics WHERE event_type = 'fear_detected'
                GROUP BY event_data->>'fear' ORDER BY count DESC LIMIT 10
            `);
            fearStats = r.rows.map(row => ({
                fear: row.fear,
                count: parseInt(row.count)
            }));
        } catch { fearStats = []; }
        
        // Статистика достижений
        let achievementStats = [];
        try {
            const r = await client.query(`
                SELECT event_data->>'achievement' as achievement, COUNT(*) as count
                FROM analytics WHERE event_type = 'achievement_earned'
                GROUP BY event_data->>'achievement' ORDER BY count DESC LIMIT 10
            `);
            achievementStats = r.rows.map(row => ({
                achievement: row.achievement,
                count: parseInt(row.count)
            }));
        } catch { achievementStats = []; }
        
        // Все типы событий
        let eventStats = [];
        try {
            const r = await client.query(`
                SELECT event_type, COUNT(*) as count
                FROM analytics GROUP BY event_type ORDER BY count DESC
            `);
            eventStats = r.rows.map(row => ({
                event_type: row.event_type,
                count: parseInt(row.count)
            }));
        } catch { eventStats = []; }
        
        client.release();
        
        res.status(200).json({
            total_events: totalEvents,
            active_users: activeUsers,
            daily_stats: dailyStats,
            game_stats: gameStats,
            fear_stats: fearStats,
            achievement_stats: achievementStats,
            event_stats: eventStats
        });
        
    } catch (error) {
        client.release();
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
}
