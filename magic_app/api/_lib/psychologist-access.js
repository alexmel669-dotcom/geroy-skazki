import { Redis } from '@upstash/redis';
import { findUser } from '../_lib/users.js';
import { verifyAuth } from '../_middleware/auth.js';
import { isValidAdminToken } from '../_lib/admin-token.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const LIST_KEY = 'geroy:psychologists';

export function getQuery(req) {
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length) {
    return req.query;
  }
  try {
    return Object.fromEntries(new URL(req.url || '', 'http://localhost').searchParams);
  } catch {
    return {};
  }
}

export async function findPsychologistProfile(email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  const list = (await redis.get(LIST_KEY)) || [];
  if (!Array.isArray(list)) return null;
  return list.find((p) => String(p.email || '').toLowerCase() === normalized) || null;
}

/** Пользователь с role=psychologist или запись в списке партнёров */
export async function resolvePsychologistAccess(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;

  const user = await findUser(normalized);
  const profile = await findPsychologistProfile(normalized);

  if (user?.role === 'psychologist' || (profile && profile.active !== false)) {
    return {
      email: normalized,
      user,
      profile,
      promoCode: user?.promoCode || profile?.promoCode || null,
      name: profile?.name || user?.parentName || user?.username || normalized
    };
  }
  return null;
}

export async function requirePsychologist(req, emailHint) {
  if (isValidAdminToken(req)) {
    const email = String(emailHint || '').trim().toLowerCase();
    if (!email) return { admin: true, email: null };
    const access = await resolvePsychologistAccess(email);
    return access ? { ...access, admin: true } : { admin: true, email, user: null, profile: null };
  }

  const auth = verifyAuth(req);
  if (!auth?.email) return null;

  const email = String(emailHint || auth.email).trim().toLowerCase();
  if (email !== String(auth.email).toLowerCase() && auth.role !== 'admin') {
    return null;
  }

  return resolvePsychologistAccess(email);
}

export function chatKey(psychologistEmail, parentEmail) {
  const a = String(psychologistEmail || '').trim().toLowerCase();
  const b = String(parentEmail || '').trim().toLowerCase();
  return `geroy:chat:${a}:${b}`;
}

export { redis, LIST_KEY };
