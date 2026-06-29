import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';
import { findUser } from '../_lib/users.js';
import { DEFAULT_SECRET_QUESTION, getSecretQuestionText } from '../_lib/secret-questions.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    const user = await findUser(email);
    const question = user?.secretQuestion
      ? getSecretQuestionText(user.secretQuestion)
      : DEFAULT_SECRET_QUESTION;

    return res.status(200).json({ question });
  } catch (error) {
    console.error('get-secret-question error:', error.message);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
