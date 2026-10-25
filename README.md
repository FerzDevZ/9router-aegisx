<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**Self-hosted AI gateway for coding assistants — one endpoint, 40+ providers, 100+ models, and a token-saver pipeline that cuts prompt spend 20–40%.**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

A hardened, independently maintained fork of [9router](https://github.com/decolua/9router) — full upstream feature set plus security hardening, honest token accounting, a green CI with a 4,100+ test unit suite, and refreshed documentation. See [CHANGELOG](./CHANGELOG.md) for the delta.

[Documentation](#documentation) · [Quick Start](#quick-start) · [Architecture](./docs/ARCHITECTURE.md) · [Changelog](./CHANGELOG.md)

</div>

---

## What it does

9Router AegisX sits between your AI coding tools and their providers:

- **One OpenAI/Anthropic/Gemini-compatible endpoint** for Claude Code, Codex CLI, Cursor, Cline, Roo, Continue, Gemini CLI, OpenCode, OpenClaw, Crush, Droid, Kilo and more — point them at `http://localhost:20128/v1` and route by `provider/model` ID.
- **Combos with fallback strategies** — chain subscription → cheap → free tiers (sequential fallback, round-robin, System One smart routing with prompt-cache-aware session policies, or parallel fusion with a judge model).
- **Token savers** — RTK output filters, tool-result dedup, history GC, response cache, Headroom/Caveman/Ponytail/Pxpipe integrations; live scoreboard of what each saver saved.
- **Usage analytics** — per-provider/model/key token and cost tracking, cache-hit rate, request details, quota tracking with auto-ping on reset.
- **Full control** — your credentials stay in a local SQLite database; dashboard auth (password or SSO via OIDC/SAML), per-key access control, rate limiting, security headers, and per-deployment relay secrets for serverless proxy pools.

## How it works

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

Full component map: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Quick start

Requirements: Node.js ≥ 22 (Docker image pins 22.23.4).

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start    # serves http://localhost:20128
```

> The server binds to **localhost only** — run `npm start -- --hostname 0.0.0.0` if you intentionally want LAN exposure (your API-key setting then gates `/v1`).


**Docker (build from source):**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

Upstream registry images (`decolua/9router` on Docker Hub / GHCR) also run this codebase if you prefer prebuilt. See [DOCKER.md](./DOCKER.md) for compose, healthcheck, and upgrade notes.

**First login** — a random per-install dashboard password is generated and printed to the server console on first run (stored at `DATA_DIR/initial-password` until you set a permanent one). Set `INITIAL_PASSWORD` to choose your own.

## Connect your tools

Point any OpenAI-compatible client at the gateway and pick a model with its `provider/` prefix:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| Wire format | Endpoint | Use with |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor, Cline, most tools |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI, Antigravity |

Also served: `/v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS), and an MCP server under `/api/mcp`.

The dashboard's **CLI Tools** page writes the correct base URL and model IDs into each tool's config for you (or use `cli/`'s `connect` command). Common provider prefixes: `cc/` Claude, `cx/` Codex, `gc/` Gemini CLI, `glm/`, `if/` iFlow, `kr/` Kiro, `oc/` OpenCode, `tr/` Trae, `ws/` Windsurf — the full live list is on `/v1/models` and the dashboard model picker.

## Combos

A combo is one model ID backed by an ordered chain with a strategy:

1. **Fallback** — try members in order; advance on 429/5xx, transient errors, and request-scoped 4xx.
2. **Round Robin** — rotate across requests (configurable sticky limit).
3. **Smart Router (System One)** — a decision model picks the best member per prompt, with session policies that keep provider prompt caches warm (Smart Switch ≥80% confidence, Strict Lock = zero-latency full reuse, or Per-Turn).
4. **Fusion** — query all members in parallel, a judge model synthesizes the final answer (highest quality, N+1 billing).

## Token savers

Applied to the final request body just before dispatch; every saver is individually togglable and the dashboard scoreboard (`Usage → Token Saver Scoreboard`, `GET /api/usage/savers`) tracks hits and bytes saved live.

| Saver | Effect | Default |
|---|---|---|
| RTK filters | Type-aware lossless compression for `git diff`, `grep`, `ls`, `tree`, logs… | on |
| Tool-result dedup | Byte-identical repeated tool outputs → one-line reference | on |
| test-runner filter | Keeps failures + summary, elides the passing wall (vitest/jest/pytest/go/mocha/TAP) | auto |
| History GC | Squashes tool results older than the last N user turns to digests | off (`historyGcEnabled`, N=6) |
| Response cache | Exact-request cache for non-streaming chat (LRU+TTL, `x-9r-cache: hit`) | off |
| Custom system prompt | Inject your own system prompt across all wire formats | off |
| Headroom / Caveman / Ponytail / Pxpipe | External compressor, terse-output mode, minimal-code bias, text→image context | off |

```bash
node scripts/enable-token-savers.mjs          # enable the safe set (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

Bypass everything for a single request with header `X-9Router-Token-Saver: off`.

## Security

- Dashboard auth: password login (login limiter, JWT session cookie) or SSO (OIDC / SAML); `requireLogin=false` only for fully local setups.
- API keys with per-key access control (restrict to allowed combos/models), optional `REQUIRE_API_KEY` on `/v1/*`.
- Per-key/per-IP rate limiting on `/v1` (`rateLimitPerMinute`, default 600).
- Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy); credential redaction in logs and API responses; usage stats never expose raw API keys.
- OAuth flows bind `state` (cookie + client compare) and loopback callback proxies reject cross-origin requests.
- Serverless relay proxy pools deploy with a per-deployment shared secret (`x-relay-secret`).

## Configuration

Data lives in SQLite at `DATA_DIR/db/data.sqlite` (default `~/.9router`). Key environment variables — full contract in [.env.example](./.env.example):

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `~/.9router` | Database, runtime installs, secrets |
| `PORT` | `20128` (Docker) | Listen port — npm scripts pass an explicit `--port`; Docker relies on this env |
| `INITIAL_PASSWORD` | *(generated)* | Overrides the random first-run password |
| `JWT_SECRET` | *(generated)* | Dashboard session signing (set to share across instances) |
| `API_KEY_SECRET` | *(generated)* | HMAC for API-key checksums — set per install |
| `BASE_URL` | `http://localhost:20128` | SSO callback resolution |
| `REQUIRE_API_KEY` | `false` | Require a gateway API key on `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | Set `true` behind an HTTPS proxy |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | Outbound proxy for upstream calls |

Ops extras: `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`, `HEADROOM_URL`, the `/v1` rate limit (`rateLimitPerMinute`, default 600 — a dashboard setting, not env), proxy pools (including self-deployed Netlify/Vercel/Cloudflare/Deno relays), and Cloudflare/Tailscale tunnels for remote access.

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Full system map — API surface, routing core, executors, savers, persistence, security, deployment |
| [CHANGELOG.md](./CHANGELOG.md) | Release history incl. the AegisX hardening round |
| [DOCKER.md](./DOCKER.md) | Container deployment, compose, healthchecks |
| [gitbook/](./gitbook/) | In-repo docs site (en, vi, zh-CN, es, ja) — quick start, providers, features, integrations |
| [cli/](./cli/) | Companion CLI package (connect, profiles, hooks) |
| [i18n/](./i18n/) | Community README translations (10 languages) |

## Development

```bash
npm install
npm run build        # Next.js production build (CI runs this + lint + baselines)
npm start            # custom-server.js on :20128

cd tests && npm install
npx vitest run       # 4,100+ unit tests (ffmpeg required for STT suites)
npx eslint src open-sse scripts   # lint gate: 0 errors
```

CI (GitHub Actions): lint → provider/alias baseline verifies → build → full unit suite. Fork-only workflows (gitbook deploy, docker publish, macOS tray) are dispatch-only and guarded to the upstream repo.

## Support

- **Issues & PRs**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **Upstream project**: [decolua/9router](https://github.com/decolua/9router) — the foundation this fork builds on, with thanks.

## License

[MIT](./LICENSE)
