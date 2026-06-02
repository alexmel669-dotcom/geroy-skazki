import { getCurrentChild } from './core.js';

// Очередь событий для отправки
let eventQueue = [];
let isSending = false;
const MAX_QUEUE_SIZE = 50;
const FLUSH_INTERVAL = 30000; // 30 секунд

export function sendAnalytics(eventType, eventData = {}) {
  // Получаем ID пользователя
  const userId = getUserId();
  const child = getCurrentChild();
  
  // Создаем событие
  const event = {
    event_type: eventType,
    user_id: userId,
    child_name: child.isGuest ? 'guest' : child.name,
    child_age: child.isGuest ? null : child.age,
    event_data: {
      ...eventData,
      timestamp: new Date().toISOString(),
      url: window.location.pathname,
      app_version: localStorage.getItem('appVersion') || 'unknown'
    }
  };
  
  // Добавляем в очередь
  eventQueue.push(event);
  
  // Ограничиваем размер очереди
  if (eventQueue.length > MAX_QUEUE_SIZE) {
    eventQueue = eventQueue.slice(-MAX_QUEUE_SIZE);
  }
  
  // Отправляем если накопилось достаточно или важное событие
  if (eventQueue.length >= 5 || isImportantEvent(eventType)) {
    flushAnalytics();
  }
}

function isImportantEvent(eventType) {
  return [
    'app_open', 'app_close', 'login', 'register', 'logout',
    'payment_initiated', 'payment_completed', 'error'
  ].includes(eventType);
}

async function flushAnalytics() {
  if (isSending || eventQueue.length === 0) return;
  
  isSending = true;
  const events = [...eventQueue];
  eventQueue = [];
  
  try {
    const response = await fetch('/api/analytics', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    });
    
    if (!response.ok) {
      // Возвращаем события в очередь при ошибке
      eventQueue.unshift(...events);
      console.warn('Analytics send failed:', response.status);
    }
  } catch (error) {
    // Возвращаем события в очередь
    eventQueue.unshift(...events);
    console.warn('Analytics send error:', error.message);
  } finally {
    isSending = false;
  }
}

function getUserId() {
  const guestMode = localStorage.getItem('guestMode') === 'true';
  
  if (guestMode) {
    let guestId = localStorage.getItem('guestId');
    if (!guestId) {
      guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('guestId', guestId);
    }
    return guestId;
  }
  
  const userEmail = localStorage.getItem('userEmail');
  if (userEmail) {
    return userEmail;
  }
  
  // Пытаемся извлечь из JWT токена
  try {
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
    
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.email || 'unknown';
    }
  } catch (e) {
    // Игнорируем
  }
  
  return 'unknown';
}

// Периодическая отправка
if (typeof window !== 'undefined') {
  setInterval(flushAnalytics, FLUSH_INTERVAL);
  
  // Отправка при уходе со страницы
  window.addEventListener('beforeunload', () => {
    sendAnalytics('app_close');
    // Синхронная отправка через sendBeacon
    const events = [...eventQueue];
    if (events.length > 0) {
      const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics', blob);
    }
  });
  
  // Отправка при скрытии страницы
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAnalytics();
    }
    if (document.visibilityState === 'visible') {
      sendAnalytics('app_resumed');
    }
  });
}
