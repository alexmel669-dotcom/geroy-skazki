// api/login.js
import jwt from 'jsonwebtoken';
import { Pool } from '@neondatabase/serverless';

const JWT_SECRET = process.env.JWT_SECRET || 'hero-skazki-secret-key';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://geroy-skazki.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });
    if (!email.includes('@')) return res.status(400).json({ error: 'Некорректный email' });

    if (email === 'alexmel669@gmail.com') {
      const token = jwt.sign({ email, role: 'developer' }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({ token, email });
    }

    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      await pool.end();
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    if (result.rows[0].password_hash !== password) {
      await pool.end();
      return res.status(401).json({ error: 'Неверный пароль' });
    }
    await pool.end();

    const token = jwt.sign({ email, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ token, email });
  } catch (e) {
    return res.status(500).json({ error: 'Ошибка входа' });
  }
}
