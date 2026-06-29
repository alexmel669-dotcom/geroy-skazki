import jwt from 'jsonwebtoken';
import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser } from '../_lib/users.js';
import { getJwtSecret } from '../_middleware/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const decoded = verifyAuth(req);
  if (!decoded?.email || decoded.role === 'child' || decoded.mode === 'child') {
    return res.status(403).json({ error: 'Только для родителя' });
  }

  try {
    const user = await findUser(decoded.email);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const childIndex = parseInt(req.query?.child ?? req.body?.childIndex ?? '0', 10);
    const child = user.children?.[childIndex];

    if (!child) {
      return res.status(404).json({ error: 'Ребёнок не найден' });
    }

    const childToken = jwt.sign(
      {
        email: decoded.email,
        parentEmail: decoded.email,
        childName: child.name,
        childAge: child.age,
        childGender: child.gender,
        childAvatar: child.avatar,
        childIndex,
        plan: user.plan || 'free',
        mode: 'child',
        role: 'child'
      },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'geroy-skazki.vercel.app';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${host}`;
    const url = `${base}/app.html?child_token=${encodeURIComponent(childToken)}`;

    return res.status(200).json({
      url,
      childName: child.name,
      childIndex,
      expiresIn: '30d'
    });
  } catch (error) {
    console.error('child-token error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
