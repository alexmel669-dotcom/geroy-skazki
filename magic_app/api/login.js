import { setCors } from './_cors.js';
import { checkRateLimit, getRateLimitKey } from './_rateLimit.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit('login_' + clientKey, 5, 60000)) {
    return res.status(429).json({ error: 'Слишком много попыток. Подождите минуту.' });
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    if (!email.includes('@') || email.length < 5) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    // В реальном проекте: поиск в БД и проверка bcrypt(password)
    // Сейчас демо-режим: создаем токен для любого email
    const user = { id: 'user_' + Date.now(), email };
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Исправлено: правильная установка кук
    const cookieOptions = 'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800';
    res.setHeader('Set-Cookie', `token=${token}; ${cookieOptions}`);
    res.appendHeader('Set-Cookie', `isAuth=true; Path=/; Max-Age=604800; Secure; SameSite=Strict`);

    return res.status(200).json({ 
      success: true, 
      email: user.email, 
      userId: user.id 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
