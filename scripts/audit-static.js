const fs = require('fs');
const path = require('path');

const root = 'magic_app/public';
const htmlFiles = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.html?$/i.test(e.name)) htmlFiles.push(p);
  }
}
walk(root);

const broken = [];
const re = /<(?:a|link|script|img|source)\s[^>]*(?:href|src)=["']([^"'#]+)["']/gi;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  let m;
  const seen = new Set();
  while ((m = re.exec(html))) {
    let u = m[1].trim();
    if (!u || /^(https?:|mailto:|tel:|data:|\/\/)/i.test(u) || u.startsWith('{')) continue;
    u = u.split('?')[0].split('#')[0];
    if (!u || seen.has(u)) continue;
    seen.add(u);
    const target = u.startsWith('/')
      ? path.join(root, u.replace(/^\//, ''))
      : path.normalize(path.join(path.dirname(file), u));
    if (!fs.existsSync(target) && !fs.existsSync(target + '.html')) {
      broken.push({ file: path.relative('.', file).replace(/\\/g, '/'), href: u });
    }
  }
}

const envUsed = new Set();
const secrets = [];
function walkJs(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(e.name)) continue;
      walkJs(p);
    } else if (/\.(js|ts|mjs|cjs)$/i.test(e.name)) {
      const t = fs.readFileSync(p, 'utf8');
      for (const mm of t.matchAll(/process\.env\.([A-Z0-9_]+)/g)) envUsed.add(mm[1]);
      const rel = path.relative('.', p).replace(/\\/g, '/');
      if (/sk-[A-Za-z0-9]{20,}/.test(t) || /AIza[0-9A-Za-z\-_]{20,}/.test(t)) {
        secrets.push({ file: rel, kind: 'possible-api-key' });
      }
      if (/admin-token-v5\.0\.5/.test(t)) secrets.push({ file: rel, kind: 'default-admin-token' });
      if (/admintuti13/.test(t)) secrets.push({ file: rel, kind: 'default-admin-password' });
      if (/dev-secret-key/.test(t)) secrets.push({ file: rel, kind: 'dev-jwt-fallback' });
    }
  }
}
walkJs('magic_app');

// CORS / rate-limit presence
const cors = fs.existsSync('magic_app/api/_middleware/cors.js');
const rate = fs.existsSync('magic_app/api/_middleware/rate-limit.js');
const loginSrc = fs.readFileSync('magic_app/api/_handlers/login.js', 'utf8');
const registerSrc = fs.readFileSync('magic_app/api/_handlers/register.js', 'utf8');
const corsSrc = cors ? fs.readFileSync('magic_app/api/_middleware/cors.js', 'utf8') : '';

const out = {
  links: { htmlFiles: htmlFiles.length, brokenCount: broken.length, broken },
  envUsed: [...envUsed].sort(),
  secrets,
  security: {
    corsFile: cors,
    rateLimitFile: rate,
    loginUsesRateLimit: /checkRateLimit|rate-limit/.test(loginSrc),
    registerUsesRateLimit: /checkRateLimit|rate-limit/.test(registerSrc),
    corsAllowsOrigin: /Access-Control-Allow-Origin|setCors/.test(corsSrc)
  }
};

fs.writeFileSync('audit-static.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
