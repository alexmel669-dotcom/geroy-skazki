import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser } from '../_lib/users.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const profile = await findUser(user.email);
    const concerns = req.body?.concerns || profile?.concerns || [];
    const childAge = req.body?.childAge ?? profile?.childAge ?? 7;

    if (!concerns.length) {
      return res.status(400).json({ error: 'No concerns to analyze' });
    }

    const topics = concerns.join(', ');

    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(200).json({
        advice: `Темы, которые волнуют ребёнка: ${topics}.\n\nРекомендации:\n• Начните разговор через сказку или игру, не напрямую.\n• Спросите: «А как бы ты поступил на месте героя?»\n• Избегайте слов «страх», «проблема», «тревога».\n• Завершите разговор чем-то тёплым и спокойным.`,
        devMode: true
      });
    }

    const systemPrompt = `Ты — деликатный детский психолог-консультант для родителей.
Родитель получил от ИИ-помощника информацию о возможных беспокойствах ребёнка.
Темы: ${topics}
Возраст ребёнка: ${childAge} лет.

Составь МЯГКИЕ, ДЕЛИКАТНЫЕ рекомендации для родителя:
- Как начать разговор
- Какие вопросы задать (не напрямую)
- Какие сказки/истории рассказать
- Чего избегать в разговоре

НЕ используй пугающих формулировок. Тон — поддерживающий, спокойный.
Ответ на русском, структурируй абзацами.`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Составь рекомендации для родителя.' }],
        max_tokens: 600,
        temperature: 0.7
      })
    });

    if (!response.ok) throw new Error(`DeepSeek: ${response.status}`);
    const data = await response.json();
    const advice = data.choices?.[0]?.message?.content;
    if (!advice) throw new Error('Empty response');

    return res.status(200).json({ success: true, advice });
  } catch (error) {
    console.error('Psychologist help error:', error);
    return res.status(500).json({ error: 'Не удалось получить рекомендации' });
  }
}
