import { setCors } from '../_middleware/cors.js';
import { requireParentPin } from '../_middleware/parent-pin.js';
import { deleteUser } from '../_lib/users.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireParentPin(req, res);
  if (!auth) return;

  const email = auth.email.toLowerCase();
  if (!await deleteUser(email, auth.sessionGeneration ?? null)) {
    return res.status(409).json({ error: 'Аккаунт изменился. Повторите запрос.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Аккаунт удалён, сессии завершены.',
  });
}