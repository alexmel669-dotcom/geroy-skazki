import { setCors } from '../_middleware/cors.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  
  res.setHeader('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  
  return res.status(200).json({ success: true });
}
