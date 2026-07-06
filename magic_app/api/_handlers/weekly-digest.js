import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser, getWeeklyStats } from '../_lib/users.js';

async function sendViaResend({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, reason: 'RESEND_API_KEY not set' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Люцик <lucik.geroy.skazki@gmail.com>',
      to: [to],
      subject,
      html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, reason: err };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const decoded = verifyAuth(req);
  if (!decoded?.email) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const user = await findUser(decoded.email);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const weekStats = await getWeeklyStats(decoded.email);
    const childName = user.children?.[user.activeChildIndex ?? 0]?.name
      || user.children?.[0]?.name
      || user.childName
      || 'ребёнок';
    const parentName = user.parentName || user.username || 'родитель';

    const html = `
      <h2>Привет, ${parentName}!</h2>
      <p>Вот как прошла неделя у ${childName}:</p>
      <ul>
        <li>🗣️ Разговоров: ${weekStats.totalChats}</li>
        <li>🌙 Сказок: ${weekStats.totalStories}</li>
        <li>😊 Настроение: ${weekStats.moodSummary}</li>
        <li>⭐ Звёзд заработано: ${weekStats.stars}</li>
      </ul>
      <p><a href="https://geroy-skazki.vercel.app/parent.html">Открыть родительский кабинет</a></p>
    `;

    const sent = await sendViaResend({
      to: user.email,
      subject: `${parentName}, отчёт за неделю для ${childName}`,
      html
    });

    if (!sent.ok) {
      return res.status(503).json({ error: 'Email не отправлен', reason: sent.reason });
    }

    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error('weekly-digest error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
