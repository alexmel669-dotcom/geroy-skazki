import { setCors } from './_cors.js';
import { checkRateLimit, getRateLimitKey } from './_rateLimit.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit('register_' + clientKey, 3, 60000)) {
    return res.status(429).json({ error: 'Слишком много попыток. Подождите минуту.' });
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }
    
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    // В реальном проекте: хеширование bcrypt и сохранение в БД
    const user = { id: 'user_' + Date.now(), email };
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const cookieOptions = 'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800';
    res.setHeader('Set-Cookie', `token=${token}; ${cookieOptions}`);
    res.appendHeader('Set-Cookie', `isAuth=true; Path=/; Max-Age=604800; Secure; SameSite=Strict`);

    return res.status(201).json({ 
      success: true, 
      email: user.email, 
      userId: user.id 
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
