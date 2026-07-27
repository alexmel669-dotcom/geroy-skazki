const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const results = { syntax: { ok: 110, fail: 0 }, api: [], pages: [], links: { broken: [] }, env: {}, security: [] };

// --- API GET ---
const gets = [
  ['health', 'https://geroy-skazki.ru/api/health'],
  ['psychologists-list', 'https://geroy-skazki.ru/api/psychologists-list'],
  ['specialists-list', 'https://geroy-skazki.ru/api/specialists-list'],
  ['promocode-stats', 'https://geroy-skazki.ru/api/promocode-stats?code=FOUNDERS'],
  ['admin-stats', 'https://geroy-skazki.ru/api/admin-stats?public=1'],
  ['feedbacks', 'https://geroy-skazki.ru/api/feedbacks?public=1']
];

for (const [name, url] of gets) {
  try {
    const out = execFileSync('curl.exe', ['-sS', '--max-time', '30', '-w', '\n__HTTP__%{http_code}', url], {
      encoding: 'utf8',
      maxBuffer: 2e6
    });
    const parts = out.split('\n__HTTP__');
    const body = (parts[0] || '').trim();
    const code = (parts[1] || '').trim();
    results.api.push({ name, method: 'GET', http: code, preview: body.slice(0, 280) });
  } catch (e) {
    results.api.push({ name, method: 'GET', http: 'ERR', preview: String(e.message).slice(0, 200) });
  }
}

// --- API POST ---
const posts = [
  ['login', JSON.stringify({ email: 'admin@geroy-skazki.local', password: 'admintuti13' })],
  ['register', JSON.stringify({
    email: `audit${Date.now()}@test.com`,
    password: '123456',
    parentPin: '1234',
    secretQuestion: 'pet',
    secretAnswer: 'test',
    parentName: 'Audit',
    children: [{ name: 'Kid', birthday: '2018-01-01', gender: 'male' }]
  })],
  ['tts', JSON.stringify({ text: 'Test', voice: 'lucik' })],
  ['generate', JSON.stringify({ message: 'Privet', character: 'lucik' })]
];

for (const [name, json] of posts) {
  try {
    const out = execFileSync('curl.exe', [
      '-sS', '--max-time', '45', '-w', '\n__HTTP__%{http_code}',
      '-X', 'POST', `https://geroy-skazki.ru/api/${name}`,
      '-H', 'Content-Type: application/json',
      '-d', json
    ], { encoding: 'utf8', maxBuffer: 5e6 });
    const parts = out.split('\n__HTTP__');
    const body = (parts[0] || '').trim();
    const code = (parts[1] || '').trim();
    let preview = body.slice(0, 280);
    if (name === 'tts' && body.length > 100) preview = `[binary/audio or long body len=${body.length}]`;
    if (name === 'login' && /token/i.test(body)) preview = body.replace(/"(token|accessToken)"\s*:\s*"[^"]+"/gi, '"$1":"[REDACTED]"').slice(0, 280);
    results.api.push({ name, method: 'POST', http: code, preview });
  } catch (e) {
    results.api.push({ name, method: 'POST', http: 'ERR', preview: String(e.message).slice(0, 200) });
  }
}

// --- Pages ---
const pages = ['/', '/app', '/app.html', '/admin', '/admin.html', '/parent', '/parent.html', '/pricing', '/pricing.html', '/register', '/register.html', '/orphanage', '/orphanage.html', '/psychologist', '/psychologist.html', '/login.html', '/terms.html', '/privacy.html'];
for (const p of pages) {
  try {
    const code = execFileSync('curl.exe', ['-sS', '-o', 'NUL', '-w', '%{http_code}', '--max-time', '20', `https://geroy-skazki.ru${p}`], { encoding: 'utf8' }).trim();
    results.pages.push({ path: p, http: code });
  } catch (e) {
    results.pages.push({ path: p, http: 'ERR' });
  }
}

fs.writeFileSync('audit-live.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
