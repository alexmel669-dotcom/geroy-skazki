import { setCors } from '../_middleware/cors.js';
import { getAdminApiToken } from '../_lib/admin-token.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';

// P0-1 fix: убраны хардкод-дефолты 'admin@geroy-skazki.local' / 'admintuti13' — они были
// закоммичены в открытый репозиторий. Теперь без ADMIN_EMAIL/ADMIN_PASSWORD в окружении
// вход в админку невозможен ни для кого (см. проверку при старте сервера в server.js).
function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim() || null;
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = `admin-login:${getRateLimitKey(req)}`;
  if (!checkRateLimit(key, 5, 300000)) {
    return res.status(429).json({ error: 'Too many attempts' });
  }

  const adminEmail = getAdminEmail();
  const adminPassword = getAdminPassword();
  const adminToken = getAdminApiToken();
  if (!adminEmail || !adminPassword || !adminToken) {
    console.error('[admin-login] ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_API_TOKEN не настроены — вход отключён.');
    return res.status(503).json({ error: 'Админ-панель не настроена' });
  }

  const { email, password } = req.body || {};
  if (email === adminEmail && password === adminPassword) {
    return res.status(200).json({ success: true, token: adminToken });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}
