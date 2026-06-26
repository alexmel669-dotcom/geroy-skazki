import { friendWord, bestFriendPhrase, applyGenderToText } from './gender.js';

const BASE_DICTIONARY = {
  'привет': ['Привет, {имя}!', 'Здравствуй, {имя}! {timeGreeting}'],
  'как дела': ['У меня всё отлично! А у тебя как?', 'Замечательно! Расскажи, что интересного сегодня было?'],
  'что делаешь': ['Я думаю о волшебных приключениях! А ты чем занимаешься?'],
  'пока': ['До встречи, {имя}! Буду ждать тебя!', 'Пока-пока! Приходи ещё!'],
  'спокойной ночи': ['Сладких снов, {имя}! Пусть тебе приснится волшебный лес.'],
  'я тебя люблю': ['Я тебя тоже очень люблю, {имя}! {bestFriend}'],
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

export function fillTemplate(text, childName, timeContext, gender) {
  const friend = friendWord(gender);
  return String(text)
    .replace(/\{имя\}/g, childName || friend)
    .replace(/\{timeGreeting\}/g, timeContext?.greeting || '')
    .replace(/\{bestFriend\}/g, bestFriendPhrase(gender))
    .replace(/\{друг\}/g, friend);
}

export function getDictionaryReply(question, childName, timeContext, gender = 'unknown') {
  const key = question.toLowerCase().trim().slice(0, 100);
  if (!key) return null;

  const learned = getLearnedDictionary();
  if (learned[key]?.length) {
    const reply = learned[key][Math.floor(Math.random() * learned[key].length)];
    return applyGenderToText(fillTemplate(reply, childName, timeContext, gender), gender);
  }

  for (const [pattern, replies] of Object.entries(BASE_DICTIONARY)) {
    if (key.includes(pattern)) {
      const reply = replies[Math.floor(Math.random() * replies.length)];
      return applyGenderToText(fillTemplate(reply, childName, timeContext, gender), gender);
    }
  }

  return null;
}

/** Fallback-ответ только когда API недоступен */
export function getDictionaryFallback(question, childName, timeContext, gender = 'unknown') {
  return getDictionaryReply(question, childName, timeContext, gender);
}

const BEDTIME_TRIGGERS = [
  'сказка на ночь',
  'сказку на ночь',
  'перед сном',
  'хочу спать',
  'спокойной ночи',
  'уложи спать',
  'пора спать'
];

const STORY_TRIGGERS = [
  'расскажи сказку', 'расскажи историю', 'расскажи про',
  'почитай сказку', 'почитай историю', 'хочу сказку', 'хочу историю'
];

export function isBedtimeStoryRequest(text) {
  const lower = String(text || '').toLowerCase().trim();
  if (!lower) return false;
  return BEDTIME_TRIGGERS.some((t) => lower.includes(t));
}

export function detectRequestType(text) {
  const lower = String(text || '').toLowerCase().trim();
  if (!lower) return 'chat';
  if (isBedtimeStoryRequest(text)) return 'bedtime_story';
  const isStory = STORY_TRIGGERS.some((t) => lower.includes(t));
  return isStory ? 'story' : 'chat';
}

export default {
  getLearnedDictionary,
  saveLearnedDictionary,
  learnFromResponse,
  getDictionaryReply,
  getDictionaryFallback,
  detectRequestType,
  isBedtimeStoryRequest,
  fillTemplate
};
