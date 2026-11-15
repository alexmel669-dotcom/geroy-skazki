import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

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

import { issueParentGrant } from '../../api/_middleware/parent-pin.js';
import profile from '../../api/_handlers/profile-update.js';
import deleteAccount from '../../api/_handlers/delete-account.js';
import reviews from '../../api/_handlers/psychologist-reviews.js';
import { readFileSync } from 'node:fs';

describe('Stage B data exposure and child rights', () => {
  const email='family@audit.invalid';
  it.each(['GET','POST'])('child profile %s is forbidden', async method => {
    const r=response();await profile(req({}, {email,role:'child'},method),r);
    expect(r.code).toBe(403);
  });
  it.each(['role','mode'])('child %s cannot delete the family', async field => {
    store.set(`geroy:user:${email}`,{email});
    const r=response();await deleteAccount(req({}, {email,[field]:'child'}),r);
    expect(r.code).toBe(403);expect(store.has(`geroy:user:${email}`)).toBe(true);
  });
  it('legacy parent can update without exposing top-level or nested secrets', async () => {
    store.set(`geroy:user:${email}`,{email,username:'Synthetic',passwordHash:'DO_NOT_EXPOSE',parentPinHash:'DO_NOT_EXPOSE',secretAnswerHash:'DO_NOT_EXPOSE',internal:'DO_NOT_EXPOSE',children:[{name:'Synthetic',age:7,internal:'DO_NOT_EXPOSE'}]});
    const request = req({childName:'Changed'},{email,role:'user'});
    request.headers['x-parent-authorization'] = `Bearer ${issueParentGrant(request,store.get(`geroy:user:${email}`)).parentGrant}`;
    const r=response();await profile(request,r);
    expect(r.code).toBe(200);expect(r.body.user.childName).toBe('Changed');
    expect(JSON.stringify(r.body)).not.toContain('DO_NOT_EXPOSE');
    expect(store.get(`geroy:user:${email}`).passwordHash).toBe('DO_NOT_EXPOSE');
  });
  it('public reviews never expose author email or unexpected internal fields', async () => {
    store.set('geroy:psychologist:psy@audit.invalid:reviews',[{id:'1',rating:5,text:'Synthetic',createdAt:'2026-01-01',parentEmail:email,internal:'private'}]);
    const r=response();await reviews(req({},undefined,'GET',{psychologistEmail:'psy@audit.invalid'}),r);
    expect(r.code).toBe(200);expect(r.body).toEqual([{id:'1',rating:5,text:'Synthetic',createdAt:'2026-01-01'}]);
  });
  it('untrusted api query cannot change credential destination', async () => {
    vi.stubGlobal('window',{location:{search:'?api=https://attacker.invalid',origin:'https://safe.invalid',protocol:'https:'}});
    vi.stubGlobal('navigator',{userAgent:'Synthetic browser'});
    const {apiFetch}=await import('../../public/js/api-base.js');
    fetch.mockResolvedValue({ok:true});await apiFetch('/api/login',{method:'POST',body:'synthetic'});
    expect(fetch.mock.calls[0][0]).toBe('https://safe.invalid/api/login');
    vi.unstubAllGlobals();
  });
  it('renders AI advice as text, retaining literal HTML without executing it', async () => {
    // Exercise the actual rendering statements against a DOM-like element:
    // assigning innerHTML would throw, so this also detects a sink regression.
    const source=readFileSync(new URL('../../public/js/parent-dashboard.js',import.meta.url),'utf8');
    const block=source.match(/if \(adviceEl && data.advice\) \{([\s\S]*?)\n    \}/)[1];
    const element={style:{},set innerHTML(_){throw new Error('HTML sink used');}};
    const advice='<img src=x onerror=alert(1)>';
    new Function('adviceEl','data',block)(element,{advice});
    expect(element.textContent).toBe(advice);expect(element.style.whiteSpace).toBe('pre-wrap');
  });
});
