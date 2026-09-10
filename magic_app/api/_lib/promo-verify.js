// ============================================================
// promo-verify.js — реальная проверка промокодов PSY-/SPEC-/ORPH- (P0-3)
//
// Раньше validatePromocode() в promocodes.js принимала ЛЮБУЮ строку с нужным
// префиксом ('PSY-', 'SPEC-') — это позволяло зарегистрироваться психологом
// (role: 'psychologist', доступ к чатам с родителями и детьми) без единой
// реальной проверки диплома/одобрения админом, просто придумав код на месте.
// Для ORPH- частичная проверка уже была (сверка с geroy:orphanage:verified:*)
// — она сохранена и здесь, просто вынесена в общее место.
//
// verifyPromoCode(code, type) считает код валидным, если выполняется ХОТЯ БЫ
// одно из условий:
//   a) SHA-256(код) совпадает с "мастер"-хешем из env (PSY_PROMO_HASH /
//      SPEC_PROMO_HASH / ORPH_PROMO_HASH) — вариант для одного общего кода,
//      который админ раздаёт вручную (конференции, партнёрства и т.п.);
//   b) код реально был выдан админом конкретному специалисту/интернату через
//      ручное одобрение заявки (admin-applications.js) и хранится в Redis как
//      верифицированный.
//
// Если ни одно условие не выполняется — код отклоняется, роль/премиум-план
// НЕ выдаются, а попытка логируется (logRejectedPromoAttempt), чтобы админ
// видел её и мог связаться с человеком/попросить подать заявку на ручную
// верификацию через существующие формы (psychologist-apply.js, verify-orphanage.js).
// ============================================================

import crypto from 'crypto';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const HEX64 = /^[0-9a-f]{64}$/i;

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function timingSafeHexEqual(hexA, hexB) {
  if (!HEX64.test(hexA) || !HEX64.test(hexB)) return false;
  const bufA = Buffer.from(hexA, 'hex');
  const bufB = Buffer.from(hexB, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function matchesMasterHash(code, envHash) {
  const expected = String(envHash || '').trim().toLowerCase();
  if (!expected) return false;
  return timingSafeHexEqual(sha256Hex(code), expected);
}

/**
 * @param {string} code - промокод как ввёл пользователь (например "PSY-IVAN-A1B2")
 * @param {'psychologist'|'specialist'|'orphanage'} type
 * @returns {Promise<{valid: boolean, source?: 'master'|'issued', record?: object, reason?: string}>}
 */
export async function verifyPromoCode(code, type) {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw) return { valid: false, reason: 'empty' };

  try {
    if (type === 'psychologist') {
      if (matchesMasterHash(raw, process.env.PSY_PROMO_HASH)) {
        return { valid: true, source: 'master' };
      }
      const list = (await redis.get('geroy:psychologists')) || [];
      const record = Array.isArray(list)
        ? list.find((p) => String(p.promoCode || '').toUpperCase() === raw && p.active !== false)
        : null;
      return record ? { valid: true, source: 'issued', record } : { valid: false, reason: 'not_issued' };
    }

    if (type === 'specialist') {
      if (matchesMasterHash(raw, process.env.SPEC_PROMO_HASH)) {
        return { valid: true, source: 'master' };
      }
      const record = await redis.get(`geroy:specialist:verified:${raw}`);
      return record ? { valid: true, source: 'issued', record } : { valid: false, reason: 'not_issued' };
    }

    if (type === 'orphanage') {
      if (matchesMasterHash(raw, process.env.ORPH_PROMO_HASH)) {
        return { valid: true, source: 'master' };
      }
      const record = await redis.get(`geroy:orphanage:verified:${raw}`);
      return record ? { valid: true, source: 'issued', record } : { valid: false, reason: 'not_issued' };
    }

    return { valid: false, reason: 'unknown_type' };
  } catch (err) {
    console.error('[promo-verify] verifyPromoCode error:', err?.message || err);
    return { valid: false, reason: 'error' };
  }
}

/**
 * Логирует отклонённую попытку применить неверифицированный код — чтобы админ
 * видел в статистике, что кто-то пытался (и мог вручную выдать доступ, если
 * человек реально психолог/интернат, просто без действующего кода).
 */
export async function logRejectedPromoAttempt(code, type, email) {
  try {
    const key = 'geroy:promo:rejected-attempts';
    const list = (await redis.get(key)) || [];
    const arr = Array.isArray(list) ? list : [];
    arr.push({
      code: String(code || '').trim().toUpperCase(),
      type,
      email: String(email || '').trim().toLowerCase() || null,
      at: new Date().toISOString()
    });
    await redis.set(key, arr.slice(-500));
  } catch (err) {
    console.error('[promo-verify] logRejectedPromoAttempt error:', err?.message || err);
  }
}

export { sha256Hex };
