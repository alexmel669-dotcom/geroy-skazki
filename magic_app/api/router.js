import login from './_handlers/login.js';
import register from './_handlers/register.js';
import logout from './_handlers/logout.js';
import verifyToken from './_handlers/verify-token.js';
import generate from './_handlers/generate.js';
import tts from './_handlers/tts.js';
import speechToText from './_handlers/speech-to-text.js';
import analytics from './_handlers/analytics.js';
import sync from './_handlers/sync.js';

const ROUTES = {
  login,
  register,
  logout,
  'auth/logout': logout,
  'verify-token': verifyToken,
  generate,
  tts,
  'speech-to-text': speechToText,
  analytics,
  'log-error': analytics,
  health: analytics,
  'admin/stats': analytics,
  'sync-child-data': sync,
  'user/sync': sync
};

function getApiPath(req) {
  const raw = req.url || '';
  const pathname = raw.split('?')[0];
  return pathname.replace(/^\/api\/?/, '').replace(/\/$/, '') || 'health';
}

export default async function handler(req, res) {
  const path = getApiPath(req);
  const routeHandler = ROUTES[path];

  if (!routeHandler) {
    return res.status(404).json({ error: 'Not found', path });
  }

  req.apiRoute = path;
  return routeHandler(req, res);
}
