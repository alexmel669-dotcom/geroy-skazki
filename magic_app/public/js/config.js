export const CONFIG = {
  GUEST_INDEX: -1,
  MAX_HISTORY: 50,
  HISTORY_FOR_API: 12,
  SYNC_HISTORY_LENGTH: 20,
  BAD_WORDS: ['мат', 'дурак', 'идиот', 'тупой', 'блин'],
  PIN_SALT: '_lucik_salt_2024',
  DEFAULT_FEAR_STATS: {
    "темноты": 0, 
    "врачей": 0, 
    "одиночества": 0,
    "нового": 0, 
    "обиды": 0, 
    "животных": 0
  },
  MAX_LOCAL_STORAGE_SIZE: 4500000,
  AUDIO_TIMEOUT: 10000,
  API_TIMEOUT: 15000,
  APP_VERSION: '4.0.0'
};

export const CHARACTERS = {
  lucik: { name: 'Люцик', icon: 'assets/images/avatar.png', premium: false, voice: 'alena' },
  mom: { name: 'Мама', icon: 'assets/images/mom.png', premium: true, voice: 'alena' },
  dad: { name: 'Папа', icon: 'assets/images/dad.png', premium: true, voice: 'filipp' },
  kid1: { name: 'Ребёнок 1', icon: 'assets/images/kid1.png', premium: false, voice: 'alena' },
  kid2: { name: 'Ребёнок 2', icon: 'assets/images/kid2.png', premium: false, voice: 'alena' }
};

export const FALLBACK_REPLIES = {
  lucik: "Мурр... Давай ещё раз?",
  mom: "Ой, задумалась... Давай ещё раз, солнышко?",
  dad: "Хм, повтори ещё раз?",
  kid1: "Ой, давай ещё раз!",
  kid2: "Давай ещё раз?"
};

export const FEAR_KEYWORDS = {
  'темноты': ['темно', 'темнота', 'темный', 'тьма', 'ночь', 'выключили'],
  'врачей': ['врач', 'укол', 'больница', 'доктор', 'лечить', 'прививка'],
  'одиночества': ['один', 'одна', 'скучно', 'никого', 'ушел', 'ушла'],
  'обиды': ['обид', 'обидел', 'плачу', 'забрали', 'отобрали'],
  'животных': ['собака', 'собаку', 'животн', 'зверь', 'кошка', 'укусит']
};

export function validateConfig() {
  if (typeof window !== 'undefined') {
    console.log(`🟢 Приложение v${CONFIG.APP_VERSION} загружено`);
    console.log(`📦 Размер хранилища: ${(JSON.stringify(localStorage).length / 1024).toFixed(2)} KB`);
  }
}
