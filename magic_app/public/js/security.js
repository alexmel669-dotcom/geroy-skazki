import { CONFIG } from './config.js';

// Санитизация пользовательского ввода
export function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Удаляем HTML теги и опасные символы
  let cleaned = text
    .replace(/<[^>]*>/g, '') // HTML теги
    .replace(/[<>]/g, '')     // Оставшиеся скобки
    .replace(/javascript:/gi, '') // JavaScript протокол
    .replace(/on\w+=/gi, '')  // Обработчики событий
    .trim();
  
  // Ограничиваем длину
  if (cleaned.length > 500) {
    cleaned = cleaned.substring(0, 500);
  }
  
  return cleaned;
}

// Проверка на запрещенные слова
export function containsBadWords(text) {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  return CONFIG.BAD_WORDS.some(word => {
    // Проверяем целые слова, а не подстроки
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });
}

// Хеширование PIN-кода
export async function hashPin(pin) {
  if (!pin || typeof pin !== 'string') {
    throw new Error('PIN must be a string');
  }
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + CONFIG.PIN_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Hash error:', error);
    // Fallback для окружений без crypto.subtle
    return simpleHash(pin + CONFIG.PIN_SALT);
  }
}

// Простой fallback хеш
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Конвертируем в 32-битное целое
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Проверка PIN-кода
export async function verifyPin(inputPin) {
  if (!inputPin || typeof inputPin !== 'string') {
    return false;
  }
  
  const storedHash = localStorage.getItem('parentPinHash');
  if (!storedHash) {
    console.log('PIN not set');
    return false;
  }
  
  try {
    const inputHash = await hashPin(inputPin);
    return storedHash === inputHash;
  } catch (error) {
    console.error('PIN verification error:', error);
    return false;
  }
}

// Создание PIN-кода
export async function createPin(pin) {
  if (!pin || pin.length < 4 || pin.length > 6) {
    throw new Error('PIN must be 4-6 characters');
  }
  
  if (!/^\d+$/.test(pin)) {
    throw new Error('PIN must contain only digits');
  }
  
  try {
    const hash = await hashPin(pin);
    localStorage.setItem('parentPinHash', hash);
    console.log('✅ PIN created successfully');
    return true;
  } catch (error) {
    console.error('Failed to create PIN:', error);
    throw error;
  }
}

// Изменение PIN-кода
export async function changePin(oldPin, newPin) {
  const isOldPinValid = await verifyPin(oldPin);
  if (!isOldPinValid) {
    throw new Error('Неверный старый PIN-код');
  }
  
  return await createPin(newPin);
}

// Проверка сложности пароля (для будущего использования)
export function checkPasswordStrength(password) {
  if (!password) return { score: 0, message: 'Пароль пустой' };
  
  let score = 0;
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-ZА-Я]/.test(password),
    lowercase: /[a-zа-я]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  score = Object.values(checks).filter(Boolean).length;
  
  const messages = {
    0: 'Очень слабый',
    1: 'Слабый',
    2: 'Средний',
    3: 'Хороший',
    4: 'Сильный',
    5: 'Очень сильный'
  };
  
  return {
    score,
    message: messages[score] || 'Неизвестно',
    checks
  };
}

// Очистка чувствительных данных
export function clearSensitiveData() {
  localStorage.removeItem('parentPinHash');
  localStorage.removeItem('userEmail');
  console.log('🔒 Чувствительные данные очищены');
}

// Экспорт для тестирования
if (typeof window !== 'undefined') {
  window.__security = {
    sanitizeInput,
    containsBadWords,
    hashPin,
    verifyPin,
    createPin
  };
}
