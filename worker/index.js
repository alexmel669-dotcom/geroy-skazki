// Worker: geroy-skazki-api2 v6.2.0
// Статика: Cloudflare Pages
// API: Render (geroy-skazki.onrender.com)

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie'
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Статика → Cloudflare Pages
    if (!path.startsWith('/api/')) {
      return fetch(request);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Все API-запросы → Render
    const renderUrl = 'https://geroy-skazki.onrender.com' + path + url.search;

    try {
      const res = await fetch(renderUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      const headers = new Headers(res.headers);
      Object.entries(corsHeaders()).forEach(([k, v]) => {
        if (!headers.has(k)) headers.set(k, v);
      });

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers
      });
    } catch (e) {
      return Response.json({
        error: 'Render unavailable',
        detail: e.message
      }, { status: 502, headers: corsHeaders() });
    }
  }
};
