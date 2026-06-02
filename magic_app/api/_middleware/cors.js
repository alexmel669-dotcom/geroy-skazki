export function setCors(req, res) {
  const origin = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : 'https://geroy-skazki.vercel.app';
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
