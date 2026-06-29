export const GRAMMAR_RULES = `
ПРАВИЛА РУССКОГО ЯЗЫКА (строго соблюдай):
- "Как твои дела?" (не "твой дела")
- "Что ты делаешь?" (не "что ты делает")
- "Расскажи мне" (не "расскажи меня")
- "Я тебя люблю" (не "я тебе люблю")
- "Давай поиграем" (не "давай поиграть")
- После предлогов "у", "для", "без" — родительный падеж
- Числительные: "2 года", "5 лет", "1 год"
- Обращайся к ребёнку по имени в именительном падеже: "{childName}, привет!"
`;

const FIXES = [
  [/твой дела/gi, 'твои дела'],
  [/твой сказка/gi, 'твоя сказка'],
  [/тебе люблю/gi, 'тебя люблю'],
  [/давай поиграть\b/gi, 'давай поиграем'],
  [/расскажи меня/gi, 'расскажи мне'],
  [/скучаю тебе/gi, 'скучаю по тебе'],
  [/как твой дела/gi, 'как твои дела'],
  [/что ты делает\b/gi, 'что ты делаешь']
];

export function getAgeWord(age) {
  const n = parseInt(age, 10);
  if (!Number.isFinite(n)) return 'лет';
  const last = n % 10;
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 14) return 'лет';
  if (last === 1) return 'год';
  if (last >= 2 && last <= 4) return 'года';
  return 'лет';
}

export function applyGrammarFixes(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;
  for (const [wrong, right] of FIXES) {
    cleaned = cleaned.replace(wrong, right);
  }
  return cleaned;
}

export default { GRAMMAR_RULES, getAgeWord, applyGrammarFixes };
