const limits = new Map();

export function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const history = limits.get(key) || [];
  const recent = history.filter(t => now - t < windowMs);

  if (recent.length >= maxRequests) return false;

  recent.push(now);
  limits.set(key, recent);
  return true;
}

export function getRateLimitKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  if (req.headers['x-real-ip']) return req.headers['x-real-ip'];
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || 'no-ua';
  return `anon-${ua.slice(0, 64)}`;
}
