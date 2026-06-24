export const ALLOWED_SLANG = [
  'круто', 'классно', 'здорово', 'супер',
  'огонь', 'топ', 'залипательно', 'няшно',
  'милота', 'обожаю', 'ураган', 'бомба',
  'краш', 'вайб', 'чилить', 'рофл'
];

export const FORBIDDEN_WORDS = [
  'бля', 'хуй', 'пизд', 'еба', 'ёб', 'сука', 'мудак', 'дебил',
  'идиот', 'дурак', 'тупой', 'урод', 'кретин', 'придурок',
  'заткнись', 'убирайся', 'жесть', 'кошмар', 'ужас',
  'fuck', 'shit', 'damn', 'stupid', 'idiot', 'bitch'
];

export function getAgeBasedTone(age) {
  const a = parseInt(age, 10) || 5;
  if (a <= 7) return 'Говори просто, как с малышом. Короткие предложения, много ласки.';
  if (a <= 10) return 'Говори как с другом. Можно использовать слова «круто», «здорово», «классно».';
  if (a <= 14) {
    return `Говори на современном языке. Можно: «огонь», «залипательно», «топ», «краш» (увлечение). Нельзя: мат, жаргон, агрессия.
ВАЖНО для возраста 11-14:
- Можно: круто, классно, огонь, топ, залипательно, вайб, чилить
- Нельзя: любые оскорбления, мат, агрессивные выражения
- Нельзя: обсуждать романтические отношения, насилие, опасные челленджи
- Нельзя: давать советы, которые могут навредить
- Если ребёнок спрашивает о запрещённом — мягко переведи тему`;
  }
  return '';
}

export function sanitizeAIText(text, age) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;

  FORBIDDEN_WORDS.forEach((word) => {
    const regex = new RegExp(word, 'gi');
    cleaned = cleaned.replace(regex, '***');
  });

  const childAge = parseInt(age, 10) || 5;
  if (childAge < 11) {
    ALLOWED_SLANG.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      cleaned = cleaned.replace(regex, 'здорово');
    });
  }

  return cleaned;
}
