// ========================================
// grammar.js — пост-обработка русской речи
// ========================================

const GRAMMAR_FIXES = [
  [/твой дела/gi, 'твои дела'],
  [/твой сказка/gi, 'твоя сказка'],
  [/твой день/gi, 'твой день'],
  [/тебе люблю/gi, 'тебя люблю'],
  [/давай поиграть\b/gi, 'давай поиграем'],
  [/расскажи меня/gi, 'расскажи мне'],
  [/скучаю тебе/gi, 'скучаю по тебе'],
  [/как твой дела/gi, 'как твои дела'],
  [/что ты делает\b/gi, 'что ты делаешь'],
  [/как прошёл твой день/gi, 'как прошёл твой день'],
  [/как прошла твой день/gi, 'как прошёл твой день']
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

export function getCorrectNameForm(childName, childGender) {
  const nominative = (childName || 'малыш').trim();
  if (!nominative) {
    return { nominative: 'малыш', dative: 'малышу', genitive: 'малыша' };
  }
  let dative = nominative;
  let genitive = nominative;
  if (/[ая]$/u.test(nominative)) {
    dative = nominative.slice(0, -1) + 'е';
    genitive = nominative.slice(0, -1) + 'и';
  } else if (/ия$/u.test(nominative)) {
    dative = nominative.slice(0, -1) + 'и';
    genitive = nominative.slice(0, -2) + 'ии';
  } else if (/[ий]$/u.test(nominative)) {
    dative = nominative.slice(0, -1) + 'ю';
    genitive = nominative.slice(0, -2) + 'ия';
  } else if (/[ь]$/u.test(nominative)) {
    dative = nominative.slice(0, -1) + 'ю';
    genitive = nominative.slice(0, -1) + 'я';
  } else {
    dative = nominative + 'е';
    genitive = nominative + 'а';
  }
  return { nominative, dative, genitive, gender: childGender || 'unknown' };
}

export function fixCommonGrammarMistakes(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;
  for (const [wrong, right] of GRAMMAR_FIXES) {
    cleaned = cleaned.replace(wrong, right);
  }
  return cleaned;
}

export default { getAgeWord, getCorrectNameForm, fixCommonGrammarMistakes };
