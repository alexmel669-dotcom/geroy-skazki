import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
const store = vi.hoisted(() => new Map());
vi.mock('@upstash/redis', () => ({ Redis: class {
  async get(key) { return structuredClone(store.get(key) ?? null); }
  async set(key, value) { store.set(key, structuredClone(value)); return 'OK'; }
  async exists(key) { return store.has(key) ? 1 : 0; }
  async del(key) { store.delete(key); }
}}));
vi.mock('../../api/_middleware/rate-limit.js', () => ({checkRateLimit: () => true, getRateLimitKey: () => 'synthetic'}));
vi.mock('../../api/_middleware/ai-rate-limit.js', () => ({checkRateLimit: () => ({allowed:true})}));
import register from '../../api/_handlers/register.js';
import generate from '../../api/_handlers/generate.js';
import chat from '../../api/_handlers/psychologist-chat.js';
import childStats from '../../api/_handlers/psychologist-child-stats.js';
import { verifyAdmin } from '../../api/_middleware/auth.js';
import { requirePsychologist } from '../../api/_lib/psychologist-access.js';

function response() {
  return { code:200, headers:{}, status(n){this.code=n;return this;}, setHeader(k,v){this.headers[k]=v;}, json(body){this.body=body;return this;}, end(){} };
}
function req(body={}, claims, method='POST', query={}) {
  return {method,body,query,headers:claims?{authorization:`Bearer ${jwt.sign(claims,process.env.JWT_SECRET)}`}:{}};
}
beforeEach(() => {
  store.clear();
  vi.stubEnv('JWT_SECRET','synthetic-security-test-secret');
  vi.stubEnv('ADMIN_API_TOKEN','synthetic-admin-secret');
  vi.stubEnv('YANDEX_API_KEY','synthetic-provider-key');
  vi.stubEnv('YANDEX_FOLDER_ID','synthetic-folder');
  vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('UNEXPECTED NETWORK');}));
});

describe('P0-01 privilege isolation', () => {
  it('public signup at legacy admin email gets an ordinary JWT', async () => {
    const r=response();
    await register(req({email:'admin@geroy-skazki.local',password:'synthetic-password',parentPin:'1234',secretQuestion:'pet',secretAnswer:'synthetic-pet',children:[{name:'Synthetic',age:7}]}),r);
    expect(r.code).toBe(201);
    expect(r.body.user.role).toBe('user');
    expect(jwt.verify(r.body.token,process.env.JWT_SECRET).role).toBe('user');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('old admin JWT has no admin access; dedicated credential still works', () => {
    expect(verifyAdmin(req({}, {email:'old@audit.invalid',role:'admin'}))).toBeNull();
    expect(verifyAdmin({headers:{authorization:'Bearer synthetic-admin-secret'}})).toEqual({role:'admin'});
  });
  it('legacy admin JWT cannot read another psychologist chat or child stats', async () => {
    store.set('geroy:user:psy@audit.invalid',{role:'psychologist'});
    store.set('geroy:psychologists',[{email:'psy@audit.invalid',active:true}]);
    store.set('geroy:chat:psy@audit.invalid:family@audit.invalid',[{message:'private'}]);
    store.set('geroy:consent:family@audit.invalid:psy@audit.invalid',{consent:true,childName:'Private'});
    for(const handler of [chat,childStats]){
      const r=response(); await handler(req({}, {email:'old@audit.invalid',role:'admin'},'GET',{psychologistEmail:'psy@audit.invalid',parentEmail:'family@audit.invalid'}),r);
      expect(r.code).toBe(403);
    }
  });
  it('child cannot inherit psychologist access from parent email', async () => {
    store.set('geroy:user:psy@audit.invalid',{role:'psychologist'});
    expect(await requirePsychologist(req({}, {email:'psy@audit.invalid',role:'child'}),'psy@audit.invalid')).toBeNull();
  });
  it('public user cannot inherit a partner directory identity', async () => {
    store.set('geroy:user:psy@audit.invalid',{role:'user'});
    store.set('geroy:psychologists',[{email:'psy@audit.invalid',active:true}]);
    expect(await requirePsychologist(req({}, {email:'psy@audit.invalid',role:'user'}),'psy@audit.invalid')).toBeNull();
  });
  it('actual psychologist can read own chat, not another psychologist', async () => {
    store.set('geroy:user:psy@audit.invalid',{role:'psychologist'});
    store.set('geroy:chat:psy@audit.invalid:family@audit.invalid',[{message:'own'}]);
    const r=response();await chat(req({}, {email:'psy@audit.invalid',role:'psychologist'},'GET',{psychologistEmail:'psy@audit.invalid',parentEmail:'family@audit.invalid'}),r);
    expect(r.code).toBe(200);expect(r.body).toEqual([{message:'own'}]);
    expect(await requirePsychologist(req({}, {email:'psy@audit.invalid',role:'psychologist'}),'other@audit.invalid')).toBeNull();
  });
});
describe('P0-02 parent AI family context', () => {
  it.each(['mom','dad'])('rejects unauthenticated %s context before lookup or provider', async character => {
    const r=response();await generate(req({character,message:'stats',parentEmail:'victim@audit.invalid'}),r);
    expect(r.code).toBe(401);expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects child parent-mode even with history', async () => {
    const r=response();await generate(req({character:'mom',message:'stats',history:[{content:'old'}]}, {email:'family@audit.invalid',role:'child'}),r);
    expect(r.code).toBe(403);expect(fetch).not.toHaveBeenCalled();
  });
  it('ignores body email and global activity, uses only authenticated family', async () => {
    store.set('geroy:user:own@audit.invalid',{children:[{name:'OWN_SYNTHETIC',age:7}]});
    store.set('geroy:user:other@audit.invalid',{children:[{name:'FOREIGN_SYNTHETIC',age:9}]});
    fetch.mockResolvedValue({ok:true,json:async()=>({result:{alternatives:[{message:{text:'{"message":"Привет"}'}}]}})});
    const r=response();await generate(req({character:'mom',message:'stats',parentEmail:'other@audit.invalid',email:'other@audit.invalid'},{email:'own@audit.invalid',role:'user'}),r);
    expect(r.code).toBe(200);expect(fetch).toHaveBeenCalledTimes(1);
    const body=fetch.mock.calls[0][1].body;
    expect(body).toContain('OWN_SYNTHETIC');expect(body).not.toContain('FOREIGN_SYNTHETIC');expect(body).not.toContain('Всего событий');
  });
  it('keeps guest child conversation available', async () => {
    vi.stubEnv('YANDEX_API_KEY','');const r=response();
    await generate(req({message:'привет',character:'lucik',isGuest:true}),r);
    expect(r.code).toBe(200);expect(fetch).not.toHaveBeenCalled();
  });
});
