import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { hashPassword } from '../../api/_lib/crypto.js';
const memory = vi.hoisted(() => ({ store: new Map(), unavailable: false }));
vi.mock('@upstash/redis', () => ({ Redis: class {
  async get(key) { if (memory.unavailable) throw new Error('offline'); return structuredClone(memory.store.get(key) ?? null); }
  async mget(...keys) { return Promise.all(keys.map(key => this.get(key))); }
  async set(key, value) { memory.store.set(key, structuredClone(value)); return 'OK'; }
  async eval(script, [key, generation, dialogs], args) {
    const store = memory.store;
    if (script.includes("'INCR'")) {
      const entry = store.get(key);
      const now = Date.now();
      const count = entry?.until > now ? entry.count : 0;
      if (count >= 3) return [0, Math.ceil((entry.until - now) / 1000)];
      store.set(key, { count: count + 1, until: count ? entry.until : now + 300000 });
      return [count + 1, 0];
    }
    if (script.includes("'DEL'")) {
      if (args[1] === '1' && (store.get(generation) ?? '') !== args[2]) return 0;
      store.set(generation, args[0]);
      if (script.includes("redis.call('DEL', KEYS[3])")) store.delete(dialogs);
      return Number(store.delete(key));
    }
    const user = store.get(key);
    const current = store.get(generation) ?? '';
    if (script.includes('secretAnswerHash')) {
      if (!user || user.passwordHash !== args[0] || user.secretAnswerHash !== args[1] || current !== args[4]) return 0;
      store.set(key, { ...user, passwordHash: args[2] });
      store.set(generation, args[3]);
      return 1;
    }
    if (!user || current !== args[0]) return 0;
    store.set(key, JSON.parse(args[1]));
    return 1;
  }
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
import logout from '../../api/_handlers/logout.js';
import reset from '../../api/_handlers/reset-password.js';
import verifyToken from '../../api/_handlers/verify-token.js';
import chat from '../../api/_handlers/psychologist-chat.js';
import booking from '../../api/_handlers/psychologist-booking.js';
import reviews from '../../api/_handlers/psychologist-reviews.js';
import report from '../../api/_handlers/psychologist-report.js';
import feedback from '../../api/_handlers/feedback.js';
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
    const grant=await unlock(token());expect(await verifyAuth(request(grant))).toBeNull();
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
    const dialogsKey = 'geroy:dialogs:' + email.toLowerCase();
    memory.store.set(dialogsKey, ['synthetic']);
    memory.store.set('geroy:dialogs:other@audit.invalid', ['other']);
    const session=token();const r=res();await deletion(request(session,{},await unlock(session)),r);
    expect(memory.store.has(dialogsKey)).toBe(false);
    expect(memory.store.get('geroy:dialogs:other@audit.invalid')).toEqual(['other']);
    expect(r.code).toBe(200);expect(memory.store.has(`geroy:user:${email}`)).toBe(false);
  });
  it('child link issuance still works after PIN', async () => {
    const session=token();const r=res();await childToken(request(session,{childIndex:0},await unlock(session)),r);
    expect(r.code).toBe(200);expect(r.body.url).toContain('child_token=');
  });
});

describe('remaining parent API guards', () => {
  const psychologistEmail = 'psychologist@synthetic.invalid';
  const fields = {
    psychologistEmail, parentEmail: email, reason: 'Synthetic',
    message: 'Synthetic', date: '2026-01-01', time: '10:00', rating: 4,
    requestExtend: true
  };
  it.each([
    ['chat read', chat, 'GET'], ['chat write', chat, 'POST'],
    ['booking', booking, 'POST'], ['review', reviews, 'POST'],
    ['report', report, 'POST'], ['feedback bonus', feedback, 'POST']
  ])('%s requires a PIN and denies the child role', async (_name, handler, method) => {
    for (const [session, expected] of [[token(), 403], [token({ role: 'child' }), 403]]) {
      const req = request(session, fields, undefined, method);
      req.query = fields;
      const r = res();
      await handler(req, r);
      expect(r.code).toBe(expected);
      if (jwt.decode(session).role === 'user') expect(r.body.code).toBe('PARENT_PIN_REQUIRED');
    }
  });
  it('uses verified family identity when submitting a complaint', async () => {
    const session = token();
    const r = res();
    await report(request(session, { ...fields, reportedBy: 'foreign@synthetic.invalid' }, await unlock(session)), r);
    expect(r.code).toBe(200);
    expect(memory.store.get('geroy:psychologist:reports')[0].reportedBy).toBe(email);
  });
  it('rejects a foreign family booking after PIN', async () => {
    const session = token();
    const r = res();
    await booking(request(session, { ...fields, parentEmail: 'foreign@synthetic.invalid' }, await unlock(session)), r);
    expect(r.code).toBe(403);
    expect(memory.store.has('geroy:psychologist:' + psychologistEmail + ':bookings')).toBe(false);
  });
  it('only issues links for child indexes in the verified family', async () => {
    const session = token();
    const grant = await unlock(session);
    const missing = res();
    await childToken(request(session, { childIndex: 1, parentEmail: 'foreign@synthetic.invalid' }, grant), missing);
    expect(missing.code).toBe(404);
    const own = res();
    await childToken(request(session, { childIndex: 0, parentEmail: 'foreign@synthetic.invalid' }, grant), own);
    const claims = jwt.decode(new URL(own.body.url).searchParams.get('child_token'));
    expect(claims).toMatchObject({ email, role: 'child', childIndex: 0 });
    expect((await stats(new URL(own.body.url).searchParams.get('child_token'), grant)).code).toBe(403);
  });
  it('admits only three PIN attempts per family across concurrent requests and sessions', async () => {
    const replies = await Promise.all(Array.from({ length: 12 }, async (_, i) => {
      const r = res();
      await verifyPin(request(token({ jti: 'pin-' + i }), { pin: '0000' }), r);
      return r.code;
    }));
    expect(replies.filter(code => code === 403)).toHaveLength(3);
    expect(replies.filter(code => code === 429)).toHaveLength(9);
    vi.setSystemTime(Date.now() + 300000);
    expect(await unlock(token())).toBeTruthy();
  });
});

describe('server-side session revocation', () => {
  async function status(session) {
    const r = res();
    await verifyToken(request(session, {}, undefined, 'GET'), r);
    return r.code;
  }

  it('logout revokes cookie and bearer JWTs, preserving independent sessions', async () => {
    const cookie = token({ jti: 'cookie' });
    const bearer = token({ jti: 'bearer' });
    const other = token({ jti: 'other' });
    const grant = await unlock(bearer);
    const req = request(bearer);
    req.headers.cookie = 'token=' + cookie;
    const r = res();
    await logout(req, r);
    expect(r.code).toBe(200);
    expect(await status(cookie)).toBe(401);
    expect(await status(bearer)).toBe(401);
    expect(await status(other)).toBe(200);
    expect((await stats(bearer, grant)).code).toBe(401);
  });
  it('reset revokes legacy parent and child JWTs and permits login with the new password', async () => {
    const user = memory.store.get('geroy:user:' + email);
    user.secretAnswerHash = hashPassword('synthetic');
    const parent = token();
    const child = token({ role: 'child' });
    const r = res();
    await reset(request(null, { email, secretAnswer: 'synthetic', newPassword: 'new-synthetic-password' }), r);
    expect(r.code).toBe(200);
    expect(await status(parent)).toBe(401);
    expect(await status(child)).toBe(401);
    const fresh = res();
    await login(request(null, { email, password: 'new-synthetic-password' }), fresh);
    expect(fresh.code).toBe(200);
    expect(await status(fresh.body.token)).toBe(200);
  });
  it('account deletion invalidates parent and child JWTs even if the email is reused', async () => {
    const parent = token();
    const child = token({ role: 'child' });
    const original = memory.store.get('geroy:user:' + email);
    const r = res();
    await deletion(request(parent, {}, await unlock(parent)), r);
    expect(r.code).toBe(200);
    expect(await status(parent)).toBe(401);
    memory.store.set('geroy:user:' + email, original);
    expect(await status(parent)).toBe(401);
    expect(await status(child)).toBe(401);
  });
  it('rejects an issued session on a protected route after account deletion', async () => {
    memory.store.set('geroy:session-generation:' + email, 'previous-generation');
    const signedIn = res();
    await login(request(null, { email, password: 'synthetic-password' }), signedIn);
    expect(signedIn.code).toBe(200);
    const session = signedIn.body.token;
    const grant = await unlock(session);
    expect((await stats(session, grant)).code).toBe(200);

    const removed = res();
    await deletion(request(session, {}, grant), removed);
    expect(removed.code).toBe(200);
    expect((await stats(session, grant)).code).toBe(401);

    memory.store.set('geroy:user:' + email, { email, passwordHash, parentPinHash });
    expect((await stats(session, grant)).code).toBe(401);
    const fresh = res();
    await login(request(null, { email, password: 'synthetic-password' }), fresh);
    expect(fresh.code).toBe(200);
    expect(await status(fresh.body.token)).toBe(200);
  });
  it('verify-token preserves child role for an existing family', async () => {
    const r = res();
    await verifyToken(request(token({ mode: 'child' }), {}, undefined, 'GET'), r);
    expect(r.code).toBe(200);
    expect(r.body.user.role).toBe('child');
  });
});
