// api/admin-stats.js — Админ-статистика
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
    
    try {
        const client = await pool.connect();
        try {
            const [
                totalEvents,
                activeUsers,
                dailyStats,
                gameStats,
                fearStats,
                achievementStats,
                eventStats
            ] = await Promise.all([
                client.query('SELECT COUNT(*) FROM analytics'),
                client.query(`
                    SELECT u.id, u.email as user_email, u.child_name,
                           COUNT(a.id) as events_count, MAX(a.created_at) as last_active
                    FROM users u
                    LEFT JOIN analytics a ON u.id = a.user_id
                    WHERE a.created_at > NOW() - INTERVAL '7 days'
                    GROUP BY u.id, u.email, u.child_name
                    ORDER BY last_active DESC LIMIT 20
                `),
                client.query(`
                    SELECT DATE(created_at) as date,
                           COUNT(*) as total_events,
                           COUNT(DISTINCT user_id) as unique_users
                    FROM analytics
                    WHERE created_at > NOW() - INTERVAL '30 days'
                    GROUP BY DATE(created_at) ORDER BY date DESC
                `),
                client.query(`
                    SELECT event_type, COUNT(*) as count,
                           AVG(COALESCE((event_data->>'score')::numeric, 0)) as avg_score
                    FROM analytics WHERE event_type LIKE 'game_%'
                    GROUP BY event_type ORDER BY count DESC
                `),
                client.query(`
                    SELECT event_data->>'fear' as fear, COUNT(*) as count
                    FROM analytics WHERE event_type = 'fear_detected'
                    GROUP BY event_data->>'fear' ORDER BY count DESC LIMIT 10
                `),
                client.query(`
                    SELECT event_data->>'achievement' as achievement, COUNT(*) as count
                    FROM analytics WHERE event_type = 'achievement_earned'
                    GROUP BY event_data->>'achievement' ORDER BY count DESC LIMIT 10
                `),
                client.query(`
                    SELECT event_type, COUNT(*) as count
                    FROM analytics GROUP BY event_type ORDER BY count DESC
                `)
            ]);
            
            res.status(200).json({
                total_events: parseInt(totalEvents.rows[0]?.count || 0),
                active_users: activeUsers.rows.map(r => ({
                    user_id: r.id, user_email: r.user_email,
                    child_name: r.child_name, events_count: parseInt(r.events_count),
                    last_active: r.last_active
                })),
                daily_stats: dailyStats.rows.map(r => ({
                    date: r.date, total_events: parseInt(r.total_events),
                    unique_users: parseInt(r.unique_users)
                })),
                game_stats: gameStats.rows.map(r => ({
                    event_type: r.event_type, count: parseInt(r.count),
                    avg_score: Math.round(parseFloat(r.avg_score))
                })),
                fear_stats: fearStats.rows.map(r => ({
                    fear: r.fear, count: parseInt(r.count)
                })),
                achievement_stats: achievementStats.rows.map(r => ({
                    achievement: r.achievement, count: parseInt(r.count)
                })),
                event_stats: eventStats.rows.map(r => ({
                    event_type: r.event_type, count: parseInt(r.count)
                }))
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
}
