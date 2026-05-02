// api/verify-token.js — Проверка JWT токена (версия от 19 апреля)
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
    
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ valid: false, error: 'Нет токена' });
    }
    
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
        return res.status(500).json({ valid: false, error: 'Ошибка конфигурации' });
    }
    
    try {
        // Гостевой режим
        if (token.startsWith('guest_token_')) {
            return res.status(200).json({ 
                valid: true, 
                user: { userId: 'guest', email: 'guest' } 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        res.status(200).json({ 
            valid: true, 
            user: { 
                userId: decoded.userId, 
                email: decoded.email 
            } 
        });
    } catch (error) {
        res.status(401).json({ valid: false, error: 'Неверный или просроченный токен' });
    }
}
