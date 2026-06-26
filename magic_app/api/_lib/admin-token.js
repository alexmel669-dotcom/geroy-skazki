export function getAdminApiToken() {
  const raw = process.env.ADMIN_API_TOKEN?.trim() || 'admin-token-v5.0.5';
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
}

export function isValidAdminToken(req) {
  const auth = req.headers.authorization || '';
  return auth === getAdminApiToken();
}
