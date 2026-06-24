import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  return verify(password, stored);
}

export function verify(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const hashVerify = scryptSync(password, salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashVerify, 'hex'));
  } catch {
    return false;
  }
}
