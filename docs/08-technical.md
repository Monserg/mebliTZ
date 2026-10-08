# Технічний опис

## Архітектура

- **Cloudflare Pages** віддає статичні файли з `site/`.
- **Pages Functions** (`functions/`) — серверна частина: API адмінки, видача
  контенту і фото, пересилання заявок у Telegram.
- **Cloudflare KV** (прив'язка `CONTENT`) — єдине сховище.
- Без фреймворків, без збирача: HTML/CSS/JS як є. Калькулятор (`site/main.js`)
  рахує з того самого прайсу, що віддає `/api/content`.

### Ключі в KV

| Ключ | Що | Коли з'являється |
|---|---|---|
| `content:prices` | `{groups:[{title, items:[{name, price}]}]}` | після першого збереження прайсу |
| `content:photos` | `{gallery:[{image, caption}]}` | після першого збереження фото |
| `photo:<файл>` | бінарний файл фото, metadata `{type}` | при завантаженні фото |
| `auth` | `{login, salt, hash, iter}` (PBKDF2-SHA256) | після першої зміни пароля |
| `sess:<токен>` | `{login, created, seen}`, TTL 7 днів; видаляється, якщо `seen` старіше 5 хв | при вході; `seen` оновлюється раз на хвилину |
| `fail:<IP>` | лічильник невдалих входів, TTL 15 хв | при невдалому вході |

Поки `content:*` немає, `/api/content` віддає початкові файли
`site/content/prices.json` і `site/content/photos.json`.

## Файли

```
vacancy-tz-zbirka-mebliv/
├── site/                      ← публікується на Cloudflare Pages
│   ├── index.html             сторінка (тексти, контакти — тут)
│   ├── styles.css             дизайн «Теплий майстер», структура «Ціни-перший», калькулятор
│   ├── main.js                прайс/фото з /api/content, калькулятор, форма заявки, демо-режим
│   ├── menu.js                бокове меню розділів на телефоні
│   ├── plan/index.html        план сайту (вимога ТЗ), той самий styles.css
│   ├── content/prices.json    початковий прайс
│   ├── content/photos.json    початкові фото (порожньо = заглушки)
│   ├── robots.txt             закриває /admin і /api від пошуковиків
│   └── admin/                 адмінка: index.html, admin.css, admin.js
├── functions/                 ← серверна частина (Pages Functions)
│   ├── api/content.js         GET  /api/content       прайс + фото для сайту
│   ├── api/lead.js            POST /api/lead          заявка → Telegram
│   ├── photos/[[path]].js     GET  /photos/<файл>     фото з KV
│   └── api/admin/
│       ├── _middleware.js     перевірка сесії і заголовка X-Admin
│       ├── login.js           POST /api/admin/login   {login, password}
│       ├── logout.js          POST /api/admin/logout
│       ├── me.js              GET  /api/admin/me
│       ├── prices.js          PUT  /api/admin/prices  {groups}
│       ├── photos.js          PUT  /api/admin/photos  {gallery}; видаляє з KV фото, яких у галереї вже немає
│       ├── upload.js          POST /api/admin/upload  multipart "file" → {url}
│       └── password.js        POST /api/admin/password {current, next}
├── lib/util.js                паролі (PBKDF2), сесії, читання контенту
├── scripts/build-demo.py      збирає демо-файл в один HTML → dist/
├── scripts/tg-check.sh        перевірка Telegram-бота: chat_id, тестове повідомлення
├── PLAN.md                    план сайту (мета, аудиторія, структура)
├── wrangler.toml              налаштування Cloudflare (id KV вписати!)
├── package.json               npm run dev / deploy / secret
├── .dev.vars                  тестовий логін/пароль для локального запуску (не в git)
├── CLAUDE.md                  підказки для Claude
└── .gitignore
```

## Локальний запуск (з адмінкою)

Потрібен Node.js (перевірено на v24).

```bash
npm install
```

```bash
npm run dev
```

Відкрити http://localhost:8788 (сайт), http://localhost:8788/plan (план)
і http://localhost:8788/admin (адмінка). Логін/пароль для локальної перевірки —
у файлі `.dev.vars`. Локальні дані лежать у `.wrangler/state/`; видалити цю
папку = скинути все до початкового.

Примітка: при першому запуску wrangler може ~20–30 с намагатися звернутися до
мережі (попередження `Unable to fetch the Request.cf object`) — це не помилка.

Перегляд лише сторінки без адмінки: `python3 -m http.server 8790 --directory site`
(`/api/content` дасть 404, прайс береться з `site/content/*.json`).

## Демо-файл

```bash
python3 scripts/build-demo.py
```

Створює `dist/zbirka-mebliv-demo.html` — один файл (~35 КБ), який
відкривається подвійним кліком без сервера. Калькулятор працює; форма в
демо-режимі нічого не надсилає; адмінки немає.

## Публікація на Cloudflare (перший раз)

Робить власник акаунта Cloudflare (вхід в акаунт і введення секретів — лише
людина, Claude ці команди не виконує).

1. Зареєструватися на https://dash.cloudflare.com (безкоштовно, картка не потрібна).
2. У папці проєкту:
   ```bash
   npx wrangler login
   ```
   (відкриється браузер, підтвердити доступ)
3. Створити сховище, вписати його `id` у `wrangler.toml` замість
   `REPLACE_WITH_KV_NAMESPACE_ID`, створити проєкт:
   ```bash
   npx wrangler kv namespace create CONTENT
   ```
   ```bash
   npx wrangler pages project create vacancy-tz-zbirka-mebliv --production-branch main
   ```
4. Перша публікація:
   ```bash
   npm run deploy
   ```
5. Задати секрети (кожна команда попросить ввести значення):
   ```bash
   npm run secret -- ADMIN_LOGIN
   ```
   ```bash
   npm run secret -- ADMIN_PASSWORD
   ```
   ```bash
   npm run secret -- TG_BOT_TOKEN
   ```
   ```bash
   npm run secret -- TG_CHAT_ID
   ```
   Пароль — довгий (12+ символів), окремий для рекрутера (не з `.dev.vars`).
6. Ще раз `npm run deploy`, щоб секрети підхопилися.
7. Перевірити: сайт `https://vacancy-tz-zbirka-mebliv.pages.dev`, `/plan`,
   адмінка `/admin`, тестова заявка → має прийти в Telegram.

Якщо у `wrangler whoami` кілька акаунтів, перед командами додати
`CLOUDFLARE_ACCOUNT_ID=<id>` (id видно в панелі Cloudflare; це не секрет).

### Оновлення сайту потім

Змінили файли в `site/` або `functions/` → `npm run deploy`. Прайс і фото,
змінені через адмінку, при цьому **не перезаписуються** (вони в KV).

## Що перевірено

Локально через `wrangler pages dev` (2026-10-06, клієнтська версія):

- вхід: без сесії → 401; без `X-Admin` → 400; невірний пароль → 401; вірний → cookie `HttpOnly; Secure; SameSite=Strict`;
- прайс: порожня назва відхиляється; збереження → одразу видно в `/api/content` і на сайті;
- фото: PNG/JPG завантажуються, віддаються ідентичними; TXT відхиляється; без сесії → 401;
  чуже посилання (`https://...`) в photos відхиляється; `../` у шляху → 404;
  фото 3000×2000 зменшується в браузері до 1600×1067;
- пароль: невірний поточний / короткий новий відхиляються; після зміни старий не діє,
  новий діє, поточна сесія лишається, інші завершуються;
- вихід завершує сесію; 6-та невдала спроба входу → 429 (блок 15 хв).

Клієнтська версія цього ж коду працює на живому сайті з 2026-10-08
(адмінка з iPhone, заявка з фото прийшла в Telegram).

Ця копія (2026-10-08, після перенесення версії 08.10 і калькулятора):
див. розділ «Перевірено» в `TODO.md`.
