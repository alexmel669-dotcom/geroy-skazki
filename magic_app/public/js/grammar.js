// ========================================
// grammar.js — пост-обработка русской речи
// ========================================

const GRAMMAR_FIXES = [
  [/\bтвой дела\b/gi, 'твои дела'],
  [/\bтвой сказка\b/gi, 'твоя сказка'],
  [/\bтвой день\b/gi, 'твой день'],
  [/\bтебе люблю\b/gi, 'тебя люблю'],
  [/\bдавай поиграть\b/gi, 'давай поиграем'],
  [/\bрасскажи меня\b/gi, 'расскажи мне'],
  [/\bскучаю тебе\b/gi, 'скучаю по тебе'],
  [/\bкак твой дела\b/gi, 'как твои дела'],
  [/\bчто ты делает\b/gi, 'что ты делаешь'],
  [/\bмы с тобой общался\b/gi, 'мы с тобой общались'],
  [/\bмного разговаривал\b/gi, 'много разговаривали']
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

export function getCorrectNameForm(name, gender = 'male') {
  if (!name) return { nom: '', dat: '', gen: '', nominative: '', dative: '', genitive: '' };
  const n = name.trim();
  const last = n.slice(-1);
  const isFemale = gender === 'female' || gender === 'f';

  let dat;
  let gen;
  if (isFemale) {
    if (last === 'а') { dat = n.slice(0, -1) + 'е'; gen = n.slice(0, -1) + 'и'; }
    else if (last === 'я') { dat = n.slice(0, -1) + 'е'; gen = n.slice(0, -1) + 'и'; }
    else { dat = n + 'е'; gen = n + 'и'; }
  } else if (last === 'а' || last === 'я') {
    dat = n.slice(0, -1) + 'е';
    gen = n.slice(0, -1) + 'и';
  } else if (last === 'й') {
    dat = n.slice(0, -1) + 'ю';
    gen = n.slice(0, -1) + 'я';
  } else {
    dat = n + 'у';
    gen = n + 'а';
  }

  return { nom: n, dat, gen, nominative: n, dative: dat, genitive: gen };
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
