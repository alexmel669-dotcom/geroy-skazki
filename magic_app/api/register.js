// api/register.js — регистрация с сохранением в БД
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Введите email и пароль' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Введите корректный email' });
    }

    // Dev-режим
    if (email === 'alexmel669@gmail.com') {
      const token = jwt.sign({ email, role: 'developer' }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({ token, email });
    }

    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

    // Проверка на существование
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

    const token = jwt.sign({ email, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });

    res.status(200).json({ token, email });

  } catch (error) {
    console.error('Register error:', error);
    // Fallback
    const { email } = req.body;
    if (email && email.includes('@')) {
      const token = jwt.sign({ email, role: 'user' }, JWT_SECRET, { expiresIn: '1d' });
      return res.status(200).json({ token, email });
    }
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
}
