// api/admin-stats.js — Админ-статистика (версия от 19 апреля)
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    const adminPassword = req.body.password;
    if (adminPassword !== 'admin123') {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    try {
        const client = await pool.connect();
        try {
            const totalUsers = await client.query('SELECT COUNT(*) FROM users');
            const totalStories = await client.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'story_generated'");
            const totalFears = await client.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'fear_detected'");
            const todayStories = await client.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'story_generated' AND created_at > NOW() - INTERVAL '1 day'");
            
            const topFears = await client.query(`
                SELECT event_data->>'fear' as fear, COUNT(*) as count 
                FROM analytics 
                WHERE event_type = 'fear_detected' 
                GROUP BY event_data->>'fear' 
                ORDER BY count DESC 
                LIMIT 5
            `);
            
            const recentUsers = await client.query(`
                SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 10
            `);
            
            res.status(200).json({
                totalUsers: parseInt(totalUsers.rows[0]?.count || 0),
                totalStories: parseInt(totalStories.rows[0]?.count || 0),
                totalFears: parseInt(totalFears.rows[0]?.count || 0),
                todayStories: parseInt(todayStories.rows[0]?.count || 0),
                topFears: topFears.rows,
                recentUsers: recentUsers.rows
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
}
