// api/index.js — единый роутер (Hobby-план: макс 12 функций)
import jwt from 'jsonwebtoken';
import { Pool } from '@neondatabase/serverless';

const JWT_SECRET = process.env.JWT_SECRET || 'hero-skazki-secret-key';
const ADMIN_EMAIL = 'alexmel669@gmail.com';

const VOICE_MAP = {
  lucik: 'zahar', mom: 'jane', dad: 'ermil', kid1: 'alena', kid2: 'filipp'
};

// ========== CORS ==========
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://geroy-skazki.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ========== ТОКЕН ==========
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

// ========== DeepSeek ==========
const SYSTEM_PROMPT = `Ты Люцик — дружелюбный волшебный кот-психолог...`; // полный промпт как раньше

const FEAR_KEYWORDS = {
  'темноты': ['темно', 'темнота', 'ночь', 'страшно спать', 'свет', 'монстр'],
  'врачей': ['врач', 'укол', 'больница', 'доктор', 'лечить', 'прививка'],
  'одиночества': ['один', 'скучно', 'никого', 'бросили', 'уходят'],
  'обиды': ['обидно', 'обидел', 'поругали', 'кричат'],
  'нового': ['новое', 'незнакомое', 'первый раз'],
  'животных': ['собака', 'животное', 'укусит', 'зверь', 'паук']
};

function detectFear(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [fear, keywords] of Object.entries(FEAR_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return fear;
  }
  return null;
}

// ========== ГЛАВНЫЙ РОУТЕР ==========
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const action = url.split('?')[0].replace('/api/', '');

  try {
    // ========== РЕГИСТРАЦИЯ ==========
    if (action === 'register' && req.method === 'POST') {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });
      if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
      if (!email.includes('@')) return res.status(400).json({ error: 'Некорректный email' });

      if (email === ADMIN_EMAIL) {
        const token = jwt.sign({ email, role: 'developer' }, JWT_SECRET, { expiresIn: '30d' });
        return res.status(200).json({ token, email });
      }

      const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        await pool.end();
        return res.status(409).json({ error: 'Уже зарегистрирован. Войдите.' });
      }
      await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email, password]);
      await pool.end();

      const token = jwt.sign({ email, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({ token, email });
    }

    // ========== ВХОД ==========
    if (action === 'login' && req.method === 'POST') {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Введите email и пароль' });

      if (email === ADMIN_EMAIL) {
        const token = jwt.sign({ email, role: 'developer' }, JWT_SECRET, { expiresIn: '30d' });
        return res.status(200).json({ token, email });
      }

      const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        await pool.end();
        return res.status(401).json({ error: 'Не найден. Зарегистрируйтесь.' });
      }
      if (result.rows[0].password_hash !== password) {
        await pool.end();
        return res.status(401).json({ error: 'Неверный пароль' });
      }
      await pool.end();

      const token = jwt.sign({ email, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({ token, email });
    }

    // ========== ПРОВЕРКА ТОКЕНА ==========
    if (action === 'verify-token' && req.method === 'POST') {
      const user = getUserFromToken(req.headers.authorization);
      if (!user) return res.status(401).json({ valid: false, error: 'Неверный токен' });
      return res.status(200).json({ valid: true, email: user.email, role: user.role });
    }

    // ========== TTS (озвучка) ==========
    if (action === 'tts' && req.method === 'POST') {
      const { text, voice = 'lucik', speed = 0.9 } = req.body;
      if (!text) return res.status(400).json({ error: 'Нет текста' });

      const yandexVoice = VOICE_MAP[voice] || 'zahar';
      const cleanText = text.replace(/[^\w\s\.,!?\-а-яА-ЯёЁ]/g, '').substring(0, 500);
      
      const params = new URLSearchParams();
      params.append('text', cleanText);
      params.append('voice', yandexVoice);
      params.append('format', 'mp3');
      params.append('sampleRateHertz', '48000');
      params.append('speed', speed.toString());

      const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
        method: 'POST',
        headers: { 'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}` },
        body: params.toString()
      });

      if (!response.ok) return res.status(500).json({ error: 'Ошибка синтеза' });
      
      const audioBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.status(200).send(Buffer.from(audioBuffer));
    }

    // ========== ГЕНЕРАЦИЯ СКАЗКИ ==========
    if (action === 'generate' && req.method === 'POST') {
      const { childName, childAge, userSpeech, isLong, history, systemPrompt } = req.body;
      if (!userSpeech) return res.status(400).json({ error: 'Нет сообщения' });

      const detectedFear = detectFear(userSpeech);
      const messages = [
        { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
        ...(history || []).slice(-6),
        { role: 'user', content: userSpeech }
      ];
      if (isLong) {
        messages.push({ role: 'system', content: 'Расскажи длинную сказку на ночь.' });
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7, max_tokens: isLong ? 800 : 300 })
      });

      if (!response.ok) return res.status(500).json({ error: 'Ошибка генерации' });
      
      const data = await response.json();
      return res.status(200).json({ story: data.choices[0].message.content, detectedFear });
    }

    // ========== СОВЕТ ПСИХОЛОГА ==========
    if (action === 'parent-advice' && req.method === 'POST') {
      const { fear, childAge, childName } = req.body;
      const prompt = `Ты детский психолог. Ребёнок ${childName}, ${childAge} лет, боится: "${fear}". Дай совет родителю.`;

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 600 })
      });

      const data = await response.json();
      return res.status(200).json({ advice: data.choices[0].message.content });
    }

    // ========== СОХРАНЕНИЕ СТАТИСТИКИ ==========
    if (action === 'save-stats' && req.method === 'POST') {
      const user = getUserFromToken(req.headers.authorization);
      const { event_type, child_name, event_data } = req.body;

      const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
      await pool.query(
        'INSERT INTO analytics (event_type, user_email, child_name, event_data) VALUES ($1, $2, $3, $4)',
        [event_type, user?.email || 'guest', child_name || 'малыш', JSON.stringify(event_data || {})]
      );
      await pool.end();
      return res.status(200).json({ success: true });
    }

    // ========== ПОЛУЧЕНИЕ СТАТИСТИКИ (АДМИН) ==========
    if (action === 'get-stats' && req.method === 'GET') {
      const user = getUserFromToken(req.headers.authorization);
      if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Доступ запрещён' });

      const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
      const [users, stories, fears, today, topFears, recent] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM users'),
        pool.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'story'"),
        pool.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'fear_detected'"),
        pool.query("SELECT COUNT(*) FROM analytics WHERE event_type = 'story' AND created_at::date = CURRENT_DATE"),
        pool.query("SELECT event_data->>'fear' as fear, COUNT(*) FROM analytics WHERE event_type = 'fear_detected' GROUP BY fear ORDER BY COUNT(*) DESC LIMIT 10"),
        pool.query('SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 10')
      ]);
      await pool.end();

      return res.status(200).json({
        totalUsers: users.rows[0].count,
        totalStories: stories.rows[0].count,
        totalFears: fears.rows[0].count,
        todayStories: today.rows[0].count,
        topFears: topFears.rows,
        recentUsers: recent.rows
      });
    }

    // ========== НЕИЗВЕСТНЫЙ ACTION ==========
    return res.status(404).json({ error: 'Неизвестный запрос' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка' });
  }
}
