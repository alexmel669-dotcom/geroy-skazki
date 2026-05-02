// api/admin-login.js
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    const { password } = req.body;
    
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return res.status(401).json({ error: 'Неверный пароль' });
    }
    
    const token = jwt.sign(
        { role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
    
    res.status(200).json({ token });
}
