import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser, saveUser } from '../_lib/users.js';
import { verify } from '../_lib/crypto.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const decoded = verifyAuth(req);
  if (!decoded?.email) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  if (decoded.role === 'child' || decoded.mode === 'child') {
    return res.status(403).json({ error: 'Только для родителя' });
  }

  try {
    const user = await findUser(decoded.email);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.lockedUntil && Date.now() < user.lockedUntil) {
      const waitSec = Math.ceil((user.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: 'Слишком много попыток', waitSec });
    }

    const { pin, checkOnly } = req.body || {};

    if (checkOnly) {
      return res.status(200).json({
        success: true,
        noPin: !user.parentPinHash,
        pinRequired: Boolean(user.parentPinHash)
      });
    }

    const pinStr = String(pin || '').trim();

    if (!user.parentPinHash) {
      return res.status(200).json({ success: true, noPin: true });
    }

    const valid = verify(pinStr, user.parentPinHash);
    if (valid) {
      user.pinAttempts = 0;
      user.lockedUntil = null;
      await saveUser(decoded.email, user);
      return res.status(200).json({ success: true });
    }

    user.pinAttempts = (user.pinAttempts || 0) + 1;
    if (user.pinAttempts >= 3) {
      user.lockedUntil = Date.now() + 300000;
      user.pinAttempts = 0;
    }
    await saveUser(decoded.email, user);

    return res.status(403).json({
      error: 'Неверный PIN',
      attemptsLeft: Math.max(0, 3 - (user.pinAttempts || 0))
    });
  } catch (error) {
    console.error('verify-pin error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
