// ============================================================
// api-base.js — единая точка для API_BASE и apiFetch
// ============================================================
//
// В Capacitor WebView (APK): window.location = https://localhost
//   → API на прод-сервере: https://geroy-skazki.ru
//
// В браузере на ПК (dev): window.location = http://localhost:3000
//   → API на том же origin: http://localhost:3000
//
// В браузере на проде: window.location = https://geroy-skazki.ru
//   → API на том же origin: https://geroy-skazki.ru
//
// Можно переопределить через ?api=https://custom.example.com
// ============================================================

export const API_BASE = (() => {
  if (typeof window === 'undefined') return '';

  // 1. Явное переопределение через ?api=...
  if (window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('api');
    if (override) return override.replace(/\/$/, '');
  }

  // 2. Capacitor WebView — API на прод-сервере
  const isCapacitor =
    window.location.protocol === 'capacitor:' ||
    (typeof navigator !== 'undefined' &&
      navigator.userAgent &&
      (navigator.userAgent.includes('Capacitor') ||
        (navigator.userAgent.includes('Android') && navigator.userAgent.includes('wv'))));

  if (isCapacitor) return 'https://geroy-skazki.ru';

  // 3. Обычный браузер — API на текущем origin
  return window.location.origin;
})();

// Хелпер: fetch с автоматическим добавлением API_BASE
// Если path начинается с 'http://' или 'https://' — оставляем как есть
export function apiFetch(path, options = {}) {
  const url = /^https?:\/\//.test(path) ? path : API_BASE + path;
  return fetch(url, options);
}

// Хелпер: собрать полный URL (например, для аудио-плеера)
export function apiUrl(path) {
  return /^https?:\/\//.test(path) ? path : API_BASE + path;
}

// ============================================================
// Глобальные ссылки для не-ES-модулей (leaderboard.js, admin-dashboard.js и т.д.)
// После импорта api-base.js эти ссылки доступны как window.apiFetch / apiFetch
// ============================================================
if (typeof window !== 'undefined') {
  window.API_BASE = API_BASE;
  window.apiFetch = apiFetch;
  window.apiUrl = apiUrl;
}
