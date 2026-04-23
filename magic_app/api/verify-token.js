// api/verify-token.js — проверка токена
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  const allowedOrigins = ['https://geroy-skazki.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Токен не предоставлен' });
    }

    const token = authHeader.split(' ')[1];

    // Гостевые токены
    if (token.startsWith('guest_token_')) {
      return res.status(200).json({ 
        valid: true, 
        email: 'guest', 
        role: 'guest' 
      });
    }

    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
      return res.status(200).json({ 
        valid: true, 
        email: 'dev', 
        role: 'developer' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.status(200).json({ 
      valid: true, 
      email: decoded.email, 
      role: decoded.role || 'user' 
    });

  } catch (error) {
    res.status(401).json({ 
      valid: false, 
      error: 'Токен недействителен или истёк' 
    });
  }
}
