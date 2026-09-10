# Деплой «Герой Сказок»

## Актуальная схема (используется в проде, geroy-skazki.ru)

```
Браузер → Cloudflare Pages (статика: magic_app/public/)
        → Cloudflare Worker "geroy-skazki-api2" (worker/index.js)
             — раздаёт статику как есть
             — все запросы /api/* проксирует на Render
        → Render: magic_app/server.js (Node.js, статика + api/router.js)
        → Upstash Redis (данные пользователей/детей/чатов)
```

- **Статика** (`magic_app/public/`) публикуется на **Cloudflare Pages**.
- **API** (`magic_app/api/`, через `magic_app/server.js`) крутится на **Render**
  как обычный Node-сервис. Команда старта — `npm start` (= `node server.js`),
  порт берётся из `process.env.PORT` (Render подставляет сам).
- **Cloudflare Worker** `geroy-skazki-api2` (`worker/index.js`, конфиг —
  `wrangler.toml`) стоит перед обоими и раздаёт единый домен `geroy-skazki.ru`:
  всё, что начинается с `/api/`, уходит на Render, остальное — на Cloudflare Pages.

### Обязательные переменные окружения (Render → Environment)

```
JWT_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_API_TOKEN
KV_REST_API_URL
KV_REST_API_TOKEN
DEEPSEEK_API_KEY
YANDEX_API_KEY
YANDEX_FOLDER_ID
```

Без `JWT_SECRET` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_API_TOKEN` /
`KV_REST_API_URL` / `KV_REST_API_TOKEN` сервер теперь **не запускается** в
production-режиме (проверка добавлена в `magic_app/server.js` — см.
`SECURITY_FIXES.md`). Раньше при их отсутствии код тихо подставлял
захардкоженные значения — это была дыра безопасности.

Опционально, для реальной верификации промокодов психологов/специалистов/
интернатов без ручной генерации кода на каждого (см. `SECURITY_FIXES.md`,
пункт про `verifyPromoCode`):

```
PSY_PROMO_HASH
SPEC_PROMO_HASH
ORPH_PROMO_HASH
```

### Проверка после деплоя

```
https://geroy-skazki.ru/
https://geroy-skazki.ru/api/health
```

`/api/health` должен вернуть `"ok": true`.

---

## Архивные конфиги (не используются)

В репозитории остались конфиги для платформ, которые **не обслуживают**
текущий прод — они не удалены (на случай отката/справки), но актуальными
не являются:

| Файл | Платформа | Статус |
|---|---|---|
| `vercel.json` (корень) | Vercel | Архив |
| `magic_app/vercel.json` | Vercel | Архив |
| `magic_app/netlify.toml` | Netlify | Архив |
| `magic_app/railway.json` | Railway | Архив |

`magic_app/server.js` изначально писался под Railway ("Railway server" в
комментарии в начале файла) — но это обычный Node/`http`-сервер без
Railway-специфичных зависимостей, поэтому он же используется и на Render.

Если понадобится вернуться на Vercel — старая инструкция ниже.

<details>
<summary>Легаси-инструкция: деплой на Vercel</summary>

### Если видите 404 NOT_FOUND

Это значит Vercel не находит файлы проекта. Исправление:

**Вариант A (рекомендуется):** Vercel Dashboard → Project → Settings →
General → Root Directory: `magic_app` → Save → Redeploy.

**Вариант B:** Root Directory оставить пустым (корень репозитория) — в
корне есть `vercel.json`, который указывает на `magic_app/`.

### Команды

```powershell
cd magic_app
npm run deploy:env
npm run deploy
```

</details>

Подробнее об истории проекта: [magic_app/README.md](magic_app/README.md)
