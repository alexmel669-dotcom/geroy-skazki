import { setCors } from './_middleware/cors.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const yandexKey = process.env.YANDEX_API_KEY?.trim();
  const yandexFolder = process.env.YANDEX_FOLDER_ID?.trim();

  return res.status(200).json({
    ok: true,
    version: '4.1.0',
    node: process.version,
    env: {
      jwt: Boolean(process.env.JWT_SECRET?.trim()),
      yandexKey: Boolean(yandexKey),
      yandexFolder: Boolean(yandexFolder),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY?.trim())
    },
    yandexKeyLength: yandexKey ? yandexKey.length : 0,
    timestamp: new Date().toISOString()
  });
}
