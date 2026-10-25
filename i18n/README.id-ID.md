<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**Gateway AI yang dihosting sendiri untuk asisten coding — satu endpoint, 40+ provider, 100+ model, dan pipeline Token Saver yang memangkas pengeluaran prompt 20–40%.**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

Fork yang diperkuat dan dipelihara secara independen dari [9router](https://github.com/decolua/9router) — seluruh fitur upstream ditambah pengerasan keamanan, penghitungan token yang jujur, CI hijau dengan rangkaian 4.100+ unit test, dan dokumentasi yang diperbarui. Lihat [CHANGELOG](./CHANGELOG.md) untuk rincian perubahannya.

[Dokumentasi](#dokumentasi) · [Mulai Cepat](#mulai-cepat) · [Arsitektur](./docs/ARCHITECTURE.md) · [Changelog](./CHANGELOG.md)

</div>

---

## Apa yang dilakukannya

9Router AegisX berada di antara alat coding AI Anda dan provider-nya:

- **Satu endpoint yang kompatibel dengan OpenAI/Anthropic/Gemini** untuk Claude Code, Codex CLI, Cursor, Cline, Roo, Continue, Gemini CLI, OpenCode, OpenClaw, Crush, Droid, Kilo, dan lainnya — arahkan semuanya ke `http://localhost:20128/v1` dan rutekan berdasarkan ID `provider/model`.
- **Combos dengan strategi fallback** — rangkai subscription → murah → gratis (fallback berurutan, round-robin, perutean pintar System One dengan kebijakan sesi yang memperhatikan prompt cache, atau fusion paralel dengan model juri).
- **Token Saver** — filter output RTK, deduplikasi hasil tool, History GC, cache respons, integrasi Headroom/Caveman/Ponytail/Pxpipe; papan skor langsung yang menampilkan penghematan tiap saver.
- **Analitik penggunaan** — pelacakan token dan biaya per provider/model/kunci, tingkat cache-hit, detail permintaan, pelacakan kuota dengan auto-ping saat reset.
- **Kendali penuh** — kredensial Anda tersimpan di basis data SQLite lokal; autentikasi dashboard (sandi atau SSO via OIDC/SAML), kontrol akses per kunci, rate limiting, header keamanan, dan secret relay per deployment untuk pool proxy serverless.

## Cara kerjanya

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

Peta komponen lengkap: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Mulai Cepat

Persyaratan: Node.js ≥ 22 (image Docker mematok 22.23.4).

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start    # serves http://localhost:20128
```


**Docker (build dari sumber):**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

Image registry upstream (`decolua/9router` di Docker Hub / GHCR) juga menjalankan codebase ini jika Anda lebih suka yang sudah dibangun sebelumnya. Lihat [DOCKER.md](./DOCKER.md) untuk compose, healthcheck, dan catatan upgrade.

**Login pertama** — sandi dashboard acak yang unik per instalasi dibuat dan dicetak ke konsol server saat eksekusi pertama (disimpan di `DATA_DIR/initial-password` sampai Anda menetapkan sandi permanen). Atur `INITIAL_PASSWORD` untuk memilih sandi Anda sendiri.

## Hubungkan alat Anda

Arahkan klien apa pun yang kompatibel dengan OpenAI ke gateway dan pilih model dengan awalan `provider/`-nya:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| Format wire | Endpoint | Digunakan dengan |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor, Cline, kebanyakan alat |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI, Antigravity |

Juga tersedia: `/v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS), serta server MCP di bawah `/api/mcp`.

Halaman **CLI Tools** pada dashboard menuliskan base URL dan ID model yang benar ke konfigurasi tiap alat untuk Anda (atau gunakan perintah `connect` dari `cli/`). Awalan provider umum: `cc/` Claude, `cx/` Codex, `gc/` Gemini CLI, `glm/`, `if/` iFlow, `kr/` Kiro, `oc/` OpenCode, `tr/` Trae, `ws/` Windsurf — daftar lengkap secara langsung ada di `/v1/models` dan pemilih model dashboard.

## Combos

Combo adalah satu ID model yang didukung rantai terurut dengan strategi:

1. **Fallback** — coba anggota secara berurutan; lanjut ke berikutnya pada 429/5xx, error transien, dan 4xx lingkup permintaan.
2. **Round Robin** — rotasi antar permintaan (batas sticky yang dapat dikonfigurasi).
3. **Smart Router (System One)** — model keputusan memilih anggota terbaik per prompt, dengan kebijakan sesi yang menjaga prompt cache provider tetap hangat (Smart Switch ≥80% keyakinan, Strict Lock = penggunaan ulang penuh tanpa latensi, atau Per-Turn).
4. **Fusion** — kueri semua anggota secara paralel, lalu model juri menyintesiskan jawaban akhir (kualitas tertinggi, penagihan N+1).

## Token Saver

Diterapkan pada body permintaan akhir tepat sebelum pengiriman; setiap saver dapat diaktifkan atau dinonaktifkan satu per satu dan papan skor dashboard (`Usage → Token Saver Scoreboard`, `GET /api/usage/savers`) melacak hit dan byte yang dihemat secara langsung.

| Saver | Efek | Bawaan |
|---|---|---|
| Filter RTK | Kompresi tanpa kehilangan yang sadar jenis untuk `git diff`, `grep`, `ls`, `tree`, log… | aktif |
| Deduplikasi hasil tool | Output tool yang berulang identik byte demi byte → referensi satu baris | aktif |
| Filter test-runner | Menyimpan kegagalan + ringkasan, melewati dinding tes yang lulus (vitest/jest/pytest/go/mocha/TAP) | otomatis |
| History GC | Meringkas hasil tool yang lebih tua dari N giliran pengguna terakhir menjadi digest | nonaktif (`historyGcEnabled`, N=6) |
| Cache respons | Cache permintaan-eksak untuk chat non-streaming (LRU+TTL, `x-9r-cache: hit`) | nonaktif |
| System prompt kustom | Menyuntikkan system prompt Anda sendiri di semua format wire | nonaktif |
| Headroom / Caveman / Ponytail / Pxpipe | Kompresor eksternal, mode output ringkas, bias kode minimal, konteks teks→gambar | nonaktif |

```bash
node scripts/enable-token-savers.mjs          # enable the safe set (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

Lewati semuanya untuk satu permintaan dengan header `X-9Router-Token-Saver: off`.

## Keamanan

- Autentikasi dashboard: login sandi (pembatas login, cookie sesi JWT) atau SSO (OIDC / SAML); `requireLogin=false` hanya untuk setup yang sepenuhnya lokal.
- Kunci API dengan kontrol akses per kunci (batasi ke combo/model yang diizinkan), `REQUIRE_API_KEY` opsional di `/v1/*`.
- Rate limiting per kunci/IP di `/v1` (`rateLimitPerMinute`, bawaan 600).
- Header keamanan (CSP, X-Frame-Options, nosniff, Referrer-Policy); penyamaran kredensial di log dan respons API; statistik penggunaan tidak pernah mengekspos kunci API mentah.
- Alur OAuth mengikat `state` (cookie + perbandingan di klien) dan proxy callback loopback menolak permintaan lintas origin.
- Pool proxy relay serverless di-deploy dengan shared secret per deployment (`x-relay-secret`).

## Konfigurasi

Data tersimpan di SQLite pada `DATA_DIR/db/data.sqlite` (bawaan `~/.9router`). Variabel lingkungan utama — kontrak lengkap di [.env.example](./.env.example):

| Variabel | Bawaan | Kegunaan |
|---|---|---|
| `DATA_DIR` | `~/.9router` | Basis data, instalasi runtime, secret |
| `PORT` | `20128` (Docker) | Port yang didengarkan — skrip npm meneruskan `--port` eksplisit; Docker mengandalkan variabel ini |
| `INITIAL_PASSWORD` | *(dibuat otomatis)* | Menimpa sandi acak eksekusi pertama |
| `JWT_SECRET` | *(dibuat otomatis)* | Penandatanganan sesi dashboard (atur untuk berbagi antar instance) |
| `API_KEY_SECRET` | *(dibuat otomatis)* | HMAC untuk checksum kunci API — atur per instalasi |
| `BASE_URL` | `http://localhost:20128` | Resolusi callback SSO |
| `REQUIRE_API_KEY` | `false` | Mewajibkan kunci API gateway di `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | Atur `true` di belakang proxy HTTPS |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | Proxy keluar untuk panggilan upstream |

Tambahan operasional: `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`, `HEADROOM_URL`, rate limit `/v1` (`rateLimitPerMinute`, bawaan 600 — pengaturan dashboard, bukan variabel lingkungan), pool proxy (termasuk relay Netlify/Vercel/Cloudflare/Deno yang dideploy sendiri), dan tunnel Cloudflare/Tailscale untuk akses jarak jauh.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Peta sistem lengkap — permukaan API, inti routing, executor, saver, persistensi, keamanan, deployment |
| [CHANGELOG.md](./CHANGELOG.md) | Riwayat rilis termasuk putaran pengerasan AegisX |
| [DOCKER.md](./DOCKER.md) | Deployment kontainer, compose, healthcheck |
| [gitbook/](./gitbook/) | Situs docs dalam repo (en, vi, zh-CN, es, ja) — mulai cepat, provider, fitur, integrasi |
| [cli/](./cli/) | Paket CLI pendamping (connect, profil, hooks) |
| [i18n/](./i18n/) | Terjemahan README oleh komunitas (10 bahasa) |

## Pengembangan

```bash
npm install
npm run build        # Next.js production build (CI runs this + lint + baselines)
npm start            # custom-server.js on :20128

cd tests && npm install
npx vitest run       # 4,100+ unit tests (ffmpeg required for STT suites)
npx eslint src open-sse scripts   # lint gate: 0 errors
```

CI (GitHub Actions): lint → verifikasi baseline provider/alias → build → rangkaian unit test lengkap. Workflow khusus fork (deploy gitbook, publish Docker, tray macOS) hanya berjalan via dispatch dan dijaga hanya untuk repo upstream.

## Dukungan

- **Issue & PR**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **Proyek upstream**: [decolua/9router](https://github.com/decolua/9router) — fondasi tempat fork ini dibangun, dengan terima kasih.

## Lisensi

[MIT](./LICENSE)
