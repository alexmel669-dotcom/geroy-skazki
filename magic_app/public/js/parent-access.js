import { apiFetch } from './api-base.js';

let grant = null;
let expiresAt = 0;
let sessionToken = null;
let expiryTimer = null;

export function clearParentGrant() {
  clearTimeout(expiryTimer);
  expiryTimer = null;
  grant = null;
  expiresAt = 0;
  sessionToken = null;
}

export function acceptParentGrant(data) {
  clearParentGrant();
  if (typeof data?.parentGrant !== 'string' || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) return false;
  grant = data.parentGrant;
  expiresAt = data.expiresAt;
  sessionToken = localStorage.getItem('userToken');
  expiryTimer = setTimeout(() => {
    clearParentGrant();
    window.dispatchEvent(new Event('parent-pin-required'));
  }, expiresAt - Date.now());
  return true;
}

// Grant stays in this tab's memory; local/sessionStorage flags never grant access.
export async function parentApiFetch(path, options = {}) {
  if (sessionToken !== localStorage.getItem('userToken') || Date.now() >= expiresAt) clearParentGrant();
  const headers = new Headers(options.headers);
  headers.delete('X-Parent-Authorization');
  // Only relative API paths may receive a parent credential.
  if (grant && typeof path === 'string' && path.startsWith('/api/')) {
    headers.set('X-Parent-Authorization', `Bearer ${grant}`);
  }
  const response = await apiFetch(path, { ...options, headers });
  if (response.status === 403) {
    const data = await response.clone().json().catch(() => ({}));
    if (data.code === 'PARENT_PIN_REQUIRED') {
      clearParentGrant();
      window.dispatchEvent(new Event('parent-pin-required'));
    }
  }
  return response;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', clearParentGrant);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      clearParentGrant();
      window.dispatchEvent(new Event('parent-pin-required'));
    }
  });
}
