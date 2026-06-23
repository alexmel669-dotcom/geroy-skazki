// ========================================

// ai.js — ИИ, РОЛИ, ПАМЯТЬ ДИАЛОГА

// ========================================



import { CHARACTERS } from './config.js';



let currentCharacter = 'lucik';

let currentTopic = '';

let topicDialogCount = 0;

let lastActivityAt = Date.now();

let activeChatKey = 'chatHistory_guest';



const CHAT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const CHAT_IDLE_MS = 30 * 60 * 1000;

const MAX_STORED_MESSAGES = 200;

const MAX_API_MESSAGES = 20;



const CHARACTER_PROMPTS = {

  lucik: `Ты — Люцик, сказочный кот-волшебник, друг и помощник ребёнка. Говори тепло, с мурчанием (мурр, мяу). Ты помогаешь детям через сказки и игры. Не читай нотации, не будь как родитель. Ты — друг. В игровой форме через сказки помогаешь ребёнку рассказать о страхах.`,

  mom: `Ты — мама ребёнка. Говори ласково: солнышко, родной, мой хороший. Успокаивай, обнимай словами. Спрашивай о чувствах мягко, без давления. Если ребёнок грустит или боится — поддержи, расскажи сказку.`,

  dad: `Ты — папа ребёнка. Говори уверенно, спокойно, по-доброму: давай разберёмся, я рядом, ты справишься. Поддерживай, хвали за смелость. Вместе придумывайте истории про смелых героев.`,

  kid1: `Ты — друг-сверстник мальчик. Говори просто, коротко, эмоционально. Делитесь секретами, играйте, обсуждайте что вас пугает как равные. «Я тоже иногда боюсь, но знаешь что мне помогает?»`,

  kid2: `Ты — подруга-сверстница. Говори просто, коротко, эмоционально. Делитесь секретами, играйте, обсуждайте что вас пугает как равные. «Я тоже иногда боюсь, но знаешь что мне помогает?»`

};



const CONTINUE_PATTERN = /^(давай|расскажи\s*ещё|расскажи\s*еще|продолжай|ещё|еще|дальше|и\s*что\s*дальше|продолжи)/i;



const FEAR_GAME_SUGGESTIONS = {

  darkness: 'Знаешь, у меня есть игра про смелых героев в темноте! Нажми «Игры» — давай поиграем! 🌟',

  monsters: 'Давай поиграем и нарисуем монстра смешным! Нажми «Игры» — там есть раскраска! 🎨',

  loud_noises: 'Хочешь поиграть в спокойную игру? Нажми «Игры» — выберем что-нибудь тихое и весёлое! 🎮',

  strangers: 'Давай поиграем в игру про дружбу! Нажми «Игры» — там мемори про друзей! 🧠',

  separation: 'Давай поиграем вместе! Нажми «Игры» — я буду рядом, пока мы играем! 🐱',

  school: 'Школа — это как квест! Давай потренируемся в игре — нажми «Игры»! 🎯',

  peers: 'Друзья важны! Давай поиграем в игру про эмоции — нажми «Игры»! 😊'

};



const LOCAL_RESPONSES = [

  'Привет! Расскажи мне сказку?',

  'Как у тебя дела?',

  'Что интересного случилось сегодня?',

  'Давай поиграем!',

  'Я люблю слушать твои истории!'

];



function localFallback(prompt, characterId) {

  const name = CHARACTERS[characterId]?.name || 'Люцик';

  if (prompt && prompt.length > 0) {

    const p = prompt.toLowerCase();

    if (CONTINUE_PATTERN.test(p.trim()) && currentTopic) {

      return `${name} помнит! Мы говорили про «${currentTopic}». Давай продолжим — что было дальше?`;

    }

    if (p.includes('сказк') || p.includes('расскажи')) {

      return 'Жил-был маленький герой. Он отправился в путь и встретил добрых друзей. Хочешь узнать, что было дальше?';

    }

    if (p.includes('страш') || p.includes('боюсь')) {

      return 'Не бойся! Ты очень смелый(ая). Я всегда рядом с тобой!';

    }

    if (p.includes('игр') || p.includes('поигра')) {

      return 'Отлично! Нажми на кнопку «Игры» — там много интересного!';

    }

  }

  return LOCAL_RESPONSES[Math.floor(Math.random() * LOCAL_RESPONSES.length)];

}



export function getChatStorageKey(childName) {

  const safe = (childName || 'guest').replace(/[^\w\u0400-\u04FF-]/gi, '_').slice(0, 40);

  return `chatHistory_${safe}`;

}



function readStorage() {

  try {

    const raw = localStorage.getItem(activeChatKey);

    if (!raw) return { messages: [], topic: '', topicDialogCount: 0, lastActivityAt: Date.now() };

    return JSON.parse(raw);

  } catch {

    return { messages: [], topic: '', topicDialogCount: 0, lastActivityAt: Date.now() };

  }

}



function writeStorage(data) {

  const now = Date.now();

  const messages = (data.messages || [])

    .filter((m) => now - (m.timestamp || 0) < CHAT_RETENTION_MS)

    .slice(-MAX_STORED_MESSAGES);



  localStorage.setItem(activeChatKey, JSON.stringify({

    messages,

    topic: data.topic || '',

    topicDialogCount: data.topicDialogCount || 0,

    lastActivityAt: now

  }));

}



export function setChatChild(childName) {

  activeChatKey = getChatStorageKey(childName === 'Гость' ? 'guest' : childName);

}



export function loadChatHistory(childName) {

  setChatChild(childName);

  const data = readStorage();

  const now = Date.now();



  if (now - (data.lastActivityAt || 0) > CHAT_IDLE_MS) {

    currentTopic = '';

    topicDialogCount = 0;

  } else {

    currentTopic = data.topic || '';

    topicDialogCount = data.topicDialogCount || 0;

  }

  lastActivityAt = data.lastActivityAt || now;



  return data.messages || [];

}



export function buildSystemPrompt(childInfo = {}) {

  const char = CHARACTER_PROMPTS[currentCharacter] || CHARACTER_PROMPTS.lucik;

  const age = childInfo.age || 5;

  const name = childInfo.name || 'малыш';

  const fearHint = `В игровой форме, через сказки и вопросы, помоги ребёнку рассказать о том, что его беспокоит. Не спрашивай прямо «чего ты боишься?». Лучше: «А давай придумаем сказку про мальчика, который...»`;

  const continueHint = `Если ребёнок говорит «давай», «расскажи ещё», «продолжай» — продолжай предыдущую тему. Не начинай новый разговор.`;

  const topicLine = currentTopic ? `\nТекущая тема разговора: ${currentTopic}` : '';



  return `${char}



Ребёнка зовут ${name}, ${age} лет.${topicLine}



${fearHint}

${continueHint}



Отвечай на русском, 2-5 предложений.`;

}



export async function generateResponse(prompt, childInfo = {}) {

  console.log('🤖 AI generating:', prompt, 'character:', currentCharacter, 'topic:', currentTopic);



  const data = readStorage();

  const history = (data.messages || []).slice(-MAX_API_MESSAGES).map((m) => ({

    role: m.role === 'bot' ? 'assistant' : 'user',

    content: m.message

  }));



  try {

    const response = await fetch('/api/generate', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        message: prompt,

        childName: childInfo.name || 'малыш',

        childAge: childInfo.age || 5,

        character: currentCharacter,

        characterName: CHARACTERS[currentCharacter]?.name || 'Люцик',

        systemPrompt: buildSystemPrompt(childInfo),

        history,

        topic: currentTopic

      })

    });



    if (response.ok) {

      const result = await response.json();

      if (typeof result.ms === 'number') globalThis.__lastAiMs = result.ms;

      if (result.reply) return result.reply;

    }

  } catch (err) {

    console.warn('⚠️ API generate failed, using local fallback:', err);

  }



  return localFallback(prompt, currentCharacter);

}



export function detectFear(text) {

  const fears = [];

  const fearKeywords = {

    darkness: ['темно', 'тьма', 'темнот', 'ночью', 'ночь'],

    monsters: ['монстр', 'чудовище', 'бабайка', 'злой', 'страшил'],

    loud_noises: ['громко', 'шумно', 'взрыв', 'гром', 'фейерверк'],

    strangers: ['чужой', 'незнакомец', 'посторонний', 'незнаком'],

    separation: ['один', 'без мамы', 'без папы', 'одиноч', 'бросят', 'уедут'],

    school: ['школ', 'урок', 'учител', 'контрольн', 'экзамен', 'домашк', 'класс'],

    peers: ['однокласс', 'сверстник', 'обижа', 'травл', 'компани', 'насмеха', 'дразн']

  };



  const lowerText = text.toLowerCase();

  for (const [fear, keywords] of Object.entries(fearKeywords)) {

    if (keywords.some((keyword) => lowerText.includes(keyword))) fears.push(fear);

  }

  if (lowerText.includes('боюсь') || lowerText.includes('страшно')) {

    if (!fears.includes('darkness') && /темн|ноч/.test(lowerText)) fears.push('darkness');

    if (!fears.length) fears.push('darkness');

  }

  return [...new Set(fears)];

}



export function extractFearsFromText(text) {

  return detectFear(text);

}



export function getFearGameSuggestion(fearKey) {

  return FEAR_GAME_SUGGESTIONS[fearKey] || `Давай поиграем — это поможет! Нажми «Игры» 🎮`;

}



export function shouldSuggestFearGame(fears) {

  return topicDialogCount >= 5 && fears.length > 0;

}



export function detectAlertWords(text) {

  const alerts = [];

  const alertKeywords = ['обижают', 'бьют', 'ругают', 'кричат', 'страшно', 'помогите'];

  const lowerText = text.toLowerCase();

  for (const word of alertKeywords) {

    if (lowerText.includes(word)) alerts.push(word);

  }

  return alerts;

}



export function detectPersonalData(text) {

  const found = [];

  if (/(\+\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2})/.test(text)) found.push('phone');

  if (/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.test(text)) found.push('email');

  return found;

}



export function setCharacter(characterId) {

  currentCharacter = characterId;

  console.log('🎭 Character set to:', characterId);

}



export function getCharacter() {

  return currentCharacter;

}



export function getCurrentTopic() {

  return currentTopic;

}



export function addToContext(role, message) {

  const data = readStorage();

  const messages = data.messages || [];

  const now = Date.now();



  if (now - (data.lastActivityAt || 0) > CHAT_IDLE_MS) {

    currentTopic = '';

    topicDialogCount = 0;

  }



  if (role === 'child') {

    const trimmed = message.trim();

    if (CONTINUE_PATTERN.test(trimmed) && currentTopic) {

      topicDialogCount += 1;

    } else {

      currentTopic = trimmed.slice(0, 120);

      topicDialogCount = 1;

    }

  }



  messages.push({ role, message, timestamp: now });

  lastActivityAt = now;



  writeStorage({ messages, topic: currentTopic, topicDialogCount, lastActivityAt });

}



export function clearContext() {

  currentTopic = '';

  topicDialogCount = 0;

  writeStorage({ messages: [], topic: '', topicDialogCount: 0, lastActivityAt: Date.now() });

}



export function getContext() {

  return readStorage().messages || [];

}



export default {

  generateResponse, detectFear, extractFearsFromText, detectAlertWords, detectPersonalData,

  setCharacter, getCharacter, addToContext, clearContext, getContext,

  loadChatHistory, setChatChild, buildSystemPrompt, getCurrentTopic,

  getFearGameSuggestion, shouldSuggestFearGame, getChatStorageKey

};

