// Голосовое переключение персонажей и профилей

const PERSONA_TRIGGERS = {
  'люцик': 'lucik',
  'люцика': 'lucik',
  'кот': 'lucik',
  'котик': 'lucik',
  'мама': 'mom',
  'маму': 'mom',
  'маме': 'mom',
  'папа': 'dad',
  'папу': 'dad',
  'папе': 'dad',
  'мия': 'kid1',
  'мию': 'kid1',
  'макс': 'kid2',
  'макса': 'kid2'
};

const NAME_PATTERNS = [
  /я ([а-яёa-z]+)/i,           // "я Лиза"
  /меня зовут ([а-яёa-z]+)/i,  // "меня зовут Лиза"
  /это ([а-яёa-z]+)/i          // "это Лиза"
];

/**
 * Проверить текст на команды переключения
 * @param {string} text - распознанный текст
 * @param {object[]} children - список детей [{name, ...}]
 * @returns {object|null} - {action: 'switch_character', value: 'lucik'} или {action: 'switch_child', value: 'Лиза'} или null
 */
export function detectVoiceCommand(text, children = []) {
  if (!text) return null;

  const lower = text.toLowerCase().trim();

  // Проверяем переключение персонажа
  for (const [trigger, character] of Object.entries(PERSONA_TRIGGERS)) {
    if (lower.includes(trigger)) {
      return { action: 'switch_character', value: character };
    }
  }

  // Проверяем переключение ребёнка
  for (const pattern of NAME_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      const name = match[1].toLowerCase();
      const index = children.findIndex((c) => c.name?.toLowerCase() === name);
      if (index >= 0) {
        return { action: 'switch_child', value: children[index].name, index };
      }
      // Если имя не найдено — всё равно пробуем переключить
      return { action: 'switch_child', value: name, index: -1 };
    }
  }

  return null;
}
