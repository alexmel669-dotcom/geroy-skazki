import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';
import { hashPassword } from '../_lib/crypto.js';
import { saveUser, userExists } from '../_lib/users.js';
import { setAuthCookie } from '../_lib/cookies.js';
import { logError } from '../_lib/auth-log.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../_middleware/auth.js';
import { validatePromocode, buildPlanFromPromo, getEffectivePlan } from '../_lib/promocodes.js';
import { isValidSecretQuestionKey, normalizeSecretAnswer } from '../_lib/secret-questions.js';

const MIN_AGE = 3;
const MAX_AGE = 14;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@geroy-skazki.local')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function getAgeFromBirthday(birthday) {
  if (!birthday) return null;
  const today = new Date();
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function normalizeChildren(children) {
  if (!Array.isArray(children)) return [];
  return children.slice(0, 3).map((child, index) => {
    const gender = child.gender === 'female' ? 'female' : 'male';
    const avatarRole = gender === 'male' ? 'kid2' : 'kid1';
    const avatar = gender === 'male' ? 'kid2.svg' : 'kid1.svg';
    const birthday = child.birthday || null;
    const ageFromBirthday = getAgeFromBirthday(birthday);
    const age = Math.min(MAX_AGE, Math.max(MIN_AGE, ageFromBirthday ?? parseInt(child.age, 10) || 5));
    return {
      name: String(child.name || '').trim(),
      age,
      gender,
      birthday,
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
    const { password, gender, age, children, promocode, parentPin, parentName, secretQuestion, secretAnswer } = req.body;

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Поля username, email, password обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const pinStr = String(parentPin || '').trim();
    if (!/^\d{4}$/.test(pinStr)) {
      return res.status(400).json({ error: 'PIN должен состоять из 4 цифр' });
    }

    const secretKey = String(secretQuestion || '').trim();
    const secretAnswerNorm = normalizeSecretAnswer(secretAnswer);
    if (!isValidSecretQuestionKey(secretKey)) {
      return res.status(400).json({ error: 'Выберите секретный вопрос' });
    }
    if (secretAnswerNorm.length < 2) {
      return res.status(400).json({ error: 'Ответ на секретный вопрос слишком короткий' });
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
    const parentPinHash = hashPassword(pinStr);
    const secretAnswerHash = hashPassword(secretAnswerNorm);
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
      parentPinHash,
      parentName: String(parentName || '').trim() || username,
      pinAttempts: 0,
      lockedUntil: null,
      gender: gender || null,
      age: age != null ? parseInt(age, 10) : null,
      children: normalizedChildren,
      plan,
      planExpiry,
      promocodeUsed,
      role,
      secretQuestion: secretKey,
      secretAnswerHash,
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
        parentName: saved.parentName || username,
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
