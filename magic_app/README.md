# 🐱 Люцик — Герой Сказок

**Версия:** 4.1.0  
**Дата актуализации:** 23 июня 2026 г.

ИИ-помощник для детей 3–14 лет: голосовое общение, терапевтические сказки, игры, родительский кабинет.

---

## 📋 Технический паспорт

| Параметр | Значение |
|----------|----------|
| Версия | **4.1.0** |
| Стек | Vanilla JS (ES Modules), PWA, Vercel Serverless |
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

## ☁️ Деплой на Vercel

### Важно: Root Directory

В [Vercel Dashboard](https://vercel.com) → Project → **Settings** → **General** → **Root Directory** должно быть:

```
magic_app
```

Если указана корневая папка репозитория — деплой падает с ошибкой (нет `package.json` и `api/`).

### Деплой

```powershell
cd magic_app

# 1. Заполните .env.local (ключи без пробелов и переносов строк!)
# 2. Загрузите переменные на Vercel:
npm run deploy:env

# 3. Деплой:
npm run deploy
```

### Проверка после деплоя

Откройте в браузере:

```
https://geroy-skazki.vercel.app/api/health
```

Должно быть:
```json
{ "ok": true, "env": { "jwt": true, "yandexKey": true, "yandexFolder": true } }
```

Если `yandexKey: false` — ключ не загружен на Vercel. Запустите `npm run deploy:env` ещё раз.

### Если журнал деплоя не открывается

Через терминал (после `npm i -g vercel` и `vercel login`):

```powershell
cd magic_app
vercel logs geroy-skazki --prod
vercel inspect <url-последнего-деплоя>
```

Или: Dashboard → Deployments → три точки → **Redeploy** → смотрите статус **Building** / **Ready** / **Error**.

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
