import sync from './_handlers/sync.js';

export default async function handler(req, res) {
  req.apiRoute = 'sync-child-data';
  return sync(req, res);
}
