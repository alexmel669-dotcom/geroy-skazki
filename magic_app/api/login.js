// api/login.js — вход пользователя
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

    // Режим разработчика — упрощённый вход
    if (email === 'alexmel669@gmail.com') {
      const devToken = jwt.sign(
        { email, role: 'developer' },
        JWT_SECRET || 'dev-secret',
        { expiresIn: '30d' }
      );
      return res.status(200).json({ token: devToken, email });
    }

    // Основная логика через БД
    const dbUrl = process.env.POSTGRES_URL;
    if (!dbUrl) {
      // Если БД нет — гостевой вход для всех
      const guestToken = jwt.sign(
        { email, role: 'user' },
        JWT_SECRET || 'fallback-secret',
        { expiresIn: '30d' }
      );
      return res.status(200).json({ token: guestToken, email });
    }

    // Работа с PostgreSQL
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      await pool.end();
      return res.status(401).json({ error: 'Пользователь не найден. Зарегистрируйтесь.' });
    }

    const user = result.rows[0];

    // Простая проверка пароля (в будущем bcrypt)
    if (user.password_hash !== password) {
      await pool.end();
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    await pool.end();

    const token = jwt.sign(
      { email: user.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({ token, email: user.email });

  } catch (error) {
    console.error('Login error:', error);
    
    // Fallback — если БД недоступна, даём войти
    const { email } = req.body;
    if (email) {
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
