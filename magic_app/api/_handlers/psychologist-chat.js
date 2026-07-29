import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import {
  getQuery,
  requirePsychologist,
  chatKey,
  redis
} from '../_lib/psychologist-access.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function touchChatIndex(psychologistEmail, parentEmail, parentName, lastMessage) {
  const key = `geroy:psychologist:${psychologistEmail}:chats`;
  const chats = asArray(await redis.get(key));
  const idx = chats.findIndex((c) => String(c.parentEmail || '').toLowerCase() === parentEmail);
  const entry = {
    parentEmail,
    parentName: parentName || (idx >= 0 ? chats[idx].parentName : parentEmail),
    status: 'active',
    lastMessage: lastMessage ? String(lastMessage).slice(0, 120) : (idx >= 0 ? chats[idx].lastMessage : ''),
    updatedAt: new Date().toISOString()
  };
  if (idx >= 0) chats[idx] = { ...chats[idx], ...entry };
  else chats.push(entry);
  chats.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  await redis.set(key, chats.slice(-100));
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  try {
    const auth = verifyAuth(req);
    if (!auth?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      const query = getQuery(req);
      const psychologistEmail = String(query.psychologistEmail || '').trim().toLowerCase();
      const parentEmail = String(query.parentEmail || '').trim().toLowerCase();

      if (!psychologistEmail) {
        return res.status(400).json({ error: 'psychologistEmail обязателен' });
      }

      const authEmail = String(auth?.email || '').toLowerCase();
      const isPsy = await requirePsychologist(req, psychologistEmail);

      // Список диалогов психолога
      if (!parentEmail) {
        const allowed =
          authEmail === psychologistEmail ||
          isPsy?.admin ||
          (isPsy && isPsy.email === psychologistEmail);
        if (!allowed) {
          return res.status(403).json({ error: 'Access denied' });
        }
        const chats = asArray(await redis.get(`geroy:psychologist:${psychologistEmail}:chats`));
        return res.status(200).json(chats);
      }

      const allowed =
        authEmail === psychologistEmail ||
        authEmail === parentEmail ||
        isPsy?.admin ||
        (isPsy && isPsy.email === psychologistEmail);

      if (!allowed) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const messages = asArray(await redis.get(chatKey(psychologistEmail, parentEmail)));
      return res.status(200).json(messages);
    }

    if (req.method === 'POST') {
      const {
        psychologistEmail: bodyPsy,
        parentEmail: bodyParent,
        from,
        to,
        message,
        role,
        parentName
      } = req.body || {};

      const text = String(message || '').trim();
      if (!text) {
        return res.status(400).json({ error: 'Сообщение обязательно' });
      }

      const authEmail = String(auth?.email || '').toLowerCase();
      let psychologistEmail = String(bodyPsy || '').trim().toLowerCase();
      let parentEmail = String(bodyParent || '').trim().toLowerCase();

      // Совместимость с from/to
      if (!psychologistEmail || !parentEmail) {
        const fromEmail = String(from || '').trim().toLowerCase();
        const toEmail = String(to || '').trim().toLowerCase();
        if (role === 'psychologist' || (await requirePsychologist(req, fromEmail))) {
          psychologistEmail = fromEmail;
          parentEmail = toEmail;
        } else {
          parentEmail = fromEmail;
          psychologistEmail = toEmail;
        }
      }

      if (!psychologistEmail || !parentEmail) {
        return res.status(400).json({ error: 'Укажите psychologistEmail и parentEmail' });
      }

      const msgRole = role === 'psychologist' ? 'psychologist' : 'parent';
      if (msgRole === 'psychologist') {
        const psy = await requirePsychologist(req, psychologistEmail);
        if (!psy || (psy.email !== psychologistEmail && !psy.admin)) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else if (authEmail !== parentEmail) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const msg = {
        from: msgRole === 'psychologist' ? psychologistEmail : parentEmail,
        to: msgRole === 'psychologist' ? parentEmail : psychologistEmail,
        psychologistEmail,
        parentEmail,
        message: text.slice(0, 2000),
        role: msgRole,
        timestamp: new Date().toISOString(),
        read: false
      };

      const key = chatKey(psychologistEmail, parentEmail);
      const chat = asArray(await redis.get(key));
      chat.push(msg);
      await redis.set(key, chat.slice(-100));
      await touchChatIndex(psychologistEmail, parentEmail, parentName, text);

      return res.status(200).json({ success: true, message: msg });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('psychologist-chat error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
