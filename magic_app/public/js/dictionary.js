const BASE_DICTIONARY = {
  'привет': ['Привет, {имя}!', 'Здравствуй, {имя}! {timeGreeting}'],
  'как дела': ['У меня всё отлично! А у тебя как?', 'Замечательно! Расскажи, что интересного сегодня было?'],
  'что делаешь': ['Я думаю о волшебных приключениях! А ты чем занимаешься?'],
  'пока': ['До встречи, {имя}! Буду ждать тебя!', 'Пока-пока! Приходи ещё!'],
  'спокойной ночи': ['Сладких снов, {имя}! Пусть тебе приснится волшебный лес.'],
  'я тебя люблю': ['Я тебя тоже очень люблю, {имя}! Ты мой лучший друг!'],
  'мне грустно': ['Знаешь, {имя}, иногда всем бывает грустно. Это нормально. Давай подышим вместе?'],
  'мне страшно': ['Я рядом, {имя}. Вместе мы справимся. Давай я расскажу тебе спокойную сказку?'],
  'расскажи сказку': ['С удовольствием! Но это будет считаться сказкой. Продолжить?']
};

const LEARNED_DICTIONARY_KEY = 'geroy-learned-dictionary';
const MAX_DICTIONARY_SIZE = 500;

export function getLearnedDictionary() {
  try {
    return JSON.parse(localStorage.getItem(LEARNED_DICTIONARY_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveLearnedDictionary(dict) {
  localStorage.setItem(LEARNED_DICTIONARY_KEY, JSON.stringify(dict));
}

export function learnFromResponse(question, aiResponse) {
  if (!question || !aiResponse) return;
  const key = question.toLowerCase().trim().slice(0, 100);
  const dict = getLearnedDictionary();

  if (!dict[key]) dict[key] = [];
  if (!dict[key].includes(aiResponse)) {
    dict[key].push(aiResponse);
  }
  if (dict[key].length > 5) dict[key].shift();

  const keys = Object.keys(dict);
  if (keys.length > MAX_DICTIONARY_SIZE) {
    delete dict[keys[0]];
  }
  saveLearnedDictionary(dict);
}

export function fillTemplate(text, childName, timeContext) {
  return String(text)
    .replace(/\{имя\}/g, childName || 'друг')
    .replace(/\{timeGreeting\}/g, timeContext?.greeting || '');
}

export function getDictionaryReply(question, childName, timeContext) {
  const key = question.toLowerCase().trim().slice(0, 100);

  const learned = getLearnedDictionary();
  if (learned[key]?.length) {
    const reply = learned[key][Math.floor(Math.random() * learned[key].length)];
    return fillTemplate(reply, childName, timeContext);
  }

  for (const [pattern, replies] of Object.entries(BASE_DICTIONARY)) {
    if (key.includes(pattern)) {
      const reply = replies[Math.floor(Math.random() * replies.length)];
      return fillTemplate(reply, childName, timeContext);
    }
  }

  return null;
}

export function detectRequestType(text) {
  const storyTriggers = [
    'расскажи сказку', 'сказку', 'историю', 'расскажи историю',
    'почитай', 'сказка', 'расскажи про'
  ];
  const lower = String(text || '').toLowerCase();
  const isStory = storyTriggers.some((t) => lower.includes(t));
  return isStory ? 'story' : 'chat';
}

export default {
  getLearnedDictionary,
  saveLearnedDictionary,
  learnFromResponse,
  getDictionaryReply,
  detectRequestType,
  fillTemplate
};
