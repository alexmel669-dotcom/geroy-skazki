// api/verify-token.js
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ valid: false, error: 'Токен отсутствует' });
    const token = authHeader.split(' ')[1];
    if (token && token.startsWith('guest_token_')) return res.status(200).json({ valid: true, guest: true });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.status(200).json({ valid: true, userId: decoded.userId, email: decoded.email });
    } catch (e) {
        res.status(401).json({ valid: false, error: 'Токен недействителен' });
    }
}
