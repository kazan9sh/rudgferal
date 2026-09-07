# Discord-бот для гайда «Сила Зверя»

Документ описывает бота, который следит за чужими версиями гайда по фералу,
забирает оттуда картинки и пересобирает наш `data/blog/feral/compendium.mdx`,
**не ломая текущий формфактор** (MDX + наши компоненты).

Ниже: что бот делает, как его завести, где взять токен, как выдать права и как
поднять на сервере.

---

## 1. Что делает бот

Три независимые части — их можно включать по отдельности.

### 1.1. Слежение за источниками

Бот периодически (cron, по умолчанию раз в сутки) сравнивает наш гайд с чужими версиями:

| Источник                                                      | Что берём                                  | Как                                            |
| ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| `dreamgrove/dreamgrove` → `data/blog/feral/compendium.mdx`    | текст, тринкеты, APL, чары/химия           | GitHub API (`/repos/{o}/{r}/commits?path=...`) |
| `dreamgrove/dreamgrove` → `data/blog/feral/kr/compendium.mdx` | правки, которые доехали только в KR-ветку  | то же                                          |
| `dreamgrove/dreamgrove` → `data/dungeons`, `data/raids`       | новые подземелья и рейды сезона            | листинг `contents/`                            |
| `public/static/images/**` в upstream                          | картинки, на которые ссылается новый текст | `raw.githubusercontent.com`                    |

Логика диффа: держим в Redis (он уже есть в проекте, `REDIS_URL`) последний
просмотренный SHA по каждому пути. При новом SHA — тянем diff и шлём в Discord
карточку «что изменилось», а не молча коммитим.

### 1.2. Скачивание картинок

Важное наблюдение с практики: **в тексте английского компендиума картинок нет вообще** —
ни одной markdown-картинки и ни одного `src=`. Всё визуальное там идёт через
`<Wowhead>`-иконки, а баннеры разделов (`/static/images/guide-sections/*.png`) —
наша собственная выдумка, в upstream их не существует.

Поэтому искать картинки по тексту гайда бесполезно. Бот сравнивает **дерево**
`public/static/images` целиком (GitHub Trees API, `recursive=1`) и добирает то,
чего у нас нет:

1. Получить дерево upstream, отфильтровать по префиксу и расширениям.
2. Файлы, которые уже лежат у нас, **не трогать вообще** — часть из них
   локализована под русский гайд, затирать их английскими нельзя.
3. Скачать недостающие, проверив content-type и размер (потолок 10 МБ).
4. Разложить по тем же путям, что в upstream.

Перезапись включается только явным флагом `overwrite`.

Первый прогон на реальном upstream дал 260 файлов в дереве, из них 46 недостающих
(2.3 МБ) — картинки восьми подземелий сезона 2 и рейда The Venomous Abyss.

### 1.3. Что бот НЕ делает: подстановка текста

Здесь важное ограничение, которое всплыло при разборе файлов, и его надо
проговорить прямо.

Наш гайд — **русский и реструктурированный**, а не построчный перевод. Заголовки
верхнего уровня не совпадают с upstream:

| upstream (EN)                           | у нас (RU)                            |
| --------------------------------------- | ------------------------------------- |
| `# News`                                | `# Новости`                           |
| `# Rotation` + `# Talents`              | `# Таланты и ротация` (слиты)         |
| `## Stat Priority` (внутри Gearing)     | `# Характеристики` (отдельный раздел) |
| `## Gems and Enchants` (внутри Gearing) | `# Чары` (отдельный раздел)           |
| `# Consumables`                         | `# Химия`                             |
| `# Miscellaneous`                       | `# Дополнительно`                     |
| `# Feral Druid Abbreviations`           | `# Словарик ферала`                   |
| —                                       | `# Полезные ссылки` (только у нас)    |

Из этого следует: **автоматически «сделать актуальный гайд» копированием нельзя** —
между источником и целью лежит перевод. Механическая подстановка английских
абзацев в русский файл сломает гайд.

Поэтому бот работает как ассистент по расхождениям:

1. Режет оба файла на секции (заголовки 1–3 уровня), матчит их по явному маппингу
   `SECTION_MAP` в `bot/discord/config.ts` — не по позиции.
2. Считает текстовые блоки в каждой секции, игнорируя JSX и картинки.
3. Показывает в Discord, какие наши разделы затронуты и насколько разошлись,
   плюс список коммитов upstream с даты нашей последней правки.
4. Отдельно показывает недостающие подземелья и рейды.

Перевод и правка остаются за человеком. Если захочется автоматизировать и это —
точка подключения одна: между шагом 2 и формированием PR, туда встанет вызов
модели-переводчика. Отдельное решение, отдельный ключ, отдельные деньги.

**Бот не пушит в master.** Максимум — скачивает картинки в рабочую копию.

---

## 2. Заводим бота в Discord

### 2.1. Создать приложение

1. Открыть <https://discord.com/developers/applications>, войти своим аккаунтом.
2. **New Application** → имя (например `Сила Зверя`) → согласиться с ToS → **Create**.
3. Вкладка **General Information**: скопировать **Application ID** — это `DISCORD_CLIENT_ID`.

### 2.2. Взять токен (это и есть «API-ключ»)

1. Вкладка **Bot** слева.
2. **Reset Token** → подтвердить → токен показывается **один раз**, скопировать сразу.
   Это `DISCORD_BOT_TOKEN`.
3. Если проморгал — жми Reset Token ещё раз, старый умрёт.

> Токен = полный доступ к боту. В git не коммитить никогда. Если утёк — Reset Token,
> старый мгновенно инвалидируется. Формат токена узнаваем, GitHub его детектит и
> Discord автоматически отзывает такие токены при пуше в публичный репозиторий.

### 2.3. Настройки на вкладке Bot

- **Public Bot** — выключить, если бот только для нашего сервера.
- **Requires OAuth2 Code Grant** — выключить.
- **Privileged Gateway Intents**:
  - `SERVER MEMBERS INTENT` — не нужен;
  - `PRESENCE INTENT` — не нужен;
  - `MESSAGE CONTENT INTENT` — **включить только** если бот должен читать текст
    обычных сообщений. Для slash-команд и постинга он не нужен — оставь выключенным.

### 2.4. Права

Минимально достаточный набор:

- View Channels
- Send Messages
- Send Messages in Threads
- Create Public Threads (если постим гайд форумными постами)
- Embed Links
- Attach Files
- Read Message History
- Manage Messages — только если бот редактирует/пинит старые посты гайда

Administrator не выдавать.

### 2.5. Пригласить на сервер

**OAuth2 → URL Generator**:

- Scopes: `bot` и `applications.commands`
- Bot Permissions: отметить пункты из 2.4

Внизу появится ссылка вида:

```
https://discord.com/api/oauth2/authorize?client_id=<APPLICATION_ID>&permissions=<число>&scope=bot%20applications.commands
```

Для нашего приложения (`1546449794984190002`) с правами из 2.4 ссылка уже посчитана —
`permissions=309237771264`:

```
https://discord.com/api/oauth2/authorize?client_id=1546449794984190002&permissions=309237771264&scope=bot%20applications.commands
```

Открыть её, выбрать сервер (нужны права **Manage Server** на этом сервере), подтвердить.

Дальше на самом сервере: дать боту доступ в нужный канал через права канала —
глобальные права роли не всегда перекрывают запрет на уровне категории.

---

## 3. Переменные окружения

Добавить в `.env.local` (и в секреты на сервере), в `.env.local.example` — только имена:

```bash
# Discord
DISCORD_BOT_TOKEN=          # вкладка Bot → Reset Token
DISCORD_CLIENT_ID=          # General Information → Application ID
DISCORD_GUILD_ID=           # ПКМ по серверу → Copy Server ID (нужен режим разработчика)
DISCORD_CHANNEL_ID=         # канал, куда бот шлёт отчёты о диффах
DISCORD_ADMIN_ROLE_ID=      # роль, которой разрешены команды бота

# Источники гайдов
GUIDE_UPSTREAM_REPO=dreamgrove/dreamgrove
GUIDE_UPSTREAM_BRANCH=master
GITHUB_TOKEN=               # PAT с правами repo, чтобы бот открывал PR и не упирался в rate limit

# Уже есть в проекте
REDIS_URL=redis://localhost:6379
```

**Copy Server ID**: Settings → Advanced → Developer Mode → ON, затем ПКМ по
серверу/каналу → Copy Server ID / Copy Channel ID.

---

## 4. Куда положить код

В проекте уже есть каталог `bot/` (там Telegram-часть для гостевой книги).
Discord-бот кладём рядом, чтобы не плодить сущности:

```
bot/
  config.ts          # уже есть — дописать validateDiscordConfig()
  db.ts              # уже есть — Redis-клиент, переиспользуем
  telegram.ts        # уже есть
  discord/
    client.ts        # инициализация discord.js, логин, регистрация команд
    commands.ts      # slash-команды и рендер embed-отчётов
    config.ts        # env + маппинг секций EN → RU
    upstream.ts      # GitHub API: коммиты, каталоги, дерево файлов
    mdx.ts           # разбор компендиума на секции, защита JSX-блоков
    images.ts        # скачивание картинок без затирания наших
    sync.ts          # сверка гайда и синк картинок
    cli.ts           # то же самое из терминала, без Discord
```

Библиотека — `discord.js` v14 (`pnpm add discord.js`). Slash-команды регистрируются
через REST на конкретную гильдию (`Routes.applicationGuildCommands`) — обновляются
мгновенно, в отличие от глобальных.

Команды:

| Команда                | Что делает                                            |
| ---------------------- | ----------------------------------------------------- |
| `/guide-check`         | показать, чем upstream отличается от нас прямо сейчас |
| `/guide-images`        | скачать недостающие картинки, отчитаться списком      |
| `/guide-sync [секция]` | собрать PR с обновлением секции (или всех)            |

---

## 5. Как поднять на сервере

Бот — **отдельный долгоживущий процесс**, не часть Next.js. Держать его надо рядом
с сайтом, но запускать самостоятельно: он использует gateway-соединение, а не HTTP.

### Вариант A: systemd (простой VPS)

`/etc/systemd/system/feral-discord-bot.service`:

```ini
[Unit]
Description=Feral guide Discord bot
After=network-online.target redis-server.service
Wants=network-online.target

[Service]
Type=simple
User=feral
WorkingDirectory=/opt/feral.rip
EnvironmentFile=/etc/feral.rip/bot.env
ExecStart=/usr/bin/pnpm bot:discord
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/feral.rip/public/static/images

[Install]
WantedBy=multi-user.target
```

```bash
chmod 600 /etc/feral.rip/bot.env    # токен лежит только тут
systemctl daemon-reload
systemctl enable --now feral-discord-bot
journalctl -u feral-discord-bot -f
```

### Вариант B: Docker

```dockerfile
FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "bot:discord"]
```

```bash
docker run -d --name feral-bot --restart=always \
  --env-file /etc/feral.rip/bot.env \
  -v /opt/feral.rip/public/static/images:/app/public/static/images \
  feral-bot:latest
```

Секреты — через `--env-file` или ESO/OpenBao, не через `-e` в командной строке
(видно в `ps`) и не в образе.

### Проверка, что живой

1. `journalctl -u feral-discord-bot -n 50` — должно быть `Logged in as ...`.
2. В Discord бот в списке участников со статусом «в сети».
3. `/guide-check` в канале отвечает.

Типовые грабли:

- **бот онлайн, но команды не видны** — не выдан scope `applications.commands`,
  переприглашать по новой OAuth2-ссылке;
- **`Used disallowed intents`** — в коде запрошен privileged intent, который
  не включён на вкладке Bot;
- **бот молчит в канале** — права канала перекрывают права роли;
- **401 Unauthorized** — токен протух после Reset или в env попал перевод строки.

---

## 6. Лимиты Discord, которые упрутся при постинге гайда

Наш компендиум — 640 строк, целиком в одно сообщение не влезет.

- обычное сообщение — **2000 символов**;
- описание embed — 4096 символов, суммарно по всем embed в сообщении — 6000,
  не более 10 embed на сообщение;
- размер вложения зависит от уровня буста сервера (базово ~10 МБ,
  выше на бустнутых) — баннеры разделов лучше держать ссылками на feral.rip,
  а не заливать файлами;
- rate limit: ~5 сообщений в 5 секунд на канал; при массовом постинге
  discord.js сам ретраит, но пачку постов надо разносить по времени.

Практичный формфактор для Discord: **форумный канал**, один пост на секцию гайда
(`Новости`, `Таланты и ротация`, `Характеристики`, …), бот редактирует свои
прошлые посты вместо создания новых. Так гайд в Discord и на сайте остаются
одной структурой, и история правок не засоряет канал.
