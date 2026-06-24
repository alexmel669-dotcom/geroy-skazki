import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';
import { verifyPassword } from '../_lib/crypto.js';
import { findUser, saveUser } from '../_lib/users.js';
import { setAuthCookie } from '../_lib/cookies.js';
import { logError } from '../_lib/auth-log.js';
import jwt from 'jsonwebtoken';
import { getEffectivePlan } from '../_lib/promocodes.js';
import { getJwtSecret } from '../_middleware/auth.js';

function signToken(user) {
  return jwt.sign(
    {
      email: user.email,
      username: user.username,
      userId: user.email,
      plan: user.plan || 'free',
      role: user.role || 'user'
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const normalizedEmail = (req.body?.email || req.body?.username || '').trim().toLowerCase();

  try {
    const { password } = req.body;

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const user = await findUser(normalizedEmail);

    if (!user) {
      await logError('login', `Пользователь не найден: ${normalizedEmail}`);
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logError('login', `Неверный пароль для: ${normalizedEmail}`);
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    user.lastLoginAt = new Date().toISOString();
    const saved = await saveUser(normalizedEmail, user);

    const effectivePlan = getEffectivePlan(saved);
    const token = signToken({ ...saved, plan: effectivePlan });
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      token,
      user: {
        username: saved.username,
        email: normalizedEmail,
        plan: effectivePlan,
        planExpiry: saved.planExpiry || null,
        promocodeUsed: saved.promocodeUsed || null,
        role: saved.role || 'user',
        gender: saved.gender,
        age: saved.age,
        children: saved.children || []
      }
    });
  } catch (error) {
    await logError('login', error.message);
    return res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
}
