export const CONFIG = {
  GUEST_INDEX: -1,
  MAX_HISTORY: 50,
  HISTORY_FOR_API: 12,
  SYNC_HISTORY_LENGTH: 20,
  BAD_WORDS: ['мат', 'дурак', 'идиот', 'тупой', 'блин'],
  ALERT_KEYWORDS: ['страшно', 'боюсь', 'плохо', 'плачу', 'помоги', 'один', 'ушёл', 'ушла', 'больно', 'убьют'],
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
  AUDIO_TIMEOUT: 15000,
  API_TIMEOUT: 15000,
  APP_VERSION: '4.0.1'
};

export const CHARACTERS = {
  lucik: { name: 'Люцик', icon: 'assets/images/avatar.png', premium: false, voice: 'zahar', role: 'сказочный кот-помощник' },
  mom: { name: 'Мама', icon: 'assets/images/mom.png', premium: true, voice: 'jane', role: 'заботливая мама' },
  dad: { name: 'Папа', icon: 'assets/images/dad.png', premium: true, voice: 'ermil', role: 'уверенный папа' },
  kid1: { name: 'Ребёнок 1', icon: 'assets/images/kid1.png', premium: false, voice: 'oksana', role: 'друг-сверстник' },
  kid2: { name: 'Ребёнок 2', icon: 'assets/images/kid2.png', premium: false, voice: 'oksana', role: 'друг-сверстник' }
};

export const FALLBACK_REPLIES = {
  lucik: "Мурр... Давай ещё раз?",
  mom: "Ой, задумалась... Давай ещё раз, солнышко?",
  dad: "Хм, повтори ещё раз?",
  kid1: "Ой, давай ещё раз!",
  kid2: "Давай ещё раз?"
};

export const FEAR_KEYWORDS = {
  'темноты': ['темно', 'темнота', 'темный', 'тьма', 'ночь', 'выключили', 'не вижу'],
  'врачей': ['врач', 'укол', 'больница', 'доктор', 'лечить', 'прививка', 'лекарств'],
  'одиночества': ['один', 'одна', 'скучно', 'никого', 'ушел', 'ушла', 'скучаю', 'бросил'],
  'обиды': ['обид', 'обидел', 'плачу', 'забрали', 'отобрали', 'не дал', 'жалко'],
  'животных': ['собака', 'собаку', 'животн', 'зверь', 'кошка', 'укусит', 'укусил'],
  'нового': ['новое', 'не знаю', 'первый раз', 'страшно новое', 'непривычно']
};

export function validateConfig() {
  if (typeof window !== 'undefined') {
    console.log(`🟢 Приложение v${CONFIG.APP_VERSION} загружено`);
  }
}
