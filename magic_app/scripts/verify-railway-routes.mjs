import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const routerSource = fs.readFileSync(path.join(root, 'api/router.js'), 'utf8');

const routesBlock = routerSource.match(/const ROUTES = \{([\s\S]*?)\};/);
if (!routesBlock) {
  console.error('FAIL: ROUTES block not found');
  process.exit(1);
}

const routeKeys = [...routesBlock[1].matchAll(/^\s+(?:'([^']+)'|(\w+))\s*[:,]/gm)]
  .map((m) => m[1] || m[2])
  .filter(Boolean);

const handlersDir = path.join(root, 'api/_handlers');
const handlerFiles = fs.readdirSync(handlersDir).filter((f) => f.endsWith('.js'));

console.log(`Route keys: ${routeKeys.length}`);
console.log(`Handler files: ${handlerFiles.length}`);

if (handlerFiles.length !== 28) {
  console.error(`FAIL: expected 28 handlers, got ${handlerFiles.length}`);
  process.exit(1);
}

if (routeKeys.length < 34) {
  console.error(`FAIL: expected 34 route aliases in ROUTES, got ${routeKeys.length}`);
  process.exit(1);
}

console.log('OK: 28 handlers, 34 route aliases');
