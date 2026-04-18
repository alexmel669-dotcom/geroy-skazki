import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ valid: false, error: 'Нет токена' });
    }
    
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
        console.error('⚠️ JWT_SECRET не настроен в Vercel!');
        return res.status(500).json({ valid: false, error: 'Ошибка конфигурации сервера' });
    }
    
    try {
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
