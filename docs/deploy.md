# Прод feral.rip

Сервер и всё, что нужно, чтобы его починить или переехать снова.

## Что где

|        |                                                                         |
| ------ | ----------------------------------------------------------------------- |
| Хост   | `38.180.44.243`, Ubuntu 24.04.4 LTS, 2 vCPU / 2 ГБ RAM / 30 ГБ          |
| SSH    | `ssh feral` (алиас в `~/.ssh/config`), ключ `~/.ssh/feral_rip_ed25519`  |
| Код    | `/opt/feral.rip`, владелец `feral:feral`, ветка `master`                |
| Сервис | `feral-web.service` → `next start` на `127.0.0.1:3000`                  |
| Прокси | nginx, конфиг `/etc/nginx/sites-available/feral.rip`                    |
| TLS    | Let's Encrypt, ECDSA, DNS-01 через Cloudflare                           |
| Redis  | локальный, `redis://127.0.0.1:6379`                                     |
| DNS    | Cloudflare, зона `feral.rip`, A-запись **DNS only** (без проксирования) |

Переехали со SmartApe (`109.238.92.117`) 7 сентября 2026.

## Вход

Пароль root отключён, вход только по ключу:

```bash
ssh feral
```

Настройки в `/etc/ssh/sshd_config.d/99-hardening.conf`. Имя `99-` не случайно:
cloud-init кладёт свой `50-cloud-init.conf` с `PasswordAuthentication yes`, и без
файла с большим номером он перебивает основной конфиг.

## Обновить сайт

```bash
ssh feral
cd /opt/feral.rip
git fetch --depth 1 origin master && git reset --hard origin/master
pnpm install --frozen-lockfile
INIT_CWD=$PWD NODE_OPTIONS='--max-old-space-size=3584 --disable-warning=DEP0040' \
  pnpm exec next build --webpack
NODE_OPTIONS='--experimental-json-modules --disable-warning=DEP0040' node ./scripts/postbuild.mjs
chown -R feral:feral /opt/feral.rip
systemctl restart feral-web
```

**Почему не `pnpm build`.** Скрипт `build` в `package.json` сам выставляет
`NODE_OPTIONS` через `cross-env` и затирает внешний, а на 2 ГБ RAM сборка без
поднятого лимита heap не проходит. Поэтому `next build` вызывается напрямую.

**Про память.** На сервере включён swap-файл на 4 ГБ (`/swapfile`,
`vm.swappiness=10`) — он нужен именно под сборку, в обычной работе приложение
держится в пределах 500 МБ.

## Диагностика

```bash
systemctl status feral-web
journalctl -u feral-web -f
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/blog/feral/compendium
nginx -t && systemctl reload nginx
redis-cli ping
```

## Сертификат

Выпущен через DNS-01, чтобы не зависеть от того, куда указывает A-запись —
так его удалось получить **до** переезда домена и не ронять HTTPS ни на секунду.

```bash
certbot certificates
certbot renew --dry-run
```

Токен Cloudflare для certbot лежит в `/root/.secrets/cloudflare.ini` (права 600).
Локальная копия — `~/.config/infra-ads/cloudflare-feralrip.env`.
После продления nginx перезагружается хуком
`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`.

`nginx` здесь версии 1.24, поэтому TLS-слушатели описаны старым синтаксисом
`listen 443 ssl http2;` — директива `http2 on;` появилась только в 1.25.

## Известные хвосты

- `Dockerfile` в корне репозитория для прода **не годится**: `CMD ["pnpm","start"]`,
  а `start` — это `next dev`. Мы деплоим не им, но если кто-то соберёт образ —
  получит dev-сервер.
- `server.js` в корне — мусор от upstream (express, раздающий `build/index.html`),
  к Next отношения не имеет.
- `output: 'standalone'` в `next.config.js` не включён. Включить — деплой ужмётся
  примерно с 1 ГБ до 200 МБ.
- Секреты приложения в `/opt/feral.rip/.env.local` заполнены минимально: сайт,
  Redis. NextAuth, GitHub OAuth и Warcraft Logs не настроены — соответствующие
  API-маршруты работать не будут.
