// api/save-stats.js — сохранение статистики в БД
import jwt from 'jsonwebtoken';
import { Pool } from '@neondatabase/serverless';

const JWT_SECRET = process.env.JWT_SECRET || 'hero-skazki-secret-key';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://geroy-skazki.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.split(' ')[1];
    let userEmail = 'guest';

    if (token.startsWith('guest_token_')) {
      userEmail = 'guest';
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.email;
      } catch {
        return res.status(401).json({ error: 'Неверный токен' });
      }
    }

    const { event_type, child_name, event_data } = req.body;

    if (!event_type) {
      return res.status(400).json({ error: 'Нет event_type' });
    }

    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

    await pool.query(
      'INSERT INTO analytics (event_type, user_email, child_name, event_data) VALUES ($1, $2, $3, $4)',
      [event_type, userEmail, child_name || 'неизвестно', JSON.stringify(event_data || {})]
    );

    await pool.end();

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Save stats error:', error);
    res.status(200).json({ success: false, error: 'Статистика сохранена локально' });
  }
}
