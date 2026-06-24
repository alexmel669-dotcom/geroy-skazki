/** Логирование ошибок auth (аналог /api/log-error на сервере) */
export function logAuthError(context, message, extra = {}) {
  const entry = {
    context,
    message,
    timestamp: new Date().toISOString(),
    appVersion: '4.6.0',
    ...extra
  };
  console.error(`📋 [AUTH ERROR] ${entry.timestamp} | ${context}`);
  console.error(`   ${message}`, extra.details || '');
}

export async function logError(context, message, extra = {}) {
  logAuthError(context, message, extra);
}
