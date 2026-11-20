import { setCors } from '../_middleware/cors.js';
import { requireParent } from '../_middleware/auth.js';
import { issueParentGrant } from '../_middleware/parent-pin.js';
import { findUser, reservePinAttempt } from '../_lib/users.js';
import { verify } from '../_lib/crypto.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  res.setHeader('Cache-Control', 'no-store');
  const decoded = await requireParent(req, res);
  if (!decoded) return;

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
      return res.status(403).json({ code: 'PARENT_PIN_NOT_CONFIGURED', error: 'Родительский PIN не настроен. Обратитесь в поддержку.' });
    }

    const [attempt, waitSec] = await reservePinAttempt(decoded.email);
    if (attempt === 0) {
      return res.status(429).json({ error: 'Слишком много попыток', waitSec: Math.max(1, waitSec) });
    }
    if (/^\d{4}$/.test(pinStr) && verify(pinStr, user.parentPinHash)) {
      return res.status(200).json({ success: true, ...issueParentGrant(req, { ...user, email: decoded.email }) });
    }
    return res.status(403).json({ error: 'Неверный PIN', attemptsLeft: 3 - attempt });
  } catch (error) {
    console.error('verify-pin error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
