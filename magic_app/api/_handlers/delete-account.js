import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { deleteUser, findUser } from '../_lib/users.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = verifyAuth(req);
  if (!auth || !auth.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const email = auth.email.toLowerCase();
  const user = await findUser(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await deleteUser(email);

  return res.status(200).json({
    success: true,
    message: 'Аккаунт удалён. Все персональные данные стёрты.',
  });
}