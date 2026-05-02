// api/admin-login.js
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!password || password !== adminPassword) {
        // Небольшая задержка для защиты от брутфорса
        await new Promise(resolve => setTimeout(resolve, 1000));
        return res.status(401).json({ error: 'Неверный пароль' });
    }
    
    // Создаём JWT токен на 8 часов
    const token = jwt.sign(
        { role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
    
    return res.status(200).json({ token });
}
