// api/admin-stats.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-2026';

export default async function handler(req, res) {
    // CORS
    const allowedOrigins = ['https://geroy-skazki.vercel.app', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Проверка авторизации
    const authHeader = req.headers.authorization;
    let isAuthorized = false;

    if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            // Проверка JWT (для админов)
            if (JWT_SECRET) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    if (decoded.email === 'alexmel669@gmail.com') {
                        isAuthorized = true;
                    }
                } catch (e) {
                    // Невалидный токен
                }
            }
            // Проверка ADMIN_SECRET
            if (!isAuthorized && token === ADMIN_SECRET) {
                isAuthorized = true;
            }
        }
    }

    // Проверка query параметра (для простого доступа)
    if (!isAuthorized && req.query.key === ADMIN_SECRET) {
        isAuthorized = true;
    }

    if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized. Use ?key=ADMIN_SECRET or Bearer token' });
    }

    try {
        const stats = {
            timestamp: new Date().toISOString(),
            environment: process.env.VERCEL_ENV || 'development',
            online: {
                active_sessions_24h: 0,
                unique_users_24h: 0
            },
            totals: {
                users: 0,
                stories: 0,
                fears_detected: 0
            },
            by_date: [],
            top_fears: [],
            system: {
                deepseek_api: process.env.DEEPSEEK_API_KEY ? '✅ Configured' : '❌ Missing',
                yandex_api: process.env.YANDEX_API_KEY ? '✅ Configured' : '❌ Missing',
                postgres_url: process.env.POSTGRES_URL ? '✅ Configured' : '❌ Missing',
                jwt_secret: process.env.JWT_SECRET ? '✅ Configured' : '❌ Missing',
                resend_api: process.env.RESEND_API_KEY ? '✅ Configured' : '❌ Missing'
            }
        };

        // Подключаемся к БД если есть
        if (process.env.POSTGRES_URL) {
            try {
                const { sql } = await import('@vercel/postgres');
                
                // Общее количество пользователей
                const usersResult = await sql`SELECT COUNT(*) as count FROM users`;
                stats.totals.users = parseInt(usersResult.rows[0].count) || 0;
                
                // Общее количество сказок
                const storiesResult = await sql`SELECT COUNT(*) as count FROM analytics WHERE event_type = 'story_generated'`;
                stats.totals.stories = parseInt(storiesResult.rows[0].count) || 0;
                
                // Активные сессии за 24 часа
                const activeResult = await sql`
                    SELECT COUNT(DISTINCT user_email) as unique_users,
                           COUNT(*) as sessions
                    FROM analytics 
                    WHERE created_at > NOW() - INTERVAL '24 hours'
                `;
                stats.online.unique_users_24h = parseInt(activeResult.rows[0].unique_users) || 0;
                stats.online.active_sessions_24h = parseInt(activeResult.rows[0].sessions) || 0;
                
                // Статистика по дням (последние 7 дней)
                const byDateResult = await sql`
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as stories,
                        COUNT(DISTINCT user_email) as users
                    FROM analytics 
                    WHERE event_type = 'story_generated'
                      AND created_at > NOW() - INTERVAL '7 days'
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                `;
                stats.by_date = byDateResult.rows;
                
                // Топ страхов
                const fearsResult = await sql`
                    SELECT 
                        event_data->>'fear' as fear,
                        COUNT(*) as count
                    FROM analytics 
                    WHERE event_type = 'story_generated'
                      AND event_data->>'fear' IS NOT NULL
                    GROUP BY event_data->>'fear'
                    ORDER BY count DESC
                    LIMIT 10
                `;
                stats.top_fears = fearsResult.rows;
                
                // Последние 10 действий
                const recentResult = await sql`
                    SELECT 
                        event_type,
                        user_email,
                        child_name,
                        created_at,
                        event_data
                    FROM analytics 
                    ORDER BY created_at DESC
                    LIMIT 10
                `;
                stats.recent_activity = recentResult.rows;
                
            } catch (dbError) {
                console.error('DB error:', dbError);
                stats.database_error = dbError.message;
            }
        } else {
            stats.database_status = 'Not configured';
        }

        // Для метода POST — можно выполнять действия
        if (req.method === 'POST') {
            const { action } = req.body;
            
            if (action === 'clear_cache') {
                // Очистка кеша (заглушка)
                stats.action_result = 'Cache cleared (simulated)';
            } else if (action === 'get_detailed_stats') {
                // Детальная статистика
                stats.detailed = true;
            }
        }

        return res.status(200).json(stats);
        
    } catch (error) {
        console.error('Admin stats error:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message 
        });
    }
}
