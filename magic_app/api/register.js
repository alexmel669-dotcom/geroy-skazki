// api/register.js — регистрация пользователя
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  const allowedOrigins = ['https://geroy-skazki.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Введите email и пароль' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    // Email должен быть похож на email
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Введите корректный email' });
    }

    // Режим разработчика — сразу токен
    if (email === 'alexmel669@gmail.com') {
      const devToken = jwt.sign(
        { email, role: 'developer' },
        JWT_SECRET || 'dev-secret',
        { expiresIn: '30d' }
      );
      return res.status(200).json({ token: devToken, email });
    }

    const dbUrl = process.env.POSTGRES_URL;
    
    // Если БД нет — fallback-режим
    if (!dbUrl) {
      const fallbackToken = jwt.sign(
        { email, role: 'user' },
        JWT_SECRET || 'fallback-secret',
        { expiresIn: '30d' }
      );
      return res.status(200).json({ token: fallbackToken, email });
    }

    // Работа с PostgreSQL
    const { Pool } = await import('pg');
    const pool = new Pool({ 
      connectionString: dbUrl, 
      ssl: { rejectUnauthorized: false } 
    });

    // Проверяем, есть ли уже такой пользователь
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await pool.end();
      return res.status(409).json({ error: 'Этот email уже зарегистрирован. Войдите.' });
    }

    // Создаём пользователя
    await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
      [email, password]
    );

    await pool.end();

    const token = jwt.sign(
      { email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({ token, email });

  } catch (error) {
    console.error('Register error:', error);
    
    // Fallback — если БД недоступна
    const { email } = req.body;
    if (email && email.includes('@')) {
      const fallbackToken = jwt.sign(
        { email, role: 'user' },
        JWT_SECRET || 'fallback-secret',
        { expiresIn: '1d' }
      );
      return res.status(200).json({ token: fallbackToken, email });
    }

    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
