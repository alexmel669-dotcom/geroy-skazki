/**
 * Согласование русского текста по полу ребёнка.
 */

const MALE_NAME_EXCEPTIONS = new Set([
  'никита', 'илья', 'кузьма', 'фома', 'лука', 'савва', 'миша', 'саша', 'женя', 'валера'
]);

const FEMALE_NAME_EXCEPTIONS = new Set(['любовь', 'надежда', 'вероника']);

/** Пары мужской → женский для обращений ко второму лицу и к ребёнку в третьем лице */
const TO_CHILD_M2F = [
  [/\bты\s+рад\b/giu, 'ты рада'],
  [/\bты\s+готов\b/giu, 'ты готова'],
  [/\bты\s+уверен\b/giu, 'ты уверена'],
  [/\bты\s+смелый\b/giu, 'ты смелая'],
  [/\bты\s+молодец\b/giu, 'ты молодец'], // ok both
  [/\bты\s+устал\b/giu, 'ты устала'],
  [/\bты\s+расстроен\b/giu, 'ты расстроена'],
  [/\bты\s+обрадовался\b/giu, 'ты обрадовалась'],
  [/\bты\s+сказал\b/giu, 'ты сказала'],
  [/\bты\s+пошёл\b/giu, 'ты пошла'],
  [/\bты\s+пришёл\b/giu, 'ты пришла'],
  [/\bты\s+уснул\b/giu, 'ты уснула'],
  [/\bмой\s+хороший\b/giu, 'моя хорошая'],
  [/\bмой\s+родной\b/giu, 'моя родная'],
  [/\bмой\s+смелый\b/giu, 'моя смелая'],
  [/\bмой\s+маленький\b/giu, 'моя маленькая'],
  [/\bлучший\s+друг\b/giu, 'лучшая подруга'],
  [/\bмой\s+лучший\s+друг\b/giu, 'моя лучшая подруга'],
  [/\bмаленький\s+герой\b/giu, 'маленькая героиня'],
  [/\bон\s+молодец\b/giu, 'она молодец'],
  [/\bон\s+справился\b/giu, 'она справилась'],
  [/\bон\s+мог\b/giu, 'она могла'],
  [/\bон\s+был\b/giu, 'она была'],
  [/\bон\s+стал\b/giu, 'она стала'],
  [/\bон\s+пошёл\b/giu, 'она пошла'],
  [/\bон\s+сказал\b/giu, 'она сказала'],
  [/\bты\s+нашёл\b/giu, 'ты нашла'],
  [/\bТы\s+нашёл\b/gu, 'Ты нашла'],
  [/\bты\s+победил\b/giu, 'ты победила'],
  [/\bты\s+провёл\b/giu, 'ты провела'],
  [/\bты\s+поступил\b/giu, 'ты поступила'],
  [/\bобщался\b/giu, 'общалась']
];

const TO_CHILD_F2M = [
  [/\bты\s+рада\b/giu, 'ты рад'],
  [/\bты\s+готова\b/giu, 'ты готов'],
  [/\bты\s+уверена\b/giu, 'ты уверен'],
  [/\bты\s+смелая\b/giu, 'ты смелый'],
  [/\bты\s+устала\b/giu, 'ты устал'],
  [/\bты\s+расстроена\b/giu, 'ты расстроен'],
  [/\bты\s+обрадовалась\b/giu, 'ты обрадовался'],
  [/\bты\s+сказала\b/giu, 'ты сказал'],
  [/\bты\s+пошла\b/giu, 'ты пошёл'],
  [/\bты\s+пришла\b/giu, 'ты пришёл'],
  [/\bты\s+уснула\b/giu, 'ты уснул'],
  [/\bмоя\s+хорошая\b/giu, 'мой хороший'],
  [/\bмоя\s+родная\b/giu, 'мой родной'],
  [/\bмоя\s+смелая\b/giu, 'мой смелый'],
  [/\bмоя\s+маленькая\b/giu, 'мой маленький'],
  [/\bлучшая\s+подруга\b/giu, 'лучший друг'],
  [/\bмоя\s+лучшая\s+подруга\b/giu, 'мой лучший друг'],
  [/\bмаленькая\s+героиня\b/giu, 'маленький герой'],
  [/\bона\s+молодец\b/giu, 'он молодец'],
  [/\bона\s+справилась\b/giu, 'он справился'],
  [/\bона\s+могла\b/giu, 'он мог'],
  [/\bона\s+была\b/giu, 'он был'],
  [/\bона\s+стала\b/giu, 'он стал'],
  [/\bона\s+пошла\b/giu, 'он пошёл'],
  [/\bона\s+сказала\b/giu, 'он сказал'],
  [/\bты\s+нашла\b/giu, 'ты нашёл'],
  [/\bТы\s+нашла\b/gu, 'Ты нашёл'],
  [/\bты\s+победила\b/giu, 'ты победил'],
  [/\bты\s+провела\b/giu, 'ты провёл'],
  [/\bты\s+поступила\b/giu, 'ты поступил'],
  [/\bобщалась\b/giu, 'общался']
];

export function normalizeGender(value) {
  if (value === 'male' || value === 'm') return 'male';
  if (value === 'female' || value === 'f') return 'female';
  return 'unknown';
}

export function guessGenderFromName(name) {
  if (!name || typeof name !== 'string') return 'unknown';
  const n = name.trim().toLowerCase().split(/\s+/)[0];
  if (!n) return 'unknown';
  if (MALE_NAME_EXCEPTIONS.has(n)) return 'male';
  if (FEMALE_NAME_EXCEPTIONS.has(n)) return 'female';
  if (/[ая]$/u.test(n)) return 'female';
  if (/[ийь]$/u.test(n)) return 'male';
  return 'unknown';
}

export function getChildGender(child) {
  if (!child) return 'unknown';
  const g = normalizeGender(child.gender);
  if (g !== 'unknown') return g;
  const fromName = guessGenderFromName(child.name);
  if (fromName !== 'unknown') return fromName;
  if (child.avatarRole === 'kid2' || String(child.avatar || '').includes('kid2')) return 'male';
  if (child.avatarRole === 'kid1' || String(child.avatar || '').includes('kid1')) return 'female';
  return 'unknown';
}

export function pickByGender(gender, male, female, neutral = male) {
  const g = normalizeGender(gender);
  if (g === 'female') return female;
  if (g === 'male') return male;
  return neutral;
}

export function friendWord(gender) {
  return pickByGender(gender, 'друг', 'подруга', 'друг');
}

export function bestFriendPhrase(gender) {
  return pickByGender(gender, 'Ты мой лучший друг!', 'Ты моя лучшая подруга!', 'Ты мне очень дорог!');
}

export function gladToSeePhrase(gender) {
  return pickByGender(gender, 'Я рад тебя видеть!', 'Я рада тебя видеть!', 'Как хорошо тебя видеть!');
}

export function braveWord(gender) {
  return pickByGender(gender, 'смелый', 'смелая', 'смелый');
}

export function foundWord(gender) {
  return pickByGender(gender, 'нашёл', 'нашла', 'нашёл');
}

export function chattedPast(gender) {
  return pickByGender(gender, 'общался', 'общалась', 'общался');
}

export function formatChildText(text, gender) {
  if (!text) return text;
  const out = String(text)
    .replace(/\{смелый\}/g, braveWord(gender))
    .replace(/\{нашёл\}/g, foundWord(gender));
  return applyGenderToText(out, gender);
}

export function buildGenderPrompt(gender, childName) {
  const g = normalizeGender(gender);
  const name = childName ? ` (${childName})` : '';
  if (g === 'female') {
    return `Пол ребёнка${name}: ДЕВОЧКА. Обращайся только в ЖЕНСКОМ роде: «ты рада», «ты готова», «ты смелая», «молодец» (без «рад»). В третьем лице — «она». Не используй «он», «рад», «готов», «смелый» по отношению к ребёнку.`;
  }
  if (g === 'male') {
    return `Пол ребёнка${name}: МАЛЬЧИК. Обращайся только в МУЖСКОМ роде: «ты рад», «ты готов», «ты смелый». В третьем лице — «он». Не используй «она», «рада», «готова», «смелая» по отношению к ребёнку.`;
  }
  return `Пол ребёнка${name} не указан. Используй нейтральные формулировки без «рад/рада», «готов/готова»: «Как здорово!», «Молодец!», «Ты справишься!».`;
}

export function applyGenderToText(text, gender) {
  if (!text || typeof text !== 'string') return text;
  const g = normalizeGender(gender);
  if (g === 'unknown') return text;
  const rules = g === 'female' ? TO_CHILD_M2F : TO_CHILD_F2M;
  let out = text;
  for (const [re, repl] of rules) {
    out = out.replace(re, repl);
  }
  return out;
}

export default {
  normalizeGender,
  guessGenderFromName,
  getChildGender,
  pickByGender,
  friendWord,
  bestFriendPhrase,
  gladToSeePhrase,
  braveWord,
  foundWord,
  chattedPast,
  formatChildText,
  buildGenderPrompt,
  applyGenderToText
};
