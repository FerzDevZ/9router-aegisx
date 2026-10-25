<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**Самостоятельно размещаемый AI-шлюз для ассистентов программирования — одна конечная точка, 40+ провайдеров, 100+ моделей и конвейер Token Saver, сокращающий расходы на промпты на 20–40%.**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

Усиленный и независимо поддерживаемый форк [9router](https://github.com/decolua/9router) — полный набор возможностей апстрима плюс усиление безопасности, честный учёт токенов, зелёный CI с набором из 4 100+ модульных тестов и обновлённая документация. Изменения смотрите в [CHANGELOG](./CHANGELOG.md).

[Документация](#документация) · [Быстрый старт](#быстрый-старт) · [Архитектура](./docs/ARCHITECTURE.md) · [Список изменений](./CHANGELOG.md)

</div>

---

## Что он делает

9Router AegisX располагается между вашими AI-инструментами для программирования и их провайдерами:

- **Единая конечная точка, совместимая с OpenAI/Anthropic/Gemini** для Claude Code, Codex CLI, Cursor, Cline, Roo, Continue, Gemini CLI, OpenCode, OpenClaw, Crush, Droid, Kilo и других — направьте их на `http://localhost:20128/v1` и маршрутизируйте по ID `провайдер/модель`.
- **Комбинации (Combos) со стратегиями fallback** — выстраивайте цепочки подписка → дешёвый → бесплатный тариф (последовательный fallback, round-robin, умная маршрутизация System One с учитывающими prompt cache политиками сессий или параллельная fusion с моделью-судьёй).
- **Token Savers** — выходные фильтры RTK, дедупликация результатов инструментов, History GC, кэш ответов, интеграции Headroom/Caveman/Ponytail/Pxpipe; живая таблица результатов того, что сэкономил каждый saver.
- **Аналитика использования** — учёт токенов и затрат по провайдерам/моделям/ключам, доля попаданий в кэш, детали запросов, отслеживание квот с авто-ping при сбросе.
- **Полный контроль** — ваши учётные данные хранятся в локальной базе SQLite; аутентификация дашборда (пароль или SSO через OIDC/SAML), контроль доступа на уровне ключей, rate limiting, заголовки безопасности и отдельные секреты relay для каждого развертывания серверлесс-пулов прокси.

## Как это работает

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

Полная карта компонентов: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Быстрый старт

Требования: Node.js ≥ 22 (образ Docker фиксирует 22.23.4).

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start -- --port 20128    # serves http://localhost:20128
```

> Скрипты npm по умолчанию используют порт **20127**; Docker и все примеры в этом README используют **20128** — передайте `-- --port 20128` (или свой собственный), как показано выше.

**Docker (сборка из исходников):**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

Готовые образы апстрим-реестра (`decolua/9router` в Docker Hub / GHCR) также запускают этот код, если предпочитаете предсобранные. Compose, healthcheck и заметки по обновлению — в [DOCKER.md](./DOCKER.md).

**Первый вход** — при первом запуске генерируется случайный пароль дашборда, уникальный для установки, и выводится в консоль сервера (хранится в `DATA_DIR/initial-password`, пока вы не зададите постоянный). Задайте `INITIAL_PASSWORD`, чтобы выбрать свой.

## Подключите ваши инструменты

Направьте любой OpenAI-совместимый клиент на шлюз и выберите модель с префиксом `провайдер/`:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| Формат обмена | Endpoint | Использовать с |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor, Cline, большинство инструментов |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI, Antigravity |

Также доступны: `/v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS) и MCP-сервер по пути `/api/mcp`.

Страница **CLI Tools** дашборда сама записывает правильный base URL и ID моделей в конфиг каждого инструмента (или используйте команду `connect` из `cli/`). Распространённые префиксы провайдеров: `cc/` Claude, `cx/` Codex, `gc/` Gemini CLI, `glm/`, `if/` iFlow, `kr/` Kiro, `oc/` OpenCode, `tr/` Trae, `ws/` Windsurf — полный живой список есть на `/v1/models` и в выборе моделей дашборда.

## Комбинации (Combos)

Комбо — это один ID модели, за которым стоит упорядоченная цепочка со стратегией:

1. **Fallback** — члены пробуются по порядку; переход к следующему при 429/5xx, транзиентных ошибках и 4xx в рамках запроса.
2. **Round Robin** — ротация между запросами (настраиваемый лимит закрепления).
3. **Smart Router (System One)** — модель-решение выбирает лучшего участника под каждый промпт, а политики сессий поддерживают prompt cache провайдеров в «горячем» состоянии (Smart Switch с уверенностью ≥80%, Strict Lock = полное повторное использование без задержек, или Per-Turn).
4. **Fusion** — опрос всех участников параллельно, модель-судья синтезирует итоговый ответ (максимальное качество, тарификация N+1).

## Token Savers

Применяются к финальному телу запроса непосредственно перед отправкой; каждый saver включается и выключается отдельно, а табло дашборда (`Usage → Token Saver Scoreboard`, `GET /api/usage/savers`) в реальном времени показывает попадания и сэкономленные байты.

| Saver | Эффект | По умолчанию |
|---|---|---|
| Фильтры RTK | Безпотерьное сжатие с учётом типов для `git diff`, `grep`, `ls`, `tree`, логов… | включён |
| Дедупликация результатов инструментов | Повторяющиеся байт-в-байт выводы инструментов → ссылка одной строкой | включена |
| Фильтр test-runner | Сохраняет падения + сводку, опускает стену прошедших тестов (vitest/jest/pytest/go/mocha/TAP) | авто |
| History GC | Свёртывает в дайджесты результаты инструментов старше последних N ходов пользователя | выключен (`historyGcEnabled`, N=6) |
| Кэш ответов | Кэш точных запросов для нестримингового чата (LRU+TTL, `x-9r-cache: hit`) | выключен |
| Своий system prompt | Внедряет ваш собственный system prompt во все форматы обмена | выключен |
| Headroom / Caveman / Ponytail / Pxpipe | Внешний компрессор, режим кратких ответов, уклон в минимальный код, контекст текст→изображение | выключены |

```bash
node scripts/enable-token-savers.mjs          # enable the safe set (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

Полностью отключить всё для одного запроса можно заголовком `X-9Router-Token-Saver: off`.

## Безопасность

- Аутентификация дашборда: вход по паролю (ограничитель попыток входа, JWT-cookie сессии) или SSO (OIDC / SAML); `requireLogin=false` — только для полностью локальных установок.
- API-ключи с контролем доступа на уровне ключа (ограничение разрешёнными комбо/моделями), опциональный `REQUIRE_API_KEY` на `/v1/*`.
- Rate limiting по ключу/IP на `/v1` (`rateLimitPerMinute`, по умолчанию 600).
- Заголовки безопасности (CSP, X-Frame-Options, nosniff, Referrer-Policy); маскирование учётных данных в логах и ответах API; статистика использования никогда не раскрывает исходные API-ключи.
- OAuth-потоки привязывают `state` (cookie + сравнение на клиенте), а loopback-прокси обратных вызовов отклоняют межсайтовые запросы.
- Серверлесс-пулы relay-прокси развёртываются с общим секретом на каждое развертывание (`x-relay-secret`).

## Конфигурация

Данные хранятся в SQLite по пути `DATA_DIR/db/data.sqlite` (по умолчанию `~/.9router`). Ключевые переменные окружения — полный контракт в [.env.example](./.env.example):

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `DATA_DIR` | `~/.9router` | База данных, runtime-установки, секреты |
| `PORT` | `20127` (скрипты npm) / `20128` (Docker) | Порт прослушивания — скрипты npm передают явный `--port`; Docker полагается на эту переменную |
| `INITIAL_PASSWORD` | *(генерируется)* | Переопределяет случайный пароль первого запуска |
| `JWT_SECRET` | *(генерируется)* | Подпись сессий дашборда (задайте для общего доступа между инстансами) |
| `API_KEY_SECRET` | *(генерируется)* | HMAC для контрольных сумм API-ключей — задайте для каждой установки |
| `BASE_URL` | `http://localhost:20128` | Разрешение callback-ов SSO |
| `REQUIRE_API_KEY` | `false` | Требовать API-ключ шлюза на `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | Установите `true` за HTTPS-прокси |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | Исходящий прокси для вызовов к апстриму |

Дополнительно для эксплуатации: `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`, `HEADROOM_URL`, rate limit для `/v1` (`rateLimitPerMinute`, по умолчанию 600 — это настройка дашборда, а не переменная окружения), пулы прокси (включая самостоятельно развёрнутые Netlify/Vercel/Cloudflare/Deno-ретлеи) и туннели Cloudflare/Tailscale для удалённого доступа.

## Документация

| Документ | Содержимое |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Полная карта системы — поверхность API, ядро маршрутизации, исполнители, savers, персистентность, безопасность, развёртывание |
| [CHANGELOG.md](./CHANGELOG.md) | История версий, включая цикл усиления AegisX |
| [DOCKER.md](./DOCKER.md) | Развёртывание в контейнерах, compose, healthcheck-и |
| [gitbook/](./gitbook/) | Документация в репозитории (en, vi, zh-CN, es, ja) — быстрый старт, провайдеры, функции, интеграции |
| [cli/](./cli/) | Сопутствующий CLI-пакет (connect, профили, hooks) |
| [i18n/](./i18n/) | Переводы README силами сообщества (10 языков) |

## Разработка

```bash
npm install
npm run build        # Next.js production build (CI runs this + lint + baselines)
npm start            # custom-server.js on :20128

cd tests && npm install
npx vitest run       # 4,100+ unit tests (ffmpeg required for STT suites)
npx eslint src open-sse scripts   # lint gate: 0 errors
```

CI (GitHub Actions): lint → проверка базлайнов провайдеров/алиасов → сборка → полный набор модульных тестов. Воркфлоу только для форка (деплой gitbook, публикация Docker, трей macOS) запускаются вручную по dispatch и ограничены апстрим-репозиторием.

## Поддержка

- **Issues и PR**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **Апстрим-проект**: [decolua/9router](https://github.com/decolua/9router) — фундамент, на котором построен этот форк, выражаем благодарность.

## Лицензия

[MIT](./LICENSE)
