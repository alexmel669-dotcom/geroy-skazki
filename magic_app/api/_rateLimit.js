const limits = new Map();

// Очистка каждые 5 минут
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, history] of limits) {
    const fresh = history.filter(timestamp => now - timestamp < 60000);
    if (fresh.length === 0) {
      limits.delete(key);
    } else {
      limits.set(key, fresh);
    }
  }
}, 300000);

// Гарантируем, что таймер не блокирует завершение процесса
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    clearInterval(cleanup);
  });
}

export function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const history = limits.get(key) || [];
  const recent = history.filter(timestamp => now - timestamp < windowMs);
  
  if (recent.length >= maxRequests) {
    return false;
  }
  
  recent.push(now);
  limits.set(key, recent);
  return true;
}

export function getRateLimitKey(req) {
  // Используем JWT токен если есть, иначе IP
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return 'user_' + authHeader.replace('Bearer ', '');
  }
  
  // Vercel предоставляет реальный IP через x-forwarded-for
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return 'ip_' + forwarded.split(',')[0].trim();
  }
  
  return 'unknown_' + Date.now();
}
