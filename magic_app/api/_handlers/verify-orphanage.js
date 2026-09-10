import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { sanitizeUrl, isValidEmailFormat } from '../_lib/sanitize.js';

// Примечание: имя/город/контакт и т.п. здесь НЕ прогоняются через sanitizeHTML —
// эти поля уже безопасно экранируются на выводе в admin-dashboard.js (escapeHtml())
// при каждом рендере; повторное HTML-экранирование на сохранении дало бы двойное
// экранирование ("&amp;amp;" вместо "&"). Единственная реальная дыра здесь — поле
// documents, которое рендерится как <a href="..."> и НЕ проходит через escapeHtml
// для схемы ссылки, поэтому его валидируем отдельно (sanitizeUrl/isSafeHttpUrl).

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const APPLICATIONS_KEY = 'geroy:orphanage:applications';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name,
      city,
      contactName,
      position,
      contactPhone,
      email,
      childrenCount,
      documents,
      confirmed
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanContact = String(contactName || '').trim();
    const cleanPhone = String(contactPhone || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!cleanName || !cleanContact || !cleanPhone || !normalizedEmail) {
      return res.status(400).json({
        error: 'Заполните обязательные поля: название, контакт, телефон, email'
      });
    }

    if (!isValidEmailFormat(normalizedEmail)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    if (confirmed === false) {
      return res.status(400).json({ error: 'Подтвердите согласие с условиями' });
    }

    // P0-2 fix: поле documents раньше принималось как есть и рендерилось в админке
    // как <a href="...">, что позволяло вставить javascript:-схему (XSS при клике
    // админа). Теперь принимаем только настоящие http(s)-ссылки.
    const cleanDocuments = String(documents || '').trim();
    if (cleanDocuments && !sanitizeUrl(cleanDocuments)) {
      return res.status(400).json({
        error: 'Поле «Документы» должно быть ссылкой (http:// или https://)'
      });
    }

    const applications = asArray(await redis.get(APPLICATIONS_KEY));
    if (applications.some((a) => String(a.email || '').toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: 'Заявка с этим email уже отправлена' });
    }

    applications.push({
      name: cleanName.slice(0, 200),
      city: String(city || '').trim().slice(0, 100),
      contactName: cleanContact.slice(0, 200),
      position: String(position || '').trim().slice(0, 100),
      contactPhone: cleanPhone,
      phone: cleanPhone,
      email: normalizedEmail,
      childrenCount: String(childrenCount || '').trim().slice(0, 20),
      documents: sanitizeUrl(cleanDocuments),
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    await redis.set(APPLICATIONS_KEY, applications.slice(-500));

    return res.status(200).json({
      success: true,
      message: 'Заявка принята. Мы проверим документы в течение 3 рабочих дней и пришлём промокод.'
    });
  } catch (err) {
    console.error('verify-orphanage error:', err);
    return res.status(500).json({ error: 'Не удалось сохранить заявку' });
  }
}
