// P0-1 fix: убран хардкод-дефолт 'admin-token-v5.0.5' — он был закоммичен в открытый
// репозиторий, и любой, кто читал код, получал полный доступ к админ-эндпоинтам.
// Теперь без ADMIN_API_TOKEN в окружении токен не выдаётся вообще (см. также
// проверку при старте сервера в magic_app/server.js).
export function getAdminApiToken() {
  const raw = process.env.ADMIN_API_TOKEN?.trim();
  if (!raw) {
    console.error('[admin-token] ADMIN_API_TOKEN не задан в окружении — админ-доступ отключён.');
    return null;
  }
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
}

export function isValidAdminToken(req) {
  const expected = getAdminApiToken();
  if (!expected) return false; // ADMIN_API_TOKEN не настроен — доступ запрещён по умолчанию
  const auth = req.headers.authorization || '';
  return auth === expected;
}
