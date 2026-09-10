# 🐱 Люцик — Герой Сказок

**Версия:** 6.0.1  
**Дата актуализации:** 12 июля 2026 г.  
**Статус:** Stable

ИИ-помощник для детей 3–14 лет: голосовое общение, терапевтические сказки, игры, родительский кабинет.

---

## 📋 Технический паспорт

| Параметр | Значение |
|----------|----------|
| Версия | **6.0.1** (Stable) |
| Хостинг | Cloudflare Pages (статика) + Worker `geroy-skazki-api2` (API) |
| Домен | `geroy-skazki.ru` |
| AI | DeepSeek Chat API (`/api/generate`) |
| TTS | Yandex SpeechKit (`/api/tts`) — POST body |
| STT | Yandex SpeechKit (`/api/speech-to-text`) — только голос, без текстового ввода |
| Auth | JWT + HttpOnly cookie |
| JWT_SECRET (prod) | 🟢 Настроен на Vercel |
| Yandex SpeechKit | 🟢 Api-Key + folderId |
| Строк кода (JS/HTML/CSS) | ~5 150 |

### API endpoints (14)

| Endpoint | Метод | Назначение |
|----------|-------|------------|
| `/api/login` | POST | Вход |
| `/api/register` | POST | Регистрация (+ дети, возраст 3–14) |
| `/api/logout` | POST | Выход (сброс cookie) |
| `/api/verify-token` | POST | Проверка JWT |
| `/api/generate` | POST | DeepSeek — ответ Люцика |
| `/api/tts` | POST | Yandex TTS → mp3 |
| `/api/speech-to-text` | POST | Yandex STT |
| `/api/analytics` | POST | Сбор событий |
| `/api/log-error` | POST | Лог ошибок клиента |
| `/api/admin/stats` | GET | Статистика (admin) |
| `/api/sync-child-data` | POST | Синхронизация данных ребёнка |
| `/api/user/sync` | POST | Синхронизация профиля |
| `/api/auth/logout` | POST | Legacy logout |

### Исправленные баги (v4.1.0)

- ✅ **Yandex TTS** — кириллица в URL вызывала `Bad Request`; параметры перенесены в **тело POST** (`application/x-www-form-urlencoded`)
- ✅ **Повторный вход** — reload users с диска, корректный сброс cookie при logout
- ✅ **Микрофон VAD** — автостоп через 5 с тишины, макс. 60 с, удержание кнопки
- ✅ **Аватары** — SVG (lucik, mom, dad, kid1, kid2), выбор пола при регистрации
- ✅ **Возраст** — 3–14 лет, страхи «Школа» / «Сверстники»
- ✅ **Dev/User** — `?mode=dev` на localhost, dev-панель
- ✅ **Админка** — `/admin.html`, `/api/admin/stats`

### Известные ограничения

- Пользователи хранятся in-memory + `/tmp` или `.data/` — для prod нужна внешняя БД
- `parent-bg.png` — при отсутствии файла используется `parent-bg.svg`
- Node.js / Vercel CLI должны быть установлены локально для `npm run dev` и деплоя

---

## 🚀 Установка и запуск

```bash
cd magic_app
npm install
cp .env.example .env.local
# Заполните YANDEX_API_KEY, YANDEX_FOLDER_ID, JWT_SECRET, DEEPSEEK_API_KEY
npm run dev
```

Откройте http://localhost:3000

---

## ☁️ Деплой (актуальная схема: Cloudflare Pages + Render)

Прод (`geroy-skazki.ru`) обслуживается так:

- **Статика** (`public/`) — Cloudflare Pages.
- **API** (`api/`, через `server.js`) — Render (обычный Node-сервис,
  команда старта `npm start`).
- Единый домен собирает **Cloudflare Worker** `geroy-skazki-api2`
  (`../worker/index.js`, конфиг `../wrangler.toml`): `/api/*` → Render,
  остальное → Cloudflare Pages.

Обязательные переменные окружения задаются в Render → Environment (не в
Vercel!): `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_API_TOKEN`,
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `DEEPSEEK_API_KEY`, `YANDEX_API_KEY`,
`YANDEX_FOLDER_ID`. Без первых шести сервер теперь не стартует в проде —
подробности и полный чек-лист деплоя в [DEPLOY.md](../DEPLOY.md).

### Проверка после деплоя

```
https://geroy-skazki.ru/api/health
```

Должно быть: `{ "ok": true, ... }`.

### Легаси: Vercel / Netlify / Railway

В репозитории остались конфиги для Vercel (`vercel.json`), Netlify
(`netlify.toml`) и Railway (`railway.json`) — они **не обслуживают** текущий
прод и оставлены только как архив/на случай отката. Инструкция по ним — в
[DEPLOY.md](../DEPLOY.md) (раздел «Легаси-инструкция: деплой на Vercel»).

---

## ✅ Чеклист финального теста

- [ ] Микрофон: запись, автостоп ~5 с тишины
- [ ] TTS: голос Yandex (не только браузер)
- [ ] Вход → Выход → повторный вход
- [ ] Аватары SVG, смена персонажа
- [ ] Регистрация: пол → kid1/kid2
- [ ] Фон на index, app, parent, login, register
- [ ] Нет текстового fallback-ввода
- [ ] Возраст до 14
- [ ] Dev: `http://localhost:3000/app.html?mode=dev`
- [ ] Admin: `/admin.html` (роль admin)

---

## 📁 Структура

```
magic_app/
├── api/              # Vercel serverless
├── public/           # PWA (HTML, js, css, assets)
├── scripts/          # check-syntax.mjs
├── .env.example
└── vercel.json
```
