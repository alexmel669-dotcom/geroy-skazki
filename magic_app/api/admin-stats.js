// api/admin-stats.js — Админ-статистика
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// Проверка JWT токена
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
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Только GET запросы
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    // Проверяем токен
    try {
        verifyAuth(req);
    } catch (error) {
        return res.status(401).json({ error: error.message });
    }
    
    // Получаем статистику
    try {
        const client = await pool.connect();
        try {
            const stats = await getAdminStats(client);
            res.status(200).json(stats);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
}

async function getAdminStats(client) {
    // Запускаем все запросы параллельно для скорости
    const [
        totalEventsResult,
        activeUsersResult,
        dailyStatsResult,
        gameStatsResult,
        fearStatsResult,
        achievementStatsResult,
        eventStatsResult
    ] = await Promise.all([
        // Всего событий
        client.query('SELECT COUNT(*) FROM analytics'),
        
        // Активные пользователи за 7 дней
        client.query(`
            SELECT 
                u.id,
                u.email as user_email,
                u.child_name,
                COUNT(a.id) as events_count,
                MAX(a.created_at) as last_active
            FROM users u
            LEFT JOIN analytics a ON u.id = a.user_id
            WHERE a.created_at > NOW() - INTERVAL '7 days'
            GROUP BY u.id, u.email, u.child_name
            ORDER BY last_active DESC
            LIMIT 20
        `),
        
        // Динамика за 30 дней
        client.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as total_events,
                COUNT(DISTINCT user_id) as unique_users
            FROM analytics
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `),
        
        // Статистика по играм
        client.query(`
            SELECT 
                event_type,
                COUNT(*) as count,
                AVG(COALESCE((event_data->>'score')::numeric, 0)) as avg_score
            FROM analytics
            WHERE event_type LIKE 'game_%'
            GROUP BY event_type
            ORDER BY count DESC
        `),
        
        // Популярные страхи
        client.query(`
            SELECT 
                event_data->>'fear' as fear,
                COUNT(*) as count
            FROM analytics
            WHERE event_type = 'fear_detected'
            GROUP BY event_data->>'fear'
            ORDER BY count DESC
            LIMIT 10
        `),
        
        // Популярные достижения
        client.query(`
            SELECT 
                event_data->>'achievement' as achievement,
                COUNT(*) as count
            FROM analytics
            WHERE event_type = 'achievement_earned'
            GROUP BY event_data->>'achievement'
            ORDER BY count DESC
            LIMIT 10
        `),
        
        // Статистика по типам событий
        client.query(`
            SELECT 
                event_type,
                COUNT(*) as count
            FROM analytics
            GROUP BY event_type
            ORDER BY count DESC
        `)
    ]);
    
    return {
        total_events: parseInt(totalEventsResult.rows[0]?.count || 0),
        active_users: activeUsersResult.rows.map(row => ({
            user_id: row.id,
            user_email: row.user_email,
            child_name: row.child_name,
            events_count: parseInt(row.events_count),
            last_active: row.last_active
        })),
        daily_stats: dailyStatsResult.rows.map(row => ({
            date: row.date,
            total_events: parseInt(row.total_events),
            unique_users: parseInt(row.unique_users)
        })),
        game_stats: gameStatsResult.rows.map(row => ({
            event_type: row.event_type,
            count: parseInt(row.count),
            avg_score: Math.round(parseFloat(row.avg_score))
        })),
        fear_stats: fearStatsResult.rows.map(row => ({
            fear: row.fear,
            count: parseInt(row.count)
        })),
        achievement_stats: achievementStatsResult.rows.map(row => ({
            achievement: row.achievement,
            count: parseInt(row.count)
        })),
        event_stats: eventStatsResult.rows.map(row => ({
            event_type: row.event_type,
            count: parseInt(row.count)
        }))
    };
}
