// ========================================
// ai.js — ИИ, РОЛИ, ПАМЯТЬ ДИАЛОГА
// ========================================

import { CHARACTERS, PLANS } from './config.js';

let currentCharacter = 'lucik';
let currentTopic = '';
let topicDialogCount = 0;
let activeChatKey = 'chatHistory_guest';

const CHAT_IDLE_MS = 30 * 60 * 1000;
const MAX_STORED_MESSAGES = 200;
const MAX_API_MESSAGES = 20;

function getChatRetentionMs() {
  const planId = localStorage.getItem('userPlan') || 'free';
  const days = PLANS[planId]?.memoryDays || PLANS.free.memoryDays;
  return days * 24 * 60 * 60 * 1000;
}

const CHARACTER_PROMPTS = {
  lucik: 'Ты — Люцик, сказочный кот-волшебник, друг и помощник ребёнка. Говори тепло, с мурчанием (мурр, мяу). Помогаешь через сказки и игры. Не читай нотации, не будь как родитель. В игровой форме помогаешь рассказать о страхах.',
  mom: 'Ты — мама ребёнка. Говори ласково: солнышко, родной, мой хороший. Успокаивай, обнимай словами. Мягко спрашивай о чувствах без давления.',
  dad: 'Ты — папа ребёнка. Говори уверенно и по-доброму: давай разберёмся, я рядом, ты справишься. Хвали за смелость, придумывайте истории про героев.',
  kid1: 'Ты — подруга-сверстница. Говори просто, коротко, эмоционально. Делитесь секретами. «Я тоже иногда боюсь, но знаешь что мне помогает?»',
  kid2: 'Ты — друг-сверстник мальчик. Говори просто, коротко, эмоционально. Делитесь секретами. «Я тоже иногда боюсь, но знаешь что мне помогает?»'
};

const FEAR_GAME_HINTS = {
  darkness: 'Давай поиграем в игру про смелых героев! Нажми «Игры» 🌟',
  monsters: 'Нарисуем монстра смешным? Нажми «Игры» — там квест! 🗺️',
  loud_noises: 'Поиграем в спокойную игру? Нажми «Игры»! 🎮',
  strangers: 'Давай поиграем в игру про дружбу! Нажми «Игры»! 🧠',
  separation: 'Я рядом! Нажми «Игры» — поиграем вместе! 🐱',
  school: 'Школа — как квест! Нажми «Игры»! 🎯',
  peers: 'Друзья важны! Нажми «Игры» — загадки и квест! 🗺️'
};

const CONTINUE_RE = /^(давай|расскажи\s*ещё|расскажи\s*еще|продолжай|ещё|еще|дальше|продолжи)/i;

const LOCAL_RESPONSES = [
  'Привет! Расскажи мне сказку?', 'Как у тебя дела?', 'Давай поиграем!',
  'Я люблю слушать твои истории!'
];

function localFallback(prompt) {
  const p = (prompt || '').toLowerCase();
  if (CONTINUE_RE.test(p.trim()) && currentTopic) {
    return `Помню! Мы говорили про «${currentTopic}». Что было дальше?`;
  }
  if (p.includes('сказк')) return 'Жил-был герой. Он отправился в путь и встретил друзей. Хочешь узнать, что дальше?';
  if (p.includes('боюсь') || p.includes('страш')) return 'Не бойся! Я рядом с тобой!';
  if (p.includes('игр')) return 'Нажми «Игры» — там много интересного!';
  return LOCAL_RESPONSES[Math.floor(Math.random() * LOCAL_RESPONSES.length)];
}

export function getChatStorageKey(childName) {
  const safe = (childName || 'guest').replace(/[^\w\u0400-\u04FF-]/gi, '_').slice(0, 40);
  return `chatHistory_${safe}`;
}

function readStore() {
  try {
    const data = JSON.parse(localStorage.getItem(activeChatKey) || '{}');
    return {
      messages: data.messages || [],
      topic: data.topic || '',
      topicDialogCount: data.topicDialogCount || 0,
      lastActivityAt: data.lastActivityAt || Date.now()
    };
  } catch {
    return { messages: [], topic: '', topicDialogCount: 0, lastActivityAt: Date.now() };
  }
}

function writeStore(data) {
  const now = Date.now();
  const messages = (data.messages || [])
    .filter((m) => now - (m.timestamp || 0) < getChatRetentionMs())
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
  const data = readStore();
  if (Date.now() - data.lastActivityAt > CHAT_IDLE_MS) {
    currentTopic = '';
    topicDialogCount = 0;
  } else {
    currentTopic = data.topic;
    topicDialogCount = data.topicDialogCount;
  }
  return data.messages;
}

export function buildSystemPrompt(childInfo = {}) {
  const role = CHARACTER_PROMPTS[currentCharacter] || CHARACTER_PROMPTS.lucik;
  const name = childInfo.name || 'малыш';
  const age = childInfo.age || 5;
  const fearHint = 'Будь мягким собеседником. Не спрашивай прямо про страхи. Рассказывай сказки и спрашивай «А как бы ты поступил?»';
  const continueHint = 'Если ребёнок говорит «давай», «расскажи ещё», «продолжай» — продолжай предыдущую тему. Не начинай новый разговор.';
  const topicLine = currentTopic ? `\nТекущая тема: ${currentTopic}` : '';
  return `${role}\n\nРебёнка зовут ${name}, ${age} лет.${topicLine}\n\n${fearHint}\n${continueHint}\n\nОтвечай на русском, 2-5 предложений.`;
}

export function getProfileForAI(childInfo = {}) {
  const storedName = localStorage.getItem('profileChildName') || '';
  const storedAge = localStorage.getItem('profileChildAge') || '';
  const name = childInfo.name && childInfo.name !== 'Гость' ? childInfo.name : storedName;
  const age = childInfo.age || (storedAge ? parseInt(storedAge, 10) : null);
  const store = readStore();
  const isFirstMessage = store.messages.length === 0;
  return { name: name || null, age: age || null, isFirstMessage };
}

export async function generateResponse(prompt, childInfo = {}) {
  console.log('🤖 generate:', prompt, 'char:', currentCharacter, 'topic:', currentTopic);
  const profile = getProfileForAI(childInfo);
  const store = readStore();
  const history = store.messages.slice(-MAX_API_MESSAGES).map((m) => ({
    role: m.role === 'bot' ? 'assistant' : 'user',
    content: m.message
  }));

  const fallback = { text: localFallback(prompt), childName: null, childAge: null, concerns: null, mood: 'neutral' };

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        childName: profile.name,
        childAge: profile.age,
        character: currentCharacter,
        characterName: CHARACTERS[currentCharacter]?.name || 'Люцик',
        requestType: childInfo.requestType || 'chat',
        timeContext: childInfo.timeContext || null,
        history,
        topic: currentTopic,
        isFirstMessage: profile.isFirstMessage
      })
    });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.ms === 'number') globalThis.__lastAiMs = data.ms;
      if (data.reply) {
        return {
          text: data.reply,
          type: data.type || childInfo.requestType || 'chat',
          childName: data.childName || null,
          childAge: data.childAge != null ? data.childAge : null,
          concerns: data.concerns || null,
          mood: data.mood || 'neutral'
        };
      }
    }
  } catch (err) {
    console.warn('⚠️ generate API failed:', err);
  }
  return fallback;
}

export function detectFear(text) {
  const fears = [];
  const kw = {
    darkness: ['темно', 'тьма', 'темнот', 'ночью', 'ночь'],
    monsters: ['монстр', 'чудовище', 'бабайка'],
    loud_noises: ['громко', 'шумно', 'гром', 'взрыв'],
    strangers: ['чужой', 'незнакомец', 'посторонний'],
    separation: ['один', 'без мамы', 'без папы', 'бросят'],
    school: ['школ', 'урок', 'учител', 'экзамен', 'домашк'],
    peers: ['однокласс', 'обижа', 'травл', 'насмеха', 'дразн']
  };
  const lower = text.toLowerCase();
  for (const [f, words] of Object.entries(kw)) {
    if (words.some((w) => lower.includes(w))) fears.push(f);
  }
  if ((lower.includes('боюсь') || lower.includes('страшно')) && !fears.length) fears.push('darkness');
  return [...new Set(fears)];
}

export function extractFearsFromText(text) {
  return detectFear(text);
}

export function shouldSuggestFearGame(fears) {
  return topicDialogCount >= 5 && fears.length > 0;
}

export function getFearGameSuggestion(fearKey) {
  return FEAR_GAME_HINTS[fearKey] || 'Давай поиграем — нажми «Игры»! 🎮';
}

export function detectAlertWords(text) {
  const alerts = [];
  for (const w of ['обижают', 'бьют', 'ругают', 'кричат', 'страшно', 'помогите']) {
    if (text.toLowerCase().includes(w)) alerts.push(w);
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
}

export function getCharacter() {
  return currentCharacter;
}

export function getCurrentTopic() {
  return currentTopic;
}

export function addToContext(role, message) {
  const store = readStore();
  const now = Date.now();
  if (now - store.lastActivityAt > CHAT_IDLE_MS) {
    currentTopic = '';
    topicDialogCount = 0;
  }
  if (role === 'child') {
    const t = message.trim();
    if (CONTINUE_RE.test(t) && currentTopic) topicDialogCount++;
    else { currentTopic = t.slice(0, 120); topicDialogCount = 1; }
  }
  store.messages.push({ role, message, timestamp: now });
  writeStore({ ...store, messages: store.messages, topic: currentTopic, topicDialogCount });
}

export function clearContext() {
  currentTopic = '';
  topicDialogCount = 0;
  writeStore({ messages: [], topic: '', topicDialogCount: 0, lastActivityAt: Date.now() });
}

export function getContext() {
  return readStore().messages;
}

export default {
  generateResponse, detectFear, extractFearsFromText, detectAlertWords, detectPersonalData,
  setCharacter, getCharacter, addToContext, clearContext, getContext,
  loadChatHistory, setChatChild, buildSystemPrompt, getCurrentTopic,
  shouldSuggestFearGame, getFearGameSuggestion, getChatStorageKey
};
