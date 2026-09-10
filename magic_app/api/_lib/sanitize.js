// ============================================================
// sanitize.js — общая защита от XSS для данных, введённых пользователями
// (P0-2 из аудита безопасности: имя в таблице лидеров, тексты диалогов/чатов,
// email, "поводы обращений" к психологу и т.п.)
//
// Применяется на бэкенде ПЕРЕД сохранением в Redis — так что даже если
// какое-то место на фронтенде забудет экранировать вывод в innerHTML,
// в самих данных уже не будет живой HTML/JS-разметки.
// ============================================================

/**
 * Экранирует HTML-спецсимволы: < > & " ' ` /
 * Безопасно для вставки в innerHTML/атрибуты на фронтенде.
 * @param {*} value
 * @returns {string}
 */
export function sanitizeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/\//g, '&#47;');
}

/**
 * Обрезает строку до maxLength и экранирует HTML.
 * @param {*} value
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitizeText(value, maxLength = 500) {
  const str = value === null || value === undefined ? '' : String(value).trim();
  return sanitizeHTML(str.slice(0, maxLength));
}

/**
 * Проверяет, что строка — безопасная http(s)-ссылка (используется, например,
 * для поля "documents" в заявках психологов/интернатов — раньше туда можно было
 * положить javascript:-схему и получить XSS в момент клика админом по ссылке).
 * @param {*} value
 * @returns {boolean}
 */
export function isSafeHttpUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Возвращает URL, только если он безопасен (http/https), иначе пустую строку.
 * @param {*} value
 * @returns {string}
 */
export function sanitizeUrl(value) {
  return isSafeHttpUrl(value) ? String(value).trim() : '';
}

/**
 * Простая проверка формата email (не заменяет реальную верификацию почты).
 * @param {*} value
 * @returns {boolean}
 */
export function isValidEmailFormat(value) {
  if (!value || typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default { sanitizeHTML, sanitizeText, isSafeHttpUrl, sanitizeUrl, isValidEmailFormat };
