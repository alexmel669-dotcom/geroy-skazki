import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { hashPassword } from '../../api/_lib/crypto.js';
const memory = vi.hoisted(() => ({ store: new Map(), unavailable: false }));
vi.mock('@upstash/redis', () => ({ Redis: class {
  async get(key) { if (memory.unavailable) throw new Error('offline'); return structuredClone(memory.store.get(key) ?? null); }
  async set(key, value) { memory.store.set(key, structuredClone(value)); return 'OK'; }
  async del(key) { memory.store.delete(key); }
}}));
vi.mock('../../api/_middleware/rate-limit.js', () => ({ checkRateLimit: () => true, getRateLimitKey: () => 'synthetic' }));
import verifyPin from '../../api/_handlers/verify-pin.js';
import weeklyStats from '../../api/_handlers/weekly-stats.js';
import profile from '../../api/_handlers/profile-update.js';
import deletion from '../../api/_handlers/delete-account.js';
import childToken from '../../api/_handlers/child-token.js';
import consent from '../../api/_handlers/parent-consent.js';
import help from '../../api/_handlers/psychologist-help.js';
import digest from '../../api/_handlers/weekly-digest.js';
import login from '../../api/_handlers/login.js';
import { verifyAuth } from '../../api/_middleware/auth.js';

const email = 'parent@synthetic.invalid';
const passwordHash = hashPassword('synthetic-password');
const parentPinHash = hashPassword('1234');
function res() { return { code:200, headers:{}, status(n){this.code=n;return this;}, setHeader(k,v){this.headers[k]=v;}, json(body){this.body=body;return this;}, end(){} }; }
function token(claims={}) { return jwt.sign({email,role:'user',...claims},process.env.JWT_SECRET,{expiresIn:'7d'}); }
function request(session,body={},grant,method='POST') { return {method,body,headers:{...(session?{authorization:`Bearer ${session}`} : {}),...(grant?{'x-parent-authorization':`Bearer ${grant}`} : {})},query:{}}; }
async function unlock(session) { const r=res();await verifyPin(request(session,{pin:'1234'}),r);expect(r.code).toBe(200);return r.body.parentGrant; }
async function stats(session,grant) { const r=res();await weeklyStats(request(session,{},grant,'GET'),r);return r; }
beforeEach(() => {
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  vi.stubEnv('JWT_SECRET','synthetic-parent-pin-test-key');
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK DISABLED');}));
  memory.store.clear();memory.unavailable=false;
  memory.store.set(`geroy:user:${email}`,{email,username:'Synthetic',passwordHash,parentPinHash,children:[{name:'Synthetic child',age:7}]});
});
afterEach(() => {vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('P1-02 session-bound parent PIN', () => {
  it('wrong PIN issues no grant and cannot read protected data', async () => {
    const session=token();const r=res();await verifyPin(request(session,{pin:'0000'}),r);
    expect(r.code).toBe(403);expect(r.body.parentGrant).toBeUndefined();
    expect((await stats(session)).code).toBe(403);
  });
  it('successful PIN unlocks only the same session for five minutes', async () => {
    const session=token({jti:'one'});const r=res();await verifyPin(request(session,{pin:'1234'}),r);
    expect(r.body.expiresAt).toBe(Date.now()+300000);expect(r.headers['Cache-Control']).toBe('no-store');
    expect((await stats(session,r.body.parentGrant)).code).toBe(200);
    vi.setSystemTime(Date.now()+299000);expect((await stats(session,r.body.parentGrant)).code).toBe(200);
    vi.setSystemTime(Date.now()+1000);expect((await stats(session,r.body.parentGrant)).code).toBe(403);
  });
  it('grant cannot move to another session of the same parent', async () => {
    const first=token({jti:'one'});const grant=await unlock(first);
    expect((await stats(token({jti:'two'}),grant)).code).toBe(403);
  });
  it('grant cannot move to another family', async () => {
    const grant=await unlock(token());
    memory.store.set('geroy:user:other@synthetic.invalid',{email:'other@synthetic.invalid',passwordHash,parentPinHash});
    expect((await stats(token({email:'other@synthetic.invalid'}),grant)).code).toBe(403);
  });
  it('legacy parent token without jti must verify PIN and remains usable afterwards', async () => {
    const legacy=token();expect(jwt.decode(legacy).jti).toBeUndefined();
    expect((await stats(legacy)).body.code).toBe('PARENT_PIN_REQUIRED');
    expect((await stats(legacy,await unlock(legacy))).code).toBe(200);
  });
  it.each([{role:'child'},{mode:'child'}])('legacy child identity cannot unlock or reuse a parent grant (%j)', async claims => {
    const grant=await unlock(token());const child=token(claims);const r=res();await verifyPin(request(child,{pin:'1234'}),r);
    expect(r.code).toBe(403);expect((await stats(child,grant)).code).toBe(403);
  });
  it('checkOnly and forged client flags do not elevate a session', async () => {
    const session=token();const r=res();await verifyPin(request(session,{checkOnly:true,pin:'1234',parentPinOk:true}),r);
    expect(r.body.parentGrant).toBeUndefined();expect((await stats(session)).code).toBe(403);
  });
  it('old profiles without a PIN cannot bypass elevation', async () => {
    delete memory.store.get(`geroy:user:${email}`).parentPinHash;
    const r=res();await verifyPin(request(token(),{pin:'1234'}),r);
    expect(r.code).toBe(403);expect(r.body.code).toBe('PARENT_PIN_NOT_CONFIGURED');
  });
  it('rejects a grant with a changed signature', async () => {
    const session=token();const grant=await unlock(session);const parts=grant.split('.');
    parts[2]=(parts[2][0]==='a'?'b':'a')+parts[2].slice(1);
    expect((await stats(session,parts.join('.'))).code).toBe(403);
  });
  it('PIN grants cannot be substituted for login tokens', async () => {
    const grant=await unlock(token());expect(verifyAuth(request(grant))).toBeNull();
  });
  it('a login JWT cannot be substituted for a PIN grant', async () => {
    const session=token();expect((await stats(session,session)).code).toBe(403);
  });
  it.each(['passwordHash','parentPinHash'])('credential changes invalidate existing grants (%s)', async field => {
    const session=token();const grant=await unlock(session);memory.store.get(`geroy:user:${email}`)[field]='changed';
    expect((await stats(session,grant)).code).toBe(403);
  });
  it('expired login session cannot use a still-fresh grant', async () => {
    const session=jwt.sign({email,role:'user'},process.env.JWT_SECRET,{expiresIn:30});
    const grant=await unlock(session);vi.setSystemTime(Date.now()+30000);
    expect((await stats(session,grant)).code).toBe(401);
  });
  it('three wrong attempts lock PIN issuance including the correct PIN', async () => {
    const session=token();for(let i=0;i<3;i++){const r=res();await verifyPin(request(session,{pin:'0000'}),r);expect(r.code).toBe(403);}
    const r=res();await verifyPin(request(session,{pin:'1234'}),r);expect(r.code).toBe(429);expect(r.body.parentGrant).toBeUndefined();
  });
  it('storage failure fails closed without provider calls', async () => {
    const session=token();const grant=await unlock(session);memory.unavailable=true;
    expect((await stats(session,grant)).code).toBe(503);expect(fetch).not.toHaveBeenCalled();
  });
  it('two logins in the same second create distinct sessions', async () => {
    const sessions=[];for(let i=0;i<2;i++){const r=res();await login({method:'POST',headers:{},body:{email,password:'synthetic-password'}},r);expect(r.code).toBe(200);sessions.push(r.body.token);}
    expect(sessions[0]).not.toBe(sessions[1]);expect(jwt.decode(sessions[0]).jti).toBeTruthy();
    expect((await stats(sessions[1],await unlock(sessions[0]))).code).toBe(403);
  });
  const endpoints=[['profile GET',profile,'GET'],['profile POST',profile,'POST'],['delete',deletion,'POST'],['child link',childToken,'POST'],['weekly stats',weeklyStats,'GET'],['consent',consent,'POST'],['recommendations',help,'POST'],['digest',digest,'POST']];
  it.each(endpoints)('%s denies missing proof before protected actions', async (_name,handler,method) => {
    const r=res();await handler(request(token(),{},undefined,method),r);
    expect(r.code).toBe(403);expect(r.body.code).toBe('PARENT_PIN_REQUIRED');
    expect(memory.store.has(`geroy:user:${email}`)).toBe(true);expect(fetch).not.toHaveBeenCalled();
  });
  it('delete succeeds with current session proof (synthetic data only)', async () => {
    const session=token();const r=res();await deletion(request(session,{},await unlock(session)),r);
    expect(r.code).toBe(200);expect(memory.store.has(`geroy:user:${email}`)).toBe(false);
  });
  it('child link issuance still works after PIN', async () => {
    const session=token();const r=res();await childToken(request(session,{childIndex:0},await unlock(session)),r);
    expect(r.code).toBe(200);expect(r.body.url).toContain('child_token=');
  });
});
