import { createHash, createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getJwtSecret, getTokenFromRequest, requireParent } from './auth.js';
import { findUser } from '../_lib/users.js';

export const PARENT_PIN_TTL_SECONDS = 300;
const AUDIENCE = 'geroy:parent-pin';
const digest = (value) => createHash('sha256').update(value).digest('hex');
// Domain separation prevents a PIN grant from being used as a login JWT.
const grantSecret = () => createHmac('sha256', getJwtSecret()).update(AUDIENCE).digest('hex');
const credentials = (profile) => digest(JSON.stringify([profile.passwordHash || '', profile.parentPinHash || '']));

// Internal issuance helper: only verify-pin may call this after successful PIN verification.
export function issueParentGrant(req, profile) {
  const token = jwt.sign({
    session: digest(getTokenFromRequest(req)),
    credentials: credentials(profile)
  }, grantSecret(), {
    algorithm: 'HS256', audience: AUDIENCE, subject: profile.email.toLowerCase(),
    expiresIn: PARENT_PIN_TTL_SECONDS
  });
  const { exp } = jwt.decode(token);
  return { parentGrant: token, expiresAt: exp * 1000 };
}

export async function requireParentPin(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const identity = await requireParent(req, res);
  if (!identity) return null;
  try {
    const profile = await findUser(identity.email);
    if (!profile) {
      res.status(401).json({ error: 'Сессия недействительна' });
      return null;
    }
    const grant = req.headers['x-parent-authorization'];
    if (!profile.parentPinHash || typeof grant !== 'string' || !grant.startsWith('Bearer ')) {
      res.status(403).json({ code: 'PARENT_PIN_REQUIRED', error: 'Подтвердите родительский PIN' });
      return null;
    }
    const proof = jwt.verify(grant.slice(7), grantSecret(), {
      algorithms: ['HS256'], audience: AUDIENCE, subject: identity.email.toLowerCase()
    });
    if (proof.session !== digest(getTokenFromRequest(req)) || proof.credentials !== credentials(profile)) {
      res.status(403).json({ code: 'PARENT_PIN_REQUIRED', error: 'Подтвердите родительский PIN' });
      return null;
    }
    return identity;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      res.status(403).json({ code: 'PARENT_PIN_REQUIRED', error: 'Подтвердите родительский PIN' });
    } else {
      // A storage failure must never grant access.
      res.status(503).json({ error: 'Проверка родительского доступа временно недоступна' });
    }
    return null;
  }
}
