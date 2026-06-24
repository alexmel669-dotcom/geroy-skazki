import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';
import { hashPassword } from '../_lib/crypto.js';
import { saveUser, userExists } from '../_lib/users.js';
import { setAuthCookie } from '../_lib/cookies.js';
import { logError } from '../_lib/auth-log.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../_middleware/auth.js';
import { validatePromocode, buildPlanFromPromo, getEffectivePlan } from '../_lib/promocodes.js';

const MIN_AGE = 3;
const MAX_AGE = 14;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@geroy-skazki.local')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function normalizeChildren(children) {
  if (!Array.isArray(children)) return [];
  return children.slice(0, 3).map((child, index) => {
    const gender = child.gender === 'female' ? 'female' : 'male';
    const avatarRole = gender === 'male' ? 'kid2' : 'kid1';
    const avatar = gender === 'male' ? 'kid2.png' : 'kid1.png';
    const age = Math.min(MAX_AGE, Math.max(MIN_AGE, parseInt(child.age, 10) || 5));
    return {
      name: String(child.name || '').trim(),
      age,
      gender,
      avatar,
      avatarRole,
      index
    };
  }).filter((c) => c.name);
}

function signToken(user) {
  return jwt.sign(
    {
      email: user.email,
      username: user.username,
      userId: user.email,
      plan: getEffectivePlan(user),
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
  if (!checkRateLimit(key, 5)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const normalizedEmail = (req.body.email || req.body.username || '').trim().toLowerCase();
    const username = String(req.body.username || normalizedEmail.split('@')[0] || normalizedEmail).trim();
    const { password, gender, age, children, promocode } = req.body;

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Поля username, email, password обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const exists = await userExists(normalizedEmail);
    if (exists) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const normalizedChildren = normalizeChildren(children);
    for (const child of normalizedChildren) {
      if (child.age < MIN_AGE || child.age > MAX_AGE) {
        return res.status(400).json({ error: `Age must be between ${MIN_AGE} and ${MAX_AGE}` });
      }
    }

    const passwordHash = hashPassword(password);
    const role = ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : 'user';

    let plan = 'free';
    let planExpiry = null;
    let promocodeUsed = null;
    let promoMessage = null;

    const promo = validatePromocode(promocode);
    if (promo) {
      const applied = buildPlanFromPromo(promo);
      plan = applied.plan;
      planExpiry = applied.planExpiry;
      promocodeUsed = applied.promocodeUsed;
      promoMessage = `Активирован тариф «${plan}» на ${promo.days} дней!`;
    }

    const user = {
      username,
      email: normalizedEmail,
      passwordHash,
      gender: gender || null,
      age: age != null ? parseInt(age, 10) : null,
      children: normalizedChildren,
      plan,
      planExpiry,
      promocodeUsed,
      role,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    const saved = await saveUser(normalizedEmail, user);
    const effectivePlan = getEffectivePlan(saved);
    const token = signToken({ ...saved, plan: effectivePlan });
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      token,
      promoMessage,
      user: {
        username: saved.username,
        email: normalizedEmail,
        plan: effectivePlan,
        planExpiry: saved.planExpiry || null,
        promocodeUsed: saved.promocodeUsed || null,
        role,
        children: normalizedChildren
      }
    });
  } catch (error) {
    await logError('register', error.message);
    return res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
}
