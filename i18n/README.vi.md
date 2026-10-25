<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**AI gateway tự triển khai cho các trợ lý lập trình — một endpoint duy nhất, 40+ nhà cung cấp, 100+ mô hình, cùng pipeline token-saver giúp cắt giảm 20–40% chi phí prompt.**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

Một bản fork được tăng cường bảo mật và bảo trì độc lập từ [9router](https://github.com/decolua/9router) — giữ nguyên toàn bộ tính năng của upstream, cộng thêm bảo mật cứng hóa, thống kê token trung thực, CI xanh với bộ 4.100+ unit test, và tài liệu được làm mới toàn diện. Xem [CHANGELOG](./CHANGELOG.md) để biết chi tiết khác biệt.

[Tài liệu](#tài-liệu) · [Bắt đầu nhanh](#bắt-đầu-nhanh) · [Kiến trúc](./docs/ARCHITECTURE.md) · [Nhật ký thay đổi](./CHANGELOG.md)

</div>

---

## Nó làm được gì

9Router AegisX nằm giữa các công cụ AI lập trình của bạn và các nhà cung cấp phía sau:

- **Một endpoint tương thích OpenAI/Anthropic/Gemini** cho Claude Code, Codex CLI, Cursor, Cline, Roo, Continue, Gemini CLI, OpenCode, OpenClaw, Crush, Droid, Kilo và nhiều công cụ khác — trỏ tất cả tới `http://localhost:20128/v1` và định tuyến theo ID `provider/model`.
- **Combos kèm chiến lược fallback** — xếp chuỗi subscription → giá rẻ → miễn phí (fallback tuần tự, round-robin, định tuyến thông minh System One với chính sách phiên nhận biết prompt-cache, hoặc hợp nhất song song kèm judge model).
- **Token Saver** — bộ lọc đầu ra RTK, khử trùng lặp tool-result, History GC, response cache, tích hợp Headroom/Caveman/Ponytail/Pxpipe; bảng điểm trực tiếp cho thấy mỗi saver tiết kiệm được bao nhiêu.
- **Phân tích mức sử dụng** — theo dõi token và chi phí theo provider/model/key, tỷ lệ cache-hit, chi tiết yêu cầu, theo dõi hạn mức kèm tự động ping khi reset.
- **Kiểm soát hoàn toàn** — thông tin xác thực nằm trong cơ sở dữ liệu SQLite cục bộ; xác thực dashboard (mật khẩu hoặc SSO qua OIDC/SAML), kiểm soát truy cập theo key, giới hạn tốc độ, security headers, và relay secret riêng cho từng deployment cho các pool proxy serverless.

## Cách hoạt động

```
Claude Code ─┐                              ┌─ Anthropic / Claude OAuth
Cursor ──────┤   /v1 (OpenAI, Responses,    ├─ OpenAI / Codex / GitHub Copilot
Codex CLI ───┼─▶ Anthropic, Gemini dạng) ───┼─ Gemini / Vertex / Antigravity
Mọi client ──┤   9Router AegisX gateway     ├─ 40+ bộ thực thi provider
             └──────────────────────────────┴─ (OAuth, API-key, gói miễn phí)
                     │
                     ├─ lớp chuyển đổi (request/response, 4 wire format)
                     ├─ combo engine (fallback · round-robin · smart · fusion)
                     ├─ token saver (RTK · dedup · History GC · cache)
                     └─ kho usage SQLite + dashboard (localhost:20128)
```

Sơ đồ thành phần đầy đủ: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Bắt đầu nhanh

Yêu cầu môi trường: Node.js ≥ 22 (image Docker ghim 22.23.4).

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start -- --port 20128    # chạy tại http://localhost:20128
```

> Các script npm mặc định dùng cổng **20127**; Docker và mọi ví dụ trong README này dùng **20128** — truyền `-- --port 20128` (hoặc cổng riêng của bạn) như trên.

**Docker (build từ mã nguồn):**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

Image đăng ký từ upstream (`decolua/9router` trên Docker Hub / GHCR) cũng chạy được codebase này nếu bạn muốn dùng bản dựng sẵn. Xem [DOCKER.md](./DOCKER.md) để biết thêm về compose, healthcheck và nâng cấp.

**Đăng nhập lần đầu** — mật khẩu dashboard ngẫu nhiên theo từng cài đặt sẽ được tạo và in ra console máy chủ ở lần chạy đầu (lưu tại `DATA_DIR/initial-password` cho tới khi bạn đặt mật khẩu cố định). Đặt `INITIAL_PASSWORD` để tự chọn mật khẩu của mình.

## Kết nối công cụ của bạn

Trỏ bất kỳ client tương thích OpenAI nào vào gateway và chọn mô hình kèm tiền tố `provider/`:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| Wire format | Endpoint | Dùng với |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor, Cline, đa số công cụ |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI, Antigravity |

Đồng thời phục vụ: `/v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS), và một MCP server tại `/api/mcp`.

Trang **CLI Tools** trên dashboard sẽ ghi base URL và model ID đúng vào cấu hình của từng công cụ cho bạn (hoặc dùng lệnh `connect` trong `cli/`). Các tiền tố provider phổ biến: `cc/` Claude, `cx/` Codex, `gc/` Gemini CLI, `glm/`, `if/` iFlow, `kr/` Kiro, `oc/` OpenCode, `tr/` Trae, `ws/` Windsurf — danh sách trực tiếp đầy đủ nằm tại `/v1/models` và bảng chọn mô hình trên dashboard.

## Combos

Một combo là một model ID được hỗ trợ bởi một chuỗi thành viên có thứ tự kèm chiến lược:

1. **Fallback** — thử lần lượt các thành viên; chuyển tiếp khi gặp 429/5xx, lỗi tạm thời và 4xx thuộc phạm vi yêu cầu.
2. **Round Robin** — xoay vòng giữa các yêu cầu (giới hạn sticky cấu hình được).
3. **Smart Router (System One)** — một decision model chọn thành viên tốt nhất cho từng prompt, với chính sách phiên giữ prompt cache của provider luôn nóng (Smart Switch độ tin cậy ≥80%, Strict Lock tái sử dụng toàn bộ với độ trễ bằng 0, hoặc Per-Turn).
4. **Fusion** — truy vấn song song tất cả thành viên, một judge model tổng hợp câu trả lời cuối cùng (chất lượng cao nhất, tính phí N+1).

## Token Saver

Được áp dụng lên request body cuối cùng ngay trước khi gửi đi; mỗi saver có thể bật/tắt riêng lẻ và bảng điểm trên dashboard (`Usage → Token Saver Scoreboard`, `GET /api/usage/savers`) theo dõi trực tiếp số lượt trúng và số byte tiết kiệm được.

| Saver | Tác dụng | Mặc định |
|---|---|---|
| Bộ lọc RTK | Nén không mất dữ liệu theo kiểu dữ liệu cho `git diff`, `grep`, `ls`, `tree`, log… | Bật |
| Khử trùng lặp tool-result | Đầu ra tool lặp lại giống nhau từng byte → tham chiếu một dòng | Bật |
| Bộ lọc test-runner | Giữ phần thất bại + tóm tắt, lược bỏ bức tường pass (vitest/jest/pytest/go/mocha/TAP) | Tự động |
| History GC | Nén kết quả tool cũ hơn N lượt người dùng gần nhất thành digest | Tắt (`historyGcEnabled`, N=6) |
| Response cache | Cache theo yêu cầu chính xác cho chat không streaming (LRU+TTL, `x-9r-cache: hit`) | Tắt |
| System prompt tùy chỉnh | Chèn system prompt riêng của bạn vào mọi wire format | Tắt |
| Headroom / Caveman / Ponytail / Pxpipe | Bộ nén ngoài, chế độ đầu ra ngắn gọn, thiên về code tối giản, ngữ cảnh văn bản→ảnh | Tắt |

```bash
node scripts/enable-token-savers.mjs          # bật bộ an toàn (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

Bỏ qua toàn bộ cho một yêu cầu duy nhất bằng header `X-9Router-Token-Saver: off`.

## Bảo mật

- Xác thực dashboard: đăng nhập mật khẩu (login limiter, cookie phiên JWT) hoặc SSO (OIDC / SAML); `requireLogin=false` chỉ dành cho môi trường hoàn toàn cục bộ.
- API key với kiểm soát truy cập theo key (giới hạn trong các combo/model được phép), tùy chọn `REQUIRE_API_KEY` trên `/v1/*`.
- Giới hạn tốc độ theo key/theo IP trên `/v1` (`rateLimitPerMinute`, mặc định 600).
- Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy); làm mờ thông tin xác thực trong log và phản hồi API; thống kê sử dụng không bao giờ lộ API key thô.
- Luồng OAuth ràng buộc `state` (cookie + so khớp phía client) và proxy callback loopback từ chối yêu cầu cross-origin.
- Pool proxy relay serverless triển khai với shared secret riêng theo deployment (`x-relay-secret`).

## Cấu hình

Dữ liệu nằm trong SQLite tại `DATA_DIR/db/data.sqlite` (mặc định `~/.9router`). Các biến môi trường quan trọng — hợp đồng đầy đủ trong [.env.example](./.env.example):

| Biến | Mặc định | Mục đích |
|---|---|---|
| `DATA_DIR` | `~/.9router` | Cơ sở dữ liệu, cài đặt runtime, secret |
| `PORT` | `20127` (script npm) / `20128` (Docker) | Cổng lắng nghe — script npm truyền `--port` rõ ràng; Docker dựa vào biến môi trường này |
| `INITIAL_PASSWORD` | *(sinh tự động)* | Ghi đè mật khẩu ngẫu nhiên lần chạy đầu |
| `JWT_SECRET` | *(sinh tự động)* | Ký phiên dashboard (đặt để dùng chung giữa các instance) |
| `API_KEY_SECRET` | *(sinh tự động)* | HMAC cho checksum API-key — đặt riêng cho mỗi bản cài |
| `BASE_URL` | `http://localhost:20128` | Phân giải callback SSO |
| `REQUIRE_API_KEY` | `false` | Yêu cầu gateway API key trên `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | Đặt `true` khi đứng sau proxy HTTPS |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | Proxy outbound cho các cuộc gọi upstream |

Tiện ích vận hành: `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`, `HEADROOM_URL`, giới hạn tốc độ `/v1` (`rateLimitPerMinute`, mặc định 600 — là cài đặt dashboard, không phải biến môi trường), pool proxy (bao gồm relay Netlify/Vercel/Cloudflare/Deno tự triển khai), và tunnel Cloudflare/Tailscale cho truy cập từ xa.

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Bản đồ hệ thống đầy đủ — bề mặt API, lõi định tuyến, executor, saver, lưu trữ, bảo mật, triển khai |
| [CHANGELOG.md](./CHANGELOG.md) | Lịch sử phát hành, gồm vòng bảo mật AegisX |
| [DOCKER.md](./DOCKER.md) | Triển khai container, compose, healthcheck |
| [gitbook/](./gitbook/) | Site tài liệu trong repo (en, vi, zh-CN, es, ja) — bắt đầu nhanh, provider, tính năng, tích hợp |
| [cli/](./cli/) | Package CLI đi kèm (connect, profile, hook) |
| [i18n/](./i18n/) | Bản dịch README cộng đồng (10 ngôn ngữ) |

## Phát triển

```bash
npm install
npm run build        # build production Next.js (CI chạy bước này + lint + baseline)
npm start            # custom-server.js trên :20128

cd tests && npm install
npx vitest run       # 4.100+ unit test (bộ STT cần ffmpeg)
npx eslint src open-sse scripts   # cổng lint: 0 lỗi
```

CI (GitHub Actions): lint → kiểm tra baseline provider/alias → build → toàn bộ bộ unit test. Các workflow đặc thù của bản gốc (triển khai gitbook, phát hành Docker, khay macOS) chỉ chạy khi dispatch thủ công và bị giới hạn cho repo upstream.

## Hỗ trợ

- **Issue & PR**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **Dự án upstream**: [decolua/9router](https://github.com/decolua/9router) — nền tảng mà fork này dựa trên, với lời cảm ơn.

## Giấy phép

[MIT](./LICENSE)
