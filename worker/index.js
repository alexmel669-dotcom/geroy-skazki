export default {
  async fetch(request) {
    const url = new URL(request.url);

    // API-запросы обрабатываем здесь
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/health') {
        return Response.json({
          ok: true,
          version: '5.9.1',
          worker: true
        });
      }

      // Остальные API — прокси на Vercel
      const vercelUrl = 'https://geroy-skazki.vercel.app' + url.pathname + url.search;
      return fetch(vercelUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
    }

    // Статика — отдаём из Pages
    return fetch(request);
  }
};
