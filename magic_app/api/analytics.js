// api/analytics.js — Сбор аналитики (версия от 19 апреля)
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
    
    try {
        const { event_type, user_id, user_email, child_name, event_data } = req.body;
        
        if (!event_type) {
            return res.status(400).json({ error: 'event_type обязателен' });
        }
        
        const client = await pool.connect();
        try {
            await client.query(
                `INSERT INTO analytics (event_type, user_id, user_email, child_name, event_data, created_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [event_type, user_id || null, user_email || null, child_name || null, event_data || {}]
            );
            res.status(200).json({ success: true });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Ошибка сохранения аналитики' });
    }
}
