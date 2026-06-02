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
  return req.headers.authorization?.replace('Bearer ', '') || 
         req.headers['x-forwarded-for'] || 'unknown';
}
