const limits = new Map();

const RATE_LIMITS = {
  guest: { generate: 5, stt: 6, tts: 10 },
  auth: { generate: 15, stt: 15, tts: 25 }
};

function getClientId(req) {
  const authHeader = req.headers?.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = req.cookies?.token || bearer;
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload.email) return `auth:${payload.email}`;
    } catch {
      /* ignore */
    }
  }
  const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers?.['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
  return `ip:${ip}`;
}

export function checkRateLimit(req, type = 'generate') {
  const clientId = getClientId(req);
  const isAuth = clientId.startsWith('auth:');
  const tier = isAuth ? 'auth' : 'guest';
  const maxRequests = RATE_LIMITS[tier]?.[type] || 10;
  const now = Date.now();
  const windowMs = 60000;
  const key = `${clientId}:${type}`;

  if (!limits.has(key)) limits.set(key, []);
  const timestamps = limits.get(key).filter((t) => now - t < windowMs);
  limits.set(key, timestamps);

  if (timestamps.length >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000)
    };
  }

  timestamps.push(now);
  return { allowed: true };
}

/** @deprecated use checkRateLimit — kept for gradual migration */
export function applyAiRateLimit(req, res, { authMax, anonMax, windowMs = 60000 }) {
  const type = req.apiRoute === 'tts' ? 'tts' : req.apiRoute === 'speech-to-text' ? 'stt' : 'generate';
  const check = checkRateLimit(req, type);
  if (!check.allowed) {
    res.status(429).json({
      error: 'Слишком много запросов',
      retryAfter: check.retryAfter
    });
    return { allowed: false };
  }
  return { allowed: true };
}

export default { checkRateLimit, applyAiRateLimit };
