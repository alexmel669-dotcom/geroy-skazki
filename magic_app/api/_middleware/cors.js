export function setCors(req, res) {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'https://geroy-skazki.vercel.app'
  ];

  if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }

  let origin = allowedOrigins[0];
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    origin = requestOrigin;
  } else if (requestOrigin && requestOrigin.endsWith('.vercel.app')) {
    origin = requestOrigin;
  } else if (process.env.NODE_ENV === 'production') {
    origin = 'https://geroy-skazki.vercel.app';
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
