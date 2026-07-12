// ============================================================
// Worker: geroy-skazki-api2
// Домен: geroy-skazki.ru/*
// Версия: 5.9.1
// ============================================================

function sanitizeEnvValue(value) {
  return String(value || '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

function normalizeRedisUrl(raw) {
  let url = sanitizeEnvValue(raw);
  if (!url) return '';
  url = url.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

function getRedisConfig(env) {
  const url = normalizeRedisUrl(
    env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_URL
  );
  const token = sanitizeEnvValue(
    env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || env.UPSTASH_REDIS_TOKEN
  );
  return { url, token };
}

async function redisGet(env, key) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  let result = data.result;
  if (typeof result === 'string') {
    try { result = JSON.parse(result); } catch {}
  }
  return result;
}

async function redisSet(env, key, value) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  return res.json();
}

async function redisExists(env, key) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/exists/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result === 1;
}

function getJwtSecret(env) {
  const secret = sanitizeEnvValue(env.JWT_SECRET);
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

async function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encoder = new TextEncoder();
  const b64Header = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const b64Payload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const toSign = `${b64Header}.${b64Payload}`;
  
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${b64Header}.${b64Payload}.${b64Sig}`;
}

async function verifyJwt(token, secret) {
  try {
    const [header, payload, sig] = token.split('.');
    const encoder = new TextEncoder();
    const toVerify = `${header}.${payload}`;
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(toVerify));
    if (!valid) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.randomUUID().replace(/-/g, '');
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) {
    return password === stored;
  }
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const computedHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHex === hashHex;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

// ============================================================
// ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    
    // Health check
    if (url.pathname === '/api/health') {
      const cfg = getRedisConfig(env);
      return Response.json({
        ok: true,
        version: '5.9.1',
        worker: true,
        redis: Boolean(cfg.url && cfg.token)
      }, { headers: corsHeaders() });
    }
    
    // ВРЕМЕННЫЙ: сброс пароля админа
    if (url.pathname === '/api/reset-admin' && request.method === 'POST') {
      try {
        const newPassword = 'admintuti13';
        const hashed = await hashPassword(newPassword);
        const user = await redisGet(env, 'geroy:user:admin@geroy-skazki.local');
        if (!user) {
          return Response.json({ error: 'Админ не найден' }, { status: 404, headers: corsHeaders() });
        }
        user.passwordHash = hashed;
        delete user.password;
        await redisSet(env, 'geroy:user:admin@geroy-skazki.local', user);
        return Response.json({ success: true, message: 'Пароль админа сброшен' }, { headers: corsHeaders() });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders() });
      }
    }
    
    // POST /api/login
    if (url.pathname === '/api/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { email, password } = body;
        
        if (!email || !password) {
          return Response.json({ error: 'Email и пароль обязательны' }, { status: 400, headers: corsHeaders() });
        }
        
        const user = await redisGet(env, `geroy:user:${email.toLowerCase()}`);
        if (!user) {
          return Response.json({ error: 'Пользователь не найден' }, { status: 401, headers: corsHeaders() });
        }
        
        const storedPassword = user.passwordHash || user.password;
        const valid = await verifyPassword(password, storedPassword);
        if (!valid) {
          return Response.json({ error: 'Неверный пароль' }, { status: 401, headers: corsHeaders() });
        }
        
        const token = await signJwt({ email: user.email, plan: user.plan || 'free' }, getJwtSecret(env));
        
        return Response.json({ success: true, token, user: { email: user.email, username: user.username, plan: user.plan } }, { headers: corsHeaders() });
      } catch (e) {
        return Response.json({ error: 'Ошибка сервера', detail: e.message }, { status: 500, headers: corsHeaders() });
      }
    }
    
    // POST /api/register
    if (url.pathname === '/api/register' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { email, password, username } = body;
        
        if (!email || !password) {
          return Response.json({ error: 'Email и пароль обязательны' }, { status: 400, headers: corsHeaders() });
        }
        
        const exists = await redisExists(env, `geroy:user:${email.toLowerCase()}`);
        if (exists) {
          return Response.json({ error: 'Пользователь уже существует' }, { status: 409, headers: corsHeaders() });
        }
        
        const hashed = await hashPassword(password);
        const user = {
          email: email.toLowerCase(),
          username: username || email.split('@')[0],
          passwordHash: hashed,
          plan: 'free',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        
        await redisSet(env, `geroy:user:${email.toLowerCase()}`, user);
        
        const users = (await redisGet(env, 'geroy:users')) || {};
        users[email.toLowerCase()] = {
          username: user.username,
          plan: user.plan,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        };
        await redisSet(env, 'geroy:users', users);
        
        const token = await signJwt({ email: user.email, plan: user.plan }, getJwtSecret(env));
        
        return Response.json({ success: true, token, user: { email: user.email, username: user.username, plan: user.plan } }, { headers: corsHeaders() });
      } catch (e) {
        return Response.json({ error: 'Ошибка сервера', detail: e.message }, { status: 500, headers: corsHeaders() });
      }
    }
    
    // Остальные API-запросы — прокси на Vercel
    if (url.pathname.startsWith('/api/')) {
      const vercelUrl = 'https://geroy-skazki.vercel.app' + url.pathname + url.search;
      try {
        const res = await fetch(vercelUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        const headers = new Headers(res.headers);
        Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
        return new Response(res.body, { status: res.status, headers });
      } catch (e) {
        return Response.json({ error: 'Vercel недоступен', detail: e.message }, { status: 502, headers: corsHeaders() });
      }
    }
    
    // Статика — Cloudflare Pages (явно index.html для корня, без редиректа)
    const assetUrl = new URL(request.url);
    if (assetUrl.pathname === '/' || assetUrl.pathname === '') {
      assetUrl.pathname = '/index.html';
    }
    return fetch(new Request(assetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      redirect: 'follow'
    }));
  }
};