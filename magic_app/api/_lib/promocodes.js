export const PROMO_TYPES = {
  FOUNDERS: { plan: 'basic', days: 30, limit: 100, type: 'public' },
  ORPHANAGE: { plan: 'premium', days: 365, limit: 999, type: 'verified', verify: 'orphanage' },
  PSYCHOLOGIST: { plan: 'premium', days: 365, limit: 1, type: 'psychologist', singleUse: true },
  SPECIALIST: { plan: 'premium', days: 365, limit: 1, type: 'specialist', singleUse: true }
};

/** Статические коды (обратная совместимость) */
export const PROMOCODES = {
  /** Тестерский промокод: basic 30 дней. За 3 дня до конца — уведомление; продление +7 дней за отзыв ⭐4+ */
  TESTER2026: { plan: 'basic', days: 30 },
  FAMILYTEST: { plan: 'family', days: 14 },
  PSYCHOLOGIST: { plan: 'basic', days: 90 },
  FRIENDLYCAT: { plan: 'basic', days: 7 },
  FOUNDERS: { ...PROMO_TYPES.FOUNDERS }
};

/** Совместимость: неизвестные планы → free; premium остаётся premium */
export function normalizePlan(plan) {
  if (!plan || plan === 'free') return 'free';
  if (plan === 'premium' || plan === 'family' || plan === 'basic') return plan;
  return 'free';
}

export function generatePsychologistCode(name) {
  const id = Date.now().toString(36).toUpperCase().slice(-4);
  const cleanName = String(name || '').replace(/[^A-Za-zА-Яа-яЁё]/g, '').toUpperCase().slice(0, 4) || 'PSY';
  return `PSY-${cleanName}-${id}`;
}

export function generateSpecialistCode(name, type) {
  const id = Date.now().toString(36).toUpperCase().slice(-4);
  const cleanName = String(name || '').replace(/[^A-Za-zА-Яа-яЁё]/g, '').toUpperCase().slice(0, 4) || 'SPEC';
  const typePart = String(type || 'SPEC').toUpperCase().slice(0, 4);
  return `SPEC-${typePart}-${cleanName}-${id}`;
}

export function generateOrphanageCode(name) {
  const cleanName = String(name || '').replace(/[^A-Za-zА-Яа-яЁё]/g, '').toUpperCase().slice(0, 6) || 'ORPH';
  return `ORPH-${cleanName}-${Date.now().toString(36).slice(-3)}`;
}

export function validatePromocode(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();

  const staticPromo = PROMOCODES[key];
  if (staticPromo) {
    return { code: key, ...staticPromo };
  }

  if (key.startsWith('ORPH-')) {
    return { code: key, ...PROMO_TYPES.ORPHANAGE };
  }
  if (key.startsWith('PSY-')) {
    return { code: key, ...PROMO_TYPES.PSYCHOLOGIST };
  }
  if (key.startsWith('SPEC-')) {
    return { code: key, ...PROMO_TYPES.SPECIALIST };
  }

  return null;
}

export function buildPlanFromPromo(promo) {
  const planExpiry = new Date();
  planExpiry.setDate(planExpiry.getDate() + promo.days);
  return {
    plan: normalizePlan(promo.plan),
    planExpiry: planExpiry.toISOString(),
    promocodeUsed: promo.code
  };
}

export function getEffectivePlan(user) {
  if (!user?.plan || user.plan === 'free') return 'free';
  if (user.planExpiry && new Date(user.planExpiry) < new Date()) return 'free';
  return normalizePlan(user.plan);
}

export function getPlanDaysRemaining(planExpiry) {
  if (!planExpiry) return 0;
  const diff = new Date(planExpiry) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}
