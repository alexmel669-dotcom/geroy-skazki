#!/usr/bin/env bash
set -Eeuo pipefail
die() { echo "$*" >&2; exit 1; }
[[ $EUID == 0 ]] || die 'Запустите: sudo bash deploy.sh'
. /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || die 'Требуется Ubuntu 24.04'
base=/opt/geroy-skazki
cfg=/etc/geroy-skazki
branch=fix/security-audit-2026
here=$(cd -- "$(dirname -- "$0")" && pwd)
install -d -m 700 "$base" "$cfg"
exec 9>"$base/deploy.lock"
flock -n 9 || die 'Другой запуск уже работает'
if [[ ! -f $cfg/.env ]]; then
  install -m 600 "$here/env.example" "$cfg/.env"
  python3 - "$cfg/.env" <<'PY'
import pathlib, secrets, sys
p = pathlib.Path(sys.argv[1])
p.write_text(''.join(line.replace('GENERATE_ON_INSTALL', secrets.token_hex(32)) for line in p.open()))
PY
  echo "Создан $cfg/.env. Укажите ADMIN_EMAIL и повторите запуск."
  exit 0
fi
chmod 600 "$cfg/.env"
# Не исполняем .env как shell-код. Ограничиваем формат для URI и Compose.
python3 - "$cfg/.env" <<'PY'
from pathlib import Path
import re, sys
values = {}
for line in Path(sys.argv[1]).read_text().splitlines():
    if not line.strip() or line.lstrip().startswith('#'): continue
    key, sep, val = line.partition('=')
    if not sep or key in values or not re.fullmatch(r'[A-Z_]+', key) or not re.fullmatch(r'[A-Za-z0-9_.@+\-]*',val):
        sys.exit('Недопустимая строка .env: проверьте формат по инструкции.')
    values[key] = val
for key in ('REDIS_PASSWORD','KV_REST_API_TOKEN','JWT_SECRET','ADMIN_API_TOKEN','ADMIN_PASSWORD'):
    if not re.fullmatch(r'[A-Za-z0-9_-]{24,}',values.get(key,'')):
        sys.exit(f'Проверьте {key}: нужны 24 или более букв ASCII, цифр, _ или -.')
domain = values.get('PUBLIC_DOMAIN','')
if domain and not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}',domain): sys.exit('Проверьте PUBLIC_DOMAIN.')
if not re.fullmatch(r'[^@ ]+@[^@ ]+\.[^@ ]+', values.get('ADMIN_EMAIL','')): sys.exit('Заполните ADMIN_EMAIL.')
PY
domain=$(sed -n 's/^PUBLIC_DOMAIN=//p' "$cfg/.env")
export GER_APP_URL=http://127.0.0.1:8080
if [[ -n $domain ]]; then GER_APP_URL="https://$domain"; fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates git nginx docker.io docker-compose-v2 curl
systemctl enable --now docker nginx
cd "$base"
repo=${REPO_URL:-https://github.com/alexmel669-dotcom/geroy-skazki.git}
if [[ ! -d source/.git ]]; then
  git clone --single-branch --branch "$branch" "$repo" source
else
  [[ $(git -C source branch --show-current) == "$branch" && -z $(git -C source status --porcelain) ]] || die 'Проверьте ветку и изменения в source'
  git -C source fetch origin "$branch"
  git -C source merge --ff-only FETCH_HEAD
  [[ $(git -C source rev-parse HEAD) == "$(git -C source rev-parse FETCH_HEAD)" ]] || die 'source содержит локальные коммиты'
fi
export APP_REV
APP_REV=$(git -C source rev-parse HEAD)
stage=$(mktemp -d "$base/build.XXXXXX")
trap 'rm -rf -- "$stage"' EXIT
git -C source archive HEAD:magic_app package.json package-lock.json public api server.js | tar -x -C "$stage"
cat >"$stage/Dockerfile" <<'DOCKER'
FROM node:24-bookworm-slim
RUN npm install --global pm2@6
WORKDIR /srv/app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && mkdir .data && chown node:node .data
COPY . .
USER node
CMD ["pm2-runtime","start","server.js","--name","geroy"]
DOCKER
docker build --pull -t "geroy-app:$APP_REV" "$stage"
# Хэш Redis ACL можно передать как аргумент, открытый пароль в argv не попадает.
export REDIS_HASH
REDIS_HASH=$(python3 - "$cfg/.env" <<'PY'
import hashlib, sys
password = next(x.rstrip('\n').split('=',1)[1] for x in open(sys.argv[1]) if x.startswith('REDIS_PASSWORD='))
print(hashlib.sha256(password.encode()).hexdigest())
PY
)
cat > compose.yaml <<'YAML'
services:
  redis:
    image: redis:7.4-alpine
    command: ["redis-server", "--appendonly", "yes", "--user", "default", "on", "#${REDIS_HASH:?}", "~*", "&*", "+@all"]
    volumes: ["redis-data:/data"]
    networks: [storage]
    restart: unless-stopped
  bridge:
    image: hiett/serverless-redis-http@sha256:5b0bb9239fce53abf87b2018a7a0deb9ec7bd900c5360738fe5fbeeb426f9150
    environment:
      SRH_MODE: env
      SRH_TOKEN: ${KV_REST_API_TOKEN:?}
      SRH_CONNECTION_STRING: redis://:${REDIS_PASSWORD:?}@redis:6379
    depends_on: [redis]
    networks: [storage]
    restart: unless-stopped
  app:
    image: geroy-app:${APP_REV:?}
    environment:
      NODE_ENV: production
      PORT: "3000"
      APP_URL: ${GER_APP_URL:?}
      KV_REST_API_URL: http://bridge:80
      KV_REST_API_TOKEN: ${KV_REST_API_TOKEN:?}
      ADMIN_EMAIL: ${ADMIN_EMAIL:?}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?}
      ADMIN_API_TOKEN: ${ADMIN_API_TOKEN:?}
      JWT_SECRET: ${JWT_SECRET:?}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      YANDEX_API_KEY: ${YANDEX_API_KEY:-}
      YANDEX_FOLDER_ID: ${YANDEX_FOLDER_ID:-}
    volumes: ["analytics:/srv/app/.data"]
    ports: ["127.0.0.1:3000:3000"]
    depends_on: [bridge]
    networks: [web, storage]
    restart: unless-stopped
networks:
  web: {}
  storage: {internal: true}
volumes:
  redis-data: {}
  analytics: {}
YAML
stack=(docker compose --env-file "$cfg/.env" -p geroy -f "$base/compose.yaml")
"${stack[@]}" config --quiet
"${stack[@]}" up -d
# Проверяем и GET страницы, и полный путь Node → HTTP-шлюз → Redis.
for ((i=0; i<45; i++)); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/app.html -o /dev/null &&
     "${stack[@]}" exec -T app node --input-type=module -e '
       import {Redis} from "@upstash/redis";
       const db = new Redis({url:process.env.KV_REST_API_URL,token:process.env.KV_REST_API_TOKEN,retry:false});
       if (await db.ping() !== "PONG" || await db.eval("return 1", [], []) !== 1) process.exit(1);
     '; then break; fi
  sleep 2
done
((i < 45)) || die 'Проверка приложения или Redis не прошла. См. docker logs geroy-app-1'
site=/etc/nginx/sites-available/geroy-preview
cat >"$site" <<'NGINX'
server {
    listen 127.0.0.1:8080;
    server_name localhost;
    client_max_body_size 16m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 120s;
    }
}
NGINX
ln -sfn "$site" /etc/nginx/sites-enabled/geroy-preview
nginx -t
systemctl reload nginx
curl -fsS --max-time 5 http://127.0.0.1:8080/app.html -o /dev/null
if [[ -n $domain ]]; then
  apt-get install -y certbot
  install -d /var/www/geroy-acme
  public=/etc/nginx/sites-available/geroy-public
  cat >"$public" <<NGINX
server {
    listen 80;
    server_name $domain;
    location ^~ /.well-known/acme-challenge/ { root /var/www/geroy-acme; }
    location / { return 301 https://$domain\$request_uri; }
}
NGINX
  ln -sfn "$public" /etc/nginx/sites-enabled/geroy-public
  nginx -t
  systemctl reload nginx
  email=$(sed -n 's/^ADMIN_EMAIL=//p' "$cfg/.env")
  certbot certonly --webroot -w /var/www/geroy-acme --non-interactive --agree-tos \
    --keep-until-expiring --cert-name "$domain" -d "$domain" -m "$email"
  tls=/etc/nginx/sites-available/geroy-tls
  cat >"$tls" <<NGINX
server {
    listen 443 ssl;
    server_name $domain;
    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
    client_max_body_size 16m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_read_timeout 120s;
    }
}
NGINX
  ln -sfn "$tls" /etc/nginx/sites-enabled/geroy-tls
  install -d /etc/letsencrypt/renewal-hooks/deploy
  printf '%s\n' '#!/bin/sh' 'systemctl reload nginx' >/etc/letsencrypt/renewal-hooks/deploy/geroy-nginx
  chmod 755 /etc/letsencrypt/renewal-hooks/deploy/geroy-nginx
  nginx -t
  systemctl reload nginx
  systemctl enable --now certbot.timer
  curl -fsS --resolve "$domain:443:127.0.0.1" "https://$domain/app.html" -o /dev/null
  echo "Публичный адрес: https://$domain"
fi
echo "Готово. Версия $APP_REV. Вход через SSH-туннель на порт 8080."
