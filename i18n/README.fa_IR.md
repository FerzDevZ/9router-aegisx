<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**گیت‌وی هوش مصنوعی self-hosted برای دستیارهای کدنویسی — یک endpoint، بیش از 40 ارائه‌دهنده، بیش از 100 مدل، و خط لوله token-saver که هزینه prompt را 20–40% کاهش می‌دهد.**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

یک fork با امنیت تقویت‌شده که به‌طور مستقل نگهداری می‌شود، بر پایهٔ [9router](https://github.com/decolua/9router) — علاوه بر مجموعهٔ کامل قابلیت‌های upstream، شامل سخت‌سازی امنیتی، شمارش صادقانهٔ token، CI سبز با مجموعهٔ 4,100+ تست واحدی، و مستندات بازنویسی‌شده است. تفاوت‌ها را در [CHANGELOG](./CHANGELOG.md) ببینید.

[مستندات](#مستندات) · [شروع سریع](#شروع-سریع) · [معماری](./docs/ARCHITECTURE.md) · [تغییرات](./CHANGELOG.md)

</div>

---

## چه کاری انجام می‌دهد

9Router AegisX میان ابزارهای کدنویسی هوش مصنوعی شما و ارائه‌دهنده‌های آن‌ها قرار می‌گیرد:

- **یک endpoint سازگار با OpenAI/Anthropic/Gemini** برای Claude Code، Codex CLI، Cursor، Cline، Roo، Continue، Gemini CLI، OpenCode، OpenClaw، Crush، Droid، Kilo و موارد دیگر — آن‌ها را به `http://localhost:20128/v1` اشاره دهید و با شناسهٔ `provider/model` مسیریابی کنید.
- **Combos با استراتژی‌های fallback** — زنجیرهٔ اشتراک → ارزان → سطوح رایگان (fallback ترتیبی، round-robin، مسیریابی هوشمند System One با سیاست‌های session آگاه از prompt-cache، یا fusion موازی با مدل judge).
- **Token Saver** — فیلترهای خروجی RTK، حذف تکرار tool-result، History GC، کش پاسخ، یکپارچه‌سازی‌های Headroom/Caveman/Ponytail/Pxpipe؛ به‌همراه تابلوی زندهٔ میزان صرفه‌جویی هر saver.
- **تحلیل مصرف** — ردیابی token و هزینه به تفکیک provider/model/key، نرخ cache-hit، جزئیات درخواست، ردیابی سهمیه با ping خودکار هنگام ریست.
- **کنترل کامل** — اعتبارنامه‌های شما در پایگاه‌دادهٔ SQLite محلی می‌ماند؛ احراز هویت داشبورد (رمز عبور یا SSO از طریق OIDC/SAML)، کنترل دسترسی به ازای هر key، محدودیت نرخ، هدرهای امنیتی، و relay secret اختصاصی هر deployment برای استخرهای proxy سرورلس.

## نحوهٔ کار

```
Claude Code ─┐                              ┌─ Anthropic / Claude OAuth
Cursor ──────┤   /v1 (OpenAI, Responses,    ├─ OpenAI / Codex / GitHub Copilot
Codex CLI ───┼─▶ Anthropic, Gemini shapes) ─┼─ Gemini / Vertex / Antigravity
Any client ──┤   9Router AegisX gateway     ├─ 40+ provider executors
             └──────────────────────────────┴─ (OAuth, API-key, free tiers)
                     │
                     ├─ translation layer (request/response, 4 wire formats)
                     ├─ combo engine (fallback · round-robin · smart · fusion)
                     ├─ token savers (RTK · dedup · history GC · cache)
                     └─ SQLite usage store + dashboard (localhost:20128)
```

نقشهٔ کامل اجزا: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## شروع سریع

پیش‌نیازها: Node.js ≥ 22 (image داکر روی 22.23.4 قفل شده است).

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start    # serves http://localhost:20128
```


**Docker (ساخت از سورس):**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

ایمیج‌های registry بالادستی (`decolua/9router` در Docker Hub / GHCR) نیز همین کدبیس را اجرا می‌کنند اگر نسخهٔ از پیش ساخته‌شده را ترجیح می‌دهید. برای compose، healthcheck و ارتقا به [DOCKER.md](./DOCKER.md) مراجعه کنید.

**ورود اول** — یک رمز عبور تصادفی مخصوص هر نصب برای داشبورد ساخته شده و در اولین اجرا در کنسول سرور چاپ می‌شود (تا زمانی که رمز دائمی تعیین کنید در `DATA_DIR/initial-password` ذخیره می‌ماند). با تنظیم `INITIAL_PASSWORD` رمز دلخواه خود را انتخاب کنید.

## اتصال ابزارهایتان

هر client سازگار با OpenAI را به gateway اشاره دهید و مدلی با پیشوند `provider/` انتخاب کنید:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| قالب wire | Endpoint | استفاده با |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor، Cline، اغلب ابزارها |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI، Antigravity |

همچنین ارائه می‌شود: `/v1/models`، `/v1/embeddings`، `/v1/images/generations`، `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS)، و یک MCP server در مسیر `/api/mcp`.

صفحهٔ **CLI Tools** داشبورد، base URL و شناسه‌های مدل صحیح را در پیکربندی هر ابزار برایتان می‌نویسد (یا از دستور `connect` در `cli/` استفاده کنید). پیشوندهای رایج provider: `cc/` Claude، `cx/` Codex، `gc/` Gemini CLI، `glm/`، `if/` iFlow، `kr/` Kiro، `oc/` OpenCode، `tr/` Trae، `ws/` Windsurf — فهرست کامل و زنده در `/v1/models` و انتخابگر مدل داشبورد موجود است.

## ترکیب‌ها (Combos)

یک combo یک شناسهٔ مدل است که توسط یک زنجیرهٔ مرتب با یک استراتژی پشتیبانی می‌شود:

1. **Fallback** — اعضا به ترتیب امتحان می‌شوند؛ هنگام 429/5xx، خطاهای گذرا و 4xx محدود به درخواست، به عضو بعدی می‌رود.
2. **Round Robin** — چرخش بین درخواست‌ها (سقف sticky قابل تنظیم).
3. **Smart Router (System One)** — یک decision model بهترین عضو را برای هر prompt انتخاب می‌کند، با سیاست‌های session که prompt cache ارائه‌دهنده را گرم نگه می‌دارد (Smart Switch با اطمینان ≥80%، Strict Lock با استفادهٔ کامل و بدون تأخیر، یا Per-Turn).
4. **Fusion** — به‌صورت موازی از همهٔ اعضا پرس‌وجو می‌شود و یک مدل judge پاسخ نهایی را ترکیب می‌کند (بالاترین کیفیت، صورتحساب N+1).

## Token Saver

درست قبل از ارسال، روی بدنهٔ نهایی درخواست اعمال می‌شوند؛ هر saver به‌طور جداگانه قابل فعال/غیرفعال کردن است و تابلوی امتیازات داشبورد (`Usage → Token Saver Scoreboard`، `GET /api/usage/savers`) تعداد hit و بایت‌های ذخیره‌شده را به‌صورت زنده دنبال می‌کند.

| Saver | اثر | پیش‌فرض |
|---|---|---|
| فیلترهای RTK | فشرده‌سازی بدون فقدان و آگاه از نوع برای `git diff`، `grep`، `ls`، `tree`، لاگ‌ها… | روشن |
| حذف تکرار tool-result | خروجی‌های ابزار تکراریِ یکسان بایت‌به‌بایت → ارجاع یک‌خطی | روشن |
| فیلتر test-runner | خطاها + خلاصه را نگه می‌دارد و دیوار تست‌های پاس‌شده را حذف می‌کند (vitest/jest/pytest/go/mocha/TAP) | خودکار |
| History GC | نتایج ابزار قدیمی‌تر از N نوبت کاربر آخر را به digest فشرده می‌کند | خاموش (`historyGcEnabled`، N=6) |
| کش پاسخ | کش دقیق به ازای درخواست برای چت غیر استریم (LRU+TTL، با `x-9r-cache: hit` در صورت hit) | خاموش |
| سیستم‌پرامپت سفارشی | تزریق سیستم‌پرامپت دلخواه شما در همهٔ قالب‌های wire | خاموش |
| Headroom / Caveman / Ponytail / Pxpipe | فشرده‌ساز خارجی، حالت خروجی مختصر، گرایش کد حداقلی، بافت متن→تصویر | خاموش |

```bash
node scripts/enable-token-savers.mjs          # enable the safe set (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

برای دور زدن همه‌چیز در یک درخواست واحد، هدر `X-9Router-Token-Saver: off` را بفرستید.

## امنیت

- احراز هویت داشبورد: ورود با رمز عبور (محدودکنندهٔ ورود، کوکی نشست JWT) یا SSO (OIDC / SAML)؛ `requireLogin=false` فقط برای راه‌اندازی‌های کاملاً محلی.
- کلیدهای API با کنترل دسترسی به ازای هر key (محدود به combo/مدل‌های مجاز)، `REQUIRE_API_KEY` اختیاری روی `/v1/*`.
- محدودیت نرخ به ازای key/IP روی `/v1` (`rateLimitPerMinute`، پیش‌فرض 600).
- هدرهای امنیتی (CSP، X-Frame-Options، nosniff، Referrer-Policy)؛ پوشاندن اعتبارنامه‌ها در لاگ‌ها و پاسخ‌های API؛ آمار مصرف هرگز کلید خام API را فاش نمی‌کند.
- جریان‌های OAuth دارای `state` مقیدشده هستند (کوکی + مقایسه سمت client) و پروکسی‌های callback حلقه‌ای محلی، درخواست‌های متقاطع‌مبدأ را رد می‌کنند.
- استخرهای پروکسی relay سرورلس با یک shared secret مخصوص هر deployment (`x-relay-secret`) مستقر می‌شوند.

## پیکربندی

داده‌ها در SQLite در مسیر `DATA_DIR/db/data.sqlite` ذخیره می‌شوند (پیش‌فرض `~/.9router`). متغیرهای محیطی کلیدی — قرارداد کامل در [.env.example](./.env.example):

| متغیر | پیش‌فرض | کاربرد |
|---|---|---|
| `DATA_DIR` | `~/.9router` | پایگاه‌داده، نصب‌های runtime، secret ها |
| `PORT` | `20128` (Docker) | پورت شنیداری — اسکریپت‌های npm `--port` صریح می‌گذراند؛ Docker به این env متکی است |
| `INITIAL_PASSWORD` | *(تولیدشده)* | جایگزینی رمز تصادفی اولین اجرا |
| `JWT_SECRET` | *(تولیدشده)* | امضای نشست داشبورد (برای اشتراک بین نمونه‌ها تنظیم کنید) |
| `API_KEY_SECRET` | *(تولیدشده)* | HMAC برای checksum کلید API — به ازای هر نصب تنظیم کنید |
| `BASE_URL` | `http://localhost:20128` | تفکیک callback های SSO |
| `REQUIRE_API_KEY` | `false` | الزام کلید API گیت‌وی روی `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | پشت پروکسی HTTPS روی `true` بگذارید |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | پروکسی خروجی برای فراخوانی‌های upstream |

موارد عملیاتی اضافه: `ENABLE_REQUEST_LOGS`، `OBSERVABILITY_ENABLED`، `HEADROOM_URL`، محدودیت نرخ `/v1` (`rateLimitPerMinute`، پیش‌فرض 600 — یک تنظیم داشبورد است نه env)، استخرهای proxy (شامل relay های Netlify/Vercel/Cloudflare/Deno با استقرار شخصی)، و تونل‌های Cloudflare/Tailscale برای دسترسی از راه دور.

## مستندات

| سند | محتوا |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | نقشهٔ کامل سیستم — سطح API، هستهٔ مسیریابی، executor ها، saver ها، ماندگاری، امنیت، استقرار |
| [CHANGELOG.md](./CHANGELOG.md) | تاریخچهٔ انتشار شامل دور سخت‌سازی AegisX |
| [DOCKER.md](./DOCKER.md) | استقرار کانتینری، compose، healthcheck |
| [gitbook/](./gitbook/) | سایت مستندات داخل مخزن (en، vi، zh-CN، es، ja) — شروع سریع، ارائه‌دهنده‌ها، قابلیت‌ها، یکپارچه‌سازی‌ها |
| [cli/](./cli/) | بستهٔ CLI همراه (connect، پروفایل‌ها، hook ها) |
| [i18n/](./i18n/) | ترجمه‌های README جامعه (10 زبان) |

## توسعه

```bash
npm install
npm run build        # Next.js production build (CI runs this + lint + baselines)
npm start            # custom-server.js on :20128

cd tests && npm install
npx vitest run       # 4,100+ unit tests (ffmpeg required for STT suites)
npx eslint src open-sse scripts   # lint gate: 0 errors
```

CI (GitHub Actions): lint → تأیید baseline های provider/alias → build → مجموعهٔ کامل تست‌های واحدی. گردش‌کارهای مخصوص مخزن اصلی (استقرار gitbook، انتشار Docker، tray مک‌اواس) فقط به‌صورت dispatch دستی اجرا می‌شوند و به مخزن بالادستی محدودند.

## پشتیبانی

- **Issue و PR**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **پروژهٔ بالادستی**: [decolua/9router](https://github.com/decolua/9router) — بنیانی که این fork روی آن ساخته شده، با سپاس.

## مجوز

[MIT](./LICENSE)
