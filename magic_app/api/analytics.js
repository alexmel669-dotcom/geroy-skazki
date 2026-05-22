// api/analytics.js — сбор аналитики с защитой от спама
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const ALLOWED_EVENTS = ['app_open','session_end','talk_start','fear_detected','story_generated','story_night','game_fish','game_memory','game_puzzle','game_color','game_emotion','feed','room_clean','parent_page_view','parent_advice_request','share','data_export','dialogue_scored'];
const rateLimit = new Map();

function isRateLimited(userId, eventType) {
    const key = `${userId}_${eventType}`;
    const now = Date.now();
    const last = rateLimit.get(key);
    if (last && (now - last) < 1000) return true;
    rateLimit.set(key, now);
    setTimeout(() => rateLimit.delete(key), 5000);
    return false;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        const { event_type, user_id, user_email, child_name, child_age, event_data = {} } = req.body;
        if (!event_type) return res.status(400).json({ error: 'event_type обязателен' });
        if (!ALLOWED_EVENTS.includes(event_type)) return res.status(400).json({ error: 'Недопустимый тип события' });
        const rateId = user_id || 'anonymous';
        if (isRateLimited(rateId, event_type)) return res.status(429).json({ error: 'Слишком много запросов' });

        const client = await pool.connect();
        await client.query(
            `INSERT INTO analytics (event_type, user_id, user_email, child_name, child_age, event_data, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
            [event_type, user_id?.substring(0,255) || null, user_email?.substring(0,255) || null, child_name?.substring(0,100) || null, child_age ? parseInt(child_age) : null, JSON.stringify(event_data)]
        );
        client.release();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Analytics error', error);
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
}
