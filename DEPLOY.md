# Деплой «Герой Сказок»

## Если видите 404 NOT_FOUND

Это значит Vercel не находит файлы проекта. Исправление:

### Вариант A (рекомендуется)

Vercel Dashboard → Project → **Settings** → **General** → **Root Directory**:

```
magic_app
```

Сохранить → **Redeploy** последний деплой.

### Вариант B

Root Directory оставить пустым (корень репозитория).  
В корне уже есть `vercel.json`, который указывает на `magic_app/`.

---

## После деплоя — проверка

```
https://geroy-skazki.vercel.app/
https://geroy-skazki.vercel.app/api/health
```

`/api/health` должен вернуть `"ok": true`.

## Команды

```powershell
cd magic_app
npm run deploy:env
npm run deploy
```

Подробнее: [magic_app/README.md](magic_app/README.md)
