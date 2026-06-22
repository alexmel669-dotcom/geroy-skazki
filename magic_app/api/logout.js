import { setCors } from './_middleware/cors.js';
import { clearAuthCookie } from './_lib/cookies.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  clearAuthCookie(res);
  return res.status(200).json({ success: true });
}
