import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: true
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }
        
        if (password.length < 4) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 4 символов' });
        }
        
        const client = await pool.connect();
        try {
            const existing = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase()]
            );
            
            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const result = await client.query(
                'INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, NOW()) RETURNING id, email',
                [email.toLowerCase(), hashedPassword]
            );
            
            const user = result.rows[0];
            
            const token = jwt.sign(
                { userId: user.id, email: user.email }, 
                JWT_SECRET, 
                { expiresIn: '30d' }
            );
            
            res.status(201).json({ 
                success: true, 
                token, 
                email: user.email,
                userId: user.id
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
}
