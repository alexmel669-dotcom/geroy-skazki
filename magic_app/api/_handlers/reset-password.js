import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';
import { findUser, saveUser } from '../_lib/users.js';
import { hashPassword, verifyPassword } from '../_lib/crypto.js';
import { normalizeSecretAnswer } from '../_lib/secret-questions.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 5)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const secretAnswer = req.body?.secretAnswer;
    const newPassword = req.body?.newPassword;

    if (!email || !secretAnswer || !newPassword) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const user = await findUser(email);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (!user.secretAnswerHash) {
      return res.status(403).json({ error: 'Восстановление пароля недоступно для этого аккаунта' });
    }

    const normalized = normalizeSecretAnswer(secretAnswer);
    if (!verifyPassword(normalized, user.secretAnswerHash)) {
      return res.status(403).json({ error: 'Неверный ответ на секретный вопрос' });
    }

    user.passwordHash = hashPassword(newPassword);
    await saveUser(email, user);

    return res.status(200).json({ success: true, message: 'Пароль изменён' });
  } catch (error) {
    console.error('reset-password error:', error.message);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
