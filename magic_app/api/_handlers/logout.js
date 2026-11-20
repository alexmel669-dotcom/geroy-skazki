import { setCors } from '../_middleware/cors.js';
import { getTokenFromRequest, verifySessionSignature } from '../_middleware/auth.js';
import { revokeSession } from '../_lib/users.js';
import { clearAuthCookie } from '../_lib/cookies.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  const tokens = new Set([getTokenFromRequest(req), bearer]);
  try {
    await Promise.all([...tokens].map(async (token) => {
      const claims = verifySessionSignature(token);
      if (claims) await revokeSession(token, claims.exp);
    }));
  } catch {
    return res.status(503).json({ error: 'Не удалось завершить сессию. Повторите выход.' });
  }
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: 'Вы вышли' });
}
