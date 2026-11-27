import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../public/js/api-base.js', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../../public/js/api-base.js';
let access;
let session;
beforeEach(async () => {
  vi.resetModules();vi.useFakeTimers();vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  session='synthetic-session';
  vi.stubGlobal('window',new EventTarget());
  vi.stubGlobal('localStorage',{getItem:()=>session,setItem:()=>{throw new Error('grant must not be persisted');}});
  apiFetch.mockReset();apiFetch.mockResolvedValue(new Response('{}',{status:200}));
  access=await import('../../public/js/parent-access.js');
});
afterEach(() => {access.clearParentGrant();vi.useRealTimers();vi.unstubAllGlobals();});
it('keeps the grant in memory and attaches it without dropping login headers', async () => {
  expect(access.acceptParentGrant({parentGrant:'proof',expiresAt:Date.now()+300000})).toBe(true);
  await access.parentApiFetch('/api/weekly-stats',{headers:{Authorization:'Bearer session'}});
  const headers=apiFetch.mock.calls[0][1].headers;
  expect(headers.get('X-Parent-Authorization')).toBe('Bearer proof');
  expect(headers.get('Authorization')).toBe('Bearer session');
});
it('expiry clears proof and signals the existing PIN overlay', async () => {
  const required=vi.fn();window.addEventListener('parent-pin-required',required);
  access.acceptParentGrant({parentGrant:'proof',expiresAt:Date.now()+300000});
  vi.advanceTimersByTime(300000);
  expect(required).toHaveBeenCalledTimes(1);
  await access.parentApiFetch('/api/weekly-stats');
  expect(apiFetch.mock.calls[0][1].headers.has('X-Parent-Authorization')).toBe(false);
});
it('a changed login session drops the previous proof', async () => {
  access.acceptParentGrant({parentGrant:'proof',expiresAt:Date.now()+300000});session='another-session';
  await access.parentApiFetch('/api/profile-update');
  expect(apiFetch.mock.calls[0][1].headers.has('X-Parent-Authorization')).toBe(false);
});
it('server PIN-required response clears memory and requests PIN again', async () => {
  access.acceptParentGrant({parentGrant:'proof',expiresAt:Date.now()+300000});
  const required=vi.fn();window.addEventListener('parent-pin-required',required);
  apiFetch.mockResolvedValue(new Response('{"code":"PARENT_PIN_REQUIRED"}',{status:403}));
  await access.parentApiFetch('/api/weekly-stats');
  expect(required).toHaveBeenCalledTimes(1);
  await access.parentApiFetch('/api/weekly-stats');
  expect(apiFetch.mock.calls[1][1].headers.has('X-Parent-Authorization')).toBe(false);
});
it('expired or malformed server responses never unlock the client', () => {
  expect(access.acceptParentGrant({success:true})).toBe(false);
  expect(access.acceptParentGrant({parentGrant:'old',expiresAt:Date.now()})).toBe(false);
});
it('page exit drops proof; returning through browser cache requires PIN', async () => {
  access.acceptParentGrant({parentGrant:'proof',expiresAt:Date.now()+300000});
  window.dispatchEvent(new Event('pagehide'));
  await access.parentApiFetch('/api/weekly-stats');
  expect(apiFetch.mock.calls[0][1].headers.has('X-Parent-Authorization')).toBe(false);
  const required=vi.fn();window.addEventListener('parent-pin-required',required);
  const event=new Event('pageshow');Object.defineProperty(event,'persisted',{value:true});window.dispatchEvent(event);
  expect(required).toHaveBeenCalledTimes(1);
});

it('never forwards parent proof to an absolute external URL', async () => {
  access.acceptParentGrant({parentGrant:'proof',expiresAt:Date.now()+300000});
  await access.parentApiFetch('https://external.invalid/api/test');
  expect(apiFetch.mock.calls[0][1].headers.has('X-Parent-Authorization')).toBe(false);
});
