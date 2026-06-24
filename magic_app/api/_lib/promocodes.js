export const PROMOCODES = {
  TESTER2026: { plan: 'basic', days: 30 },
  FAMILYTEST: { plan: 'family', days: 14 },
  PSYCHOLOGIST: { plan: 'basic', days: 90 },
  FRIENDLYCAT: { plan: 'basic', days: 7 }
};

export function validatePromocode(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  const promo = PROMOCODES[key];
  if (!promo) return null;
  return { code: key, ...promo };
}

export function buildPlanFromPromo(promo) {
  const planExpiry = new Date();
  planExpiry.setDate(planExpiry.getDate() + promo.days);
  return {
    plan: promo.plan,
    planExpiry: planExpiry.toISOString(),
    promocodeUsed: promo.code
  };
}

export function getEffectivePlan(user) {
  if (!user?.plan || user.plan === 'free') return 'free';
  if (user.planExpiry && new Date(user.planExpiry) < new Date()) return 'free';
  return user.plan;
}

export function getPlanDaysRemaining(planExpiry) {
  if (!planExpiry) return 0;
  const diff = new Date(planExpiry) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}
