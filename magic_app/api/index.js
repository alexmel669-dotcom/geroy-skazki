// api/index.js — роутер: verify-token, parent-advice, save-stats, get-stats
import jwt from 'jsonwebtoken';
import { Pool } from '@neondatabase/serverless';

const JWT_SECRET = process.env.JWT_SECRET || 'hero-skazki-secret-key';
const ADMIN_EMAIL = 'alexmel669@gmail.com';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://geroy-skazki.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (token.startsWith('guest_token_')) return { email: 'guest', role: 'guest' };
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';

  try {
    // ========== VERIFY TOKEN ==========
    if (url.includes('verify')) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
      
      const user = getUserFromToken(req.headers.authorization);
      if (!user) {
        return res.status(401).json({ valid: false, error: 'Неверный токен' });
      }
      
      return res.status(200).json({ 
        valid: true, 
        email: user.email, 
        role: user.role || 'user' 
      });
    }

    // ========== PARENT ADVICE (2 URL: /api/index/advice и /api/parent-advice) ==========
    if (url.includes('advice')) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
      
      const { fear, childAge, childName } = req.body;
      
      if (!fear || fear.trim().length === 0) {
        return res.status(400).json({ error: 'Укажите страх ребёнка' });
      }

      const age = parseInt(childAge) || 5;
      const name = childName || 'малыш';

      const prompt = `Ты — детский психолог. Родитель ребёнка ${name} (${age} лет) обращается за помощью. Ребёнок боится: "${fear}".
Дай родителю практический, тёплый ответ. Используй структуру:
1. КАК НАЧАТЬ РАЗГОВОР: (2-3 мягкие фразы)
2. ЧЕГО НЕЛЬЗЯ ГОВОРИТЬ: (2-3 фразы)
3. ИГРЫ И УПРАЖНЕНИЯ: (2-3 конкретных задания)
4. КОГДА НУЖЕН СПЕЦИАЛИСТ: (чёткие признаки)
Отвечай тёплым тоном. Пиши на русском.`;

      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekKey) {
        return res.status(500).json({ error: 'API ключ DeepSeek не настроен' });
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'Ты — добрый детский психолог. Отвечай структурированно, тепло.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('DeepSeek error:', response.status, errText);
        return res.status(500).json({ 
          error: 'Ошибка генерации совета',
          advice: '🌙 Попробуйте обнять ребёнка и сказать: "Я рядом, мы справимся вместе".'
        });
      }

      const data = await response.json();
      const advice = data.choices[0].message.content;

      return res.status(200).json({ advice, fear });
    }

    // ========== SAVE STATS ==========
    if (url.includes('save-stats') || url.includes('stats')) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
      
      const user = getUserFromToken(req.headers.authorization);
      const { event_type, child_name, event_data } = req.body;

      if (!event_type) {
        return res.status(400).json({ error: 'Нет event_type' });
      }

      // Сохраняем в БД если есть подключение
      if (process.env.POSTGRES_URL) {
        try {
          const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
          await pool.query(
            'INSERT INTO analytics (event_type, user_email, child_name, event_data) VALUES ($1, $2, $3, $4)',
            [
              event_type, 
              user?.email || 'guest', 
              child_name || 'малыш', 
              JSON.stringify(event_data || {})
            ]
          );
          await pool.end();
        } catch (dbError) {
          console.error('DB save error:', dbError);
        }
      }

      return res.status(200).json({ success: true });
    }

    // ========== GET STATS (ADMIN ONLY) ==========
    if (url.includes('admin') || url.includes('get-stats')) {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Метод не поддерживается' });
      
      const user = getUserFromToken(req.headers.authorization);
      
      if (!user || user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }

      if (!process.env.POSTGRES_URL) {
        return res.status(500).json({ error: 'База данных не подключена' });
      }

      const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

      try {
        const [usersResult, storiesResult, fearsResult, todayResult, topFearsResult, recentResult] = await Promise.all([
          pool.query('SELECT COUNT(*) as count FROM users'),
          pool.query("SELECT COUNT(*) as count FROM analytics WHERE event_type = 'story'"),
          pool.query("SELECT COUNT(*) as count FROM analytics WHERE event_type = 'fear_detected'"),
          pool.query("SELECT COUNT(*) as count FROM analytics WHERE event_type = 'story' AND created_at::date = CURRENT_DATE"),
          pool.query("SELECT event_data->>'fear' as fear, COUNT(*) as count FROM analytics WHERE event_type = 'fear_detected' GROUP BY fear ORDER BY count DESC LIMIT 10"),
          pool.query('SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 10')
        ]);

        await pool.end();

        return res.status(200).json({
          totalUsers: parseInt(usersResult.rows[0].count),
          totalStories: parseInt(storiesResult.rows[0].count),
          totalFears: parseInt(fearsResult.rows[0].count),
          todayStories: parseInt(todayResult.rows[0].count),
          topFears: topFearsResult.rows,
          recentUsers: recentResult.rows
        });
      } catch (dbError) {
        await pool.end();
        throw dbError;
      }
    }

    // ========== 404 ==========
    return res.status(404).json({ 
      error: 'Неизвестный запрос',
      available: ['verify', 'advice', 'save-stats', 'get-stats']
    });

  } catch (error) {
    console.error('API Index Error:', error);
    
    if (url.includes('advice')) {
      return res.status(500).json({ 
        error: 'Сервер временно недоступен',
        advice: '🌙 Попробуйте обнять ребёнка и сказать: "Я рядом, мы справимся вместе".'
      });
    }
    
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
