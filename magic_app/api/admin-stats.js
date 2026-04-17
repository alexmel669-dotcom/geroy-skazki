import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: true
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    try {
        const client = await pool.connect();
        try {
            // Создаём таблицу если нет
            await client.query(`
                CREATE TABLE IF NOT EXISTS analytics (
                    id SERIAL PRIMARY KEY,
                    event_type VARCHAR(100) NOT NULL,
                    user_id VARCHAR(255),
                    user_email VARCHAR(255),
                    child_name VARCHAR(100),
                    child_age INTEGER,
                    event_data JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            
            // Общая статистика
            const totalEvents = await client.query('SELECT COUNT(*) FROM analytics');
            
            // Статистика по дням
            const dailyStats = await client.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_events,
                    COUNT(DISTINCT user_id) as unique_users
                FROM analytics 
                WHERE created_at > NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 14
            `);
            
            // Статистика по типам событий
            const eventStats = await client.query(`
                SELECT 
                    event_type,
                    COUNT(*) as count
                FROM analytics 
                GROUP BY event_type
                ORDER BY count DESC
            `);
            
            // Статистика по страхам
            const fearStats = await client.query(`
                SELECT 
                    event_data->>'fear' as fear,
                    COUNT(*) as count
                FROM analytics 
                WHERE event_type = 'fear_detected'
                GROUP BY event_data->>'fear'
                ORDER BY count DESC
            `);
            
            // Активные пользователи
            const activeUsers = await client.query(`
                SELECT 
                    user_id,
                    user_email,
                    child_name,
                    COUNT(*) as events_count,
                    MAX(created_at) as last_active
                FROM analytics 
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY user_id, user_email, child_name
                ORDER BY events_count DESC
                LIMIT 20
            `);
            
            // Достижения
            const achievementStats = await client.query(`
                SELECT 
                    event_data->>'achievement' as achievement,
                    COUNT(*) as count
                FROM analytics 
                WHERE event_type = 'achievement_earned'
                GROUP BY event_data->>'achievement'
                ORDER BY count DESC
            `);
            
            // Игры
            const gameStats = await client.query(`
                SELECT 
                    event_type,
                    COUNT(*) as count,
                    AVG((event_data->>'score')::int) as avg_score
                FROM analytics 
                WHERE event_type IN ('game_fish', 'game_memory', 'game_puzzle', 'game_color', 'game_emotion')
                GROUP BY event_type
            `);
            
            res.status(200).json({
                total_events: parseInt(totalEvents.rows[0]?.count || 0),
                daily_stats: dailyStats.rows || [],
                event_stats: eventStats.rows || [],
                fear_stats: fearStats.rows || [],
                active_users: activeUsers.rows || [],
                achievement_stats: achievementStats.rows || [],
                game_stats: gameStats.rows || []
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики: ' + error.message });
    }
}
