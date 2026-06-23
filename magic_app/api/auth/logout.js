import logout from './_handlers/logout.js';

export default async function handler(req, res) {
  return logout(req, res);
}
