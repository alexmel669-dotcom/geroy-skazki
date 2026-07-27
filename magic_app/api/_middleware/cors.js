// CORS middleware
export function setCors(req, res) {
  const origin = req.headers.origin || '';
  
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3456',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3456',
    'https://geroy-skazki.ru',
    'https://www.geroy-skazki.ru',
    'https://geroy-skazki.vercel.app',
    'https://geroy-skazki.onrender.com'
  ];

  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL.replace(/\/$/, ''));
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    allowedOrigins.push(process.env.RENDER_EXTERNAL_URL.replace(/\/$/, ''));
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true;
  }

  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (process.env.NODE_ENV === 'production') {
    res.setHeader('Access-Control-Allow-Origin', 'https://geroy-skazki.ru');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  return false;
}