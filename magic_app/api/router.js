import login from './_handlers/login.js';

import register from './_handlers/register.js';

import logout from './_handlers/logout.js';

import verifyToken from './_handlers/verify-token.js';

import generate from './_handlers/generate.js';

import tts from './_handlers/tts.js';

import speechToText from './_handlers/speech-to-text.js';

import analytics from './_handlers/analytics.js';

import sync from './_handlers/sync.js';

import profileUpdate from './_handlers/profile-update.js';

import psychologistHelp from './_handlers/psychologist-help.js';

import promocode from './_handlers/promocode.js';
import adminStats from './_handlers/admin-stats.js';
import adminFullStats from './_handlers/admin-full-stats.js';
import adminLogin from './_handlers/admin-login.js';
import verifyPin from './_handlers/verify-pin.js';
import childToken from './_handlers/child-token.js';
import weeklyDigest from './_handlers/weekly-digest.js';
import weeklyStats from './_handlers/weekly-stats.js';
import feedback from './_handlers/feedback.js';
import getSecretQuestion from './_handlers/get-secret-question.js';
import resetPassword from './_handlers/reset-password.js';



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

  'admin/stats': adminStats,

  'admin/full-stats': adminFullStats,

  'admin/login': adminLogin,

  'admin-login': adminLogin,

  'sync-child-data': sync,

  'user/sync': sync,

  'profile-update': profileUpdate,

  'psychologist-help': psychologistHelp,

  promocode: promocode,

  'verify-pin': verifyPin,

  'child-token': childToken,

  'weekly-digest': weeklyDigest,

  'weekly-stats': weeklyStats,

  feedback,

  'get-secret-question': getSecretQuestion,

  'reset-password': resetPassword

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

