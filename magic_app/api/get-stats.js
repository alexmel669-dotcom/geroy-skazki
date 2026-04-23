// api/get-stats.js — получение статистики для админки
import jwt from 'jsonwebtoken';
import { Pool } from '@neondatabase/serverless';

const JWT_SECRET = process.env.JWT_SECRET || 'hero-skazki-secret-key';
const ADMIN_EMAIL = 'alexmel669@gmail.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://geroy-skazki.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

    // Общая статистика
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    const totalStories = await pool.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'story'");
    const totalFears = await pool.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'fear_detected'");
    const todayStories = await pool.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'story' AND created_at::date = CURRENT_DATE");
    
    // Топ страхов
    const topFears = await pool.query(`
      SELECT event_data->>'fear' as fear, COUNT(*) as count 
      FROM analytics 
      WHERE event_type = 'fear_detected' 
      GROUP BY fear 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // Последние регистрации
    const recentUsers = await pool.query('SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 10');

    await pool.end();

    res.status(200).json({
      totalUsers: totalUsers.rows[0].count,
      totalStories: totalStories.rows[0].count,
      totalFears: totalFears.rows[0].count,
      todayStories: todayStories.rows[0].count,
      topFears: topFears.rows,
      recentUsers: recentUsers.rows
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
}
