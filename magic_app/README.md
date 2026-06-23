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
| STT | Yandex SpeechKit (`/api/speech-to-text`) + Web Speech API fallback |
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

```powershell
cd magic_app

# Обновить секреты (значения из .env.local, не коммитить!)
vercel env rm YANDEX_API_KEY production -y
vercel env add YANDEX_API_KEY production

vercel env rm YANDEX_FOLDER_ID production -y
vercel env add YANDEX_FOLDER_ID production

vercel env rm JWT_SECRET production -y
vercel env add JWT_SECRET production

vercel --prod
```

Проверка: https://geroy-skazki.vercel.app — микрофон, TTS, вход/выход.

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
