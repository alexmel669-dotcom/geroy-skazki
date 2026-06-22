export function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  res.setHeader(
    'Set-Cookie',
    `token=${token}; HttpOnly; ${secure}SameSite=Strict; Path=/; Max-Age=604800`
  );
}

export function clearAuthCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  res.setHeader(
    'Set-Cookie',
    `token=; HttpOnly; ${secure}SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}
