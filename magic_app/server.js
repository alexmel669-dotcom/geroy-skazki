// ============================================================
// Railway server — статика (public/) + API (api/router.js)
// Совместим с Vercel-обработчиками без изменения их логики
// ============================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from './api/router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const REDIRECTS_FILE = path.join(PUBLIC_DIR, '_redirects');
const PORT = Number(process.env.PORT) || 3000;

// Совместимость: handlers/middleware читают VERCEL_URL для CORS
if (process.env.RAILWAY_PUBLIC_DOMAIN && !process.env.VERCEL_URL) {
  process.env.VERCEL_URL = process.env.RAILWAY_PUBLIC_DOMAIN;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};

function loadRedirects() {
  const map = new Map();
  if (!fs.existsSync(REDIRECTS_FILE)) return map;
  const lines = fs.readFileSync(REDIRECTS_FILE, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;
    const [from, to, status] = parts;
    if (status === '200') map.set(from, to);
  }
  return map;
}

const REDIRECTS = loadRedirects();

function parseCookies(cookieHeader = '') {
  const cookies = {};
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

async function readRequestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return null;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks);
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return null;
    }
  }
  return raw;
}

function createReqAdapter(nodeReq, body) {
  const url = new URL(nodeReq.url || '/', `http://${nodeReq.headers.host || 'localhost'}`);
  const query = Object.fromEntries(url.searchParams.entries());
  return {
    method: nodeReq.method,
    url: url.pathname + url.search,
    headers: nodeReq.headers,
    body,
    query,
    cookies: parseCookies(nodeReq.headers.cookie),
    socket: { remoteAddress: nodeReq.socket?.remoteAddress }
  };
}

function createResAdapter(nodeRes) {
  let statusCode = 200;
  const headers = {};
  let sent = false;

  function send(body = '') {
    if (sent) return;
    sent = true;
    nodeRes.writeHead(statusCode, headers);
    nodeRes.end(body);
  }

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    setHeader(name, value) {
      headers[name] = value;
      return res;
    },
    json(data) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json; charset=utf-8';
      }
      send(JSON.stringify(data));
      return res;
    },
    end(data = '') {
      send(typeof data === 'string' ? data : '');
      return res;
    }
  };

  return res;
}

function resolveStaticPath(pathname) {
  if (REDIRECTS.has(pathname)) {
    pathname = REDIRECTS.get(pathname);
  }

  if (pathname === '/' || pathname === '') {
    return path.join(PUBLIC_DIR, 'index.html');
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }

  if (!path.extname(filePath) && fs.existsSync(`${filePath}.html`)) {
    return `${filePath}.html`;
  }

  return null;
}

function serveStatic(pathname, res) {
  const filePath = resolveStaticPath(pathname);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(data);
}

async function handleApi(nodeReq, nodeRes) {
  const body = await readRequestBody(nodeReq);
  const req = createReqAdapter(nodeReq, body);
  const res = createResAdapter(nodeRes);
  await apiRouter(req, res);
}

const server = http.createServer(async (nodeReq, nodeRes) => {
  try {
    const url = new URL(nodeReq.url || '/', `http://${nodeReq.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      await handleApi(nodeReq, nodeRes);
      return;
    }

    serveStatic(pathname, nodeRes);
  } catch (error) {
    console.error('Server error:', error);
    if (!nodeRes.headersSent) {
      nodeRes.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      nodeRes.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Geroy Skazki server listening on port ${PORT}`);
  console.log(`Static: ${PUBLIC_DIR}`);
  console.log(`API routes: via api/router.js`);
});
