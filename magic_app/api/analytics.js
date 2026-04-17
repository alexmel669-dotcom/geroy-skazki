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
        const { event_type, user_id, user_email, child_name, child_age, event_data } = req.body;
        
        if (!event_type) {
            return res.status(400).json({ error: 'event_type обязателен' });
        }
        
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
            
            await client.query(
                `INSERT INTO analytics (event_type, user_id, user_email, child_name, child_age, event_data) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [event_type, user_id || null, user_email || null, child_name || null, child_age || null, event_data || {}]
            );
            
            res.status(200).json({ success: true });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Ошибка сохранения аналитики: ' + error.message });
    }
}
