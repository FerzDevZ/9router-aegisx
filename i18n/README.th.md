<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**เกตเวย์ AI แบบ self-hosted สำหรับผู้ช่วยเขียนโค้ด — endpoint เดียว ผู้ให้บริการ 40+ โมเดล 100+ และ pipeline token-saver ที่ตัดค่าใช้จ่าย prompt ลง 20–40%**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

fork ที่ได้รับการเสริมความปลอดภัยและดูแลรักษาอย่างเป็นอิสระจาก [9router](https://github.com/decolua/9router) — ครบทุกความสามารถของ upstream พร้อมเพิ่มการเสริมความปลอดภัย การนับ token ที่เป็นจริง CI สีเขียวด้วยชุด unit test 4,100+ รายการ และเอกสารที่ปรับปรุงใหม่ทั้งหมด ดูความเปลี่ยนแปลงได้ที่ [CHANGELOG](./CHANGELOG.md)

[เอกสาร](#เอกสาร) · [เริ่มใช้งานอย่างรวดเร็ว](#เริ่มใช้งานอย่างรวดเร็ว) · [สถาปัตยกรรม](./docs/ARCHITECTURE.md) · [บันทึกการเปลี่ยนแปลง](./CHANGELOG.md)

</div>

---

## ทำอะไรได้บ้าง

9Router AegisX ทำหน้าที่เป็นตัวกลางระหว่างเครื่องมือเขียนโค้ด AI ของคุณกับผู้ให้บริการต้นทาง:

- **endpoint เดียวที่รองรับ OpenAI/Anthropic/Gemini** สำหรับ Claude Code, Codex CLI, Cursor, Cline, Roo, Continue, Gemini CLI, OpenCode, OpenClaw, Crush, Droid, Kilo และอื่น ๆ — ชี้มาที่ `http://localhost:20128/v1` แล้วกำหนดเส้นทางด้วย ID รูปแบบ `provider/model`
- **Combos พร้อมกลยุทธ์ fallback** — เรียงลำดับ subscription → ราคาถูก → ระดับฟรี (fallback แบบเรียงลำดับ, round-robin, การกำหนดเส้นทางอัจฉริยะ System One ที่มีนโยบาย session แบบรองรับ prompt-cache หรือ fusion แบบขนานพร้อม judge model)
- **Token Saver** — ตัวกรอง output แบบ RTK, การลบ tool-result ซ้ำ, History GC, response cache, การเชื่อมต่อ Headroom/Caveman/Ponytail/Pxpipe พร้อม scoreboard แสดงสิ่งที่ saver แต่ละตัวช่วยประหยัดแบบเรียลไทม์
- **วิเคราะห์การใช้งาน** — ติดตาม token และค่าใช้จ่ายราย provider/model/key, อัตรา cache-hit, รายละเอียด request, ติดตามโควตาพร้อม ping อัตโนมัติเมื่อรีเซ็ต
- **ควบคุมได้ทั้งหมด** — credential ของคุณถูกเก็บในฐานข้อมูล SQLite ภายในเครื่อง การยืนยันตัวของ dashboard (รหัสผ่านหรือ SSO ผ่าน OIDC/SAML), การควบคุมการเข้าถึงราย key, rate limiting, security header และ relay secret แยกตาม deployment สำหรับ pool proxy แบบ serverless

## หลักการทำงาน

```
Claude Code ─┐                              ┌─ Anthropic / Claude OAuth
Cursor ──────┤   /v1 (OpenAI, Responses,    ├─ OpenAI / Codex / GitHub Copilot
Codex CLI ───┼─▶ รูปแบบ Anthropic, Gemini) ──┼─ Gemini / Vertex / Antigravity
ทุก client ───┤   เกตเวย์ 9Router AegisX      ├─ 40+ executor ของ provider
             └──────────────────────────────┴─ (OAuth, API-key, ระดับฟรี)
                     │
                     ├─ เลเยอร์แปลง (request/response, 4 wire format)
                     ├─ combo engine (fallback · round-robin · smart · fusion)
                     ├─ token saver (RTK · dedup · History GC · cache)
                     └─ ที่เก็บ usage แบบ SQLite + dashboard (localhost:20128)
```

แผนผัง component ฉบับเต็ม: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## เริ่มใช้งานอย่างรวดเร็ว

สิ่งที่ต้องมี: Node.js ≥ 22 (image ของ Docker pin ที่ 22.23.4)

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start    # ให้บริการที่ http://localhost:20128
```


**Docker (build จากซอร์ส):**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

image จาก registry ของ upstream (`decolua/9router` บน Docker Hub / GHCR) ก็รัน codebase นี้ได้เช่นกันหากคุณต้องการของสำเร็จรูป ดู [DOCKER.md](./DOCKER.md) สำหรับ compose, healthcheck และการอัปเกรด

**เข้าสู่ระบบครั้งแรก** — รหัสผ่าน dashboard แบบสุ่มเฉพาะการติดตั้งจะถูกสร้างและพิมพ์ไปที่คอนโซลของเซิร์ฟเวอร์เมื่อรันครั้งแรก (เก็บไว้ที่ `DATA_DIR/initial-password` จนกว่าคุณจะตั้งรหัสถาวร) ตั้ง `INITIAL_PASSWORD` เพื่อระบุรหัสของคุณเองได้

## เชื่อมต่อเครื่องมือของคุณ

ชี้ client ที่รองรับ OpenAI ตัวใดก็ได้ไปที่ gateway แล้วเลือกโมเดลด้วย prefix `provider/`:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| รูปแบบ wire | Endpoint | ใช้กับ |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor, Cline และเครื่องมือส่วนใหญ่ |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI, Antigravity |

บริการเพิ่มเติม: `/v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS) และ MCP server ภายใต้ `/api/mcp`

หน้า **CLI Tools** ของ dashboard จะเขียน base URL และ model ID ที่ถูกต้องลงใน config ของแต่ละเครื่องมือให้อัตโนมัติ (หรือใช้คำสั่ง `connect` ของ `cli/`) prefix ของ provider ที่พบบ่อย: `cc/` Claude, `cx/` Codex, `gc/` Gemini CLI, `glm/`, `if/` iFlow, `kr/` Kiro, `oc/` OpenCode, `tr/` Trae, `ws/` Windsurf — รายการล่าสุดทั้งหมดอยู่ที่ `/v1/models` และตัวเลือกโมเดลบน dashboard

## คอมโบ (Combos)

combo คือ model ID หนึ่งตัวที่มีลูกโซ่เรียงลำดับพร้อมกลยุทธ์รองรับ:

1. **Fallback** — ลองสมาชิกตามลำดับ ข้ามไปตัวถัดไปเมื่อเจอ 429/5xx, ข้อผิดพลาดชั่วคราว และ 4xx ระดับคำขอ
2. **Round Robin** — หมุนเวียนข้ามคำขอ (ตั้งขอบเขต sticky ได้)
3. **Smart Router (System One)** — decision model เลือกสมาชิกที่ดีที่สุดต่อ prompt โดยมีนโยบาย session ที่คง prompt cache ของ provider ให้อุ่นไว้ (Smart Switch ความมั่นใจ ≥80%, Strict Lock ใช้ซ้ำทั้งหมดแบบ latency เป็นศูนย์ หรือ Per-Turn)
4. **Fusion** — สอบถามสมาชิกทั้งหมดแบบขนาน judge model หนึ่งตัวจะสังเคราะห์คำตอบสุดท้าย (คุณภาพสูงสุด, คิดค่าบริการแบบ N+1)

## Token Saver

ถูกนำไปใช้กับ body สุดท้ายของคำขอก่อนส่งออก saver แต่ละตัวเปิด/ปิดแยกกันได้ และ scoreboard บน dashboard (`Usage → Token Saver Scoreboard`, `GET /api/usage/savers`) ติดตามจำนวน hit และจำนวน byte ที่ประหยัดได้แบบเรียลไทม์

| Saver | ผลลัพธ์ | ค่าเริ่มต้น |
|---|---|---|
| ตัวกรอง RTK | บีบอัดแบบไม่สูญเสียข้อมูลตามชนิดข้อมูลสำหรับ `git diff`, `grep`, `ls`, `tree`, log… | เปิด |
| ลบ tool-result ซ้ำ | output ของเครื่องมือที่ซ้ำกันเป็นไบต์ → อ้างอิงหนึ่งบรรทัด | เปิด |
| ตัวกรอง test-runner | เก็บส่วนที่ fail + สรุป ตัดกำแพงที่ผ่านทิ้ง (vitest/jest/pytest/go/mocha/TAP) | อัตโนมัติ |
| History GC | บีบผลลัพธ์เครื่องมือที่เก่ากว่า N รอบผู้ใช้ล่าสุดให้เป็น digest | ปิด (`historyGcEnabled`, N=6) |
| Response cache | cache แบบ exact-request สำหรับแชทที่ไม่ stream (LRU+TTL, `x-9r-cache: hit`) | ปิด |
| ระบุ system prompt เอง | แทรก system prompt ของคุณเองลงในทุกรูปแบบ wire | ปิด |
| Headroom / Caveman / Ponytail / Pxpipe | ตัวบีบอัดภายนอก, โหมด output กระชับ, แนวโน้มโค้ดมินิมอล, บริบทข้อความ→รูปภาพ | ปิด |

```bash
node scripts/enable-token-savers.mjs          # เปิดชุดปลอดภัย (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

ข้ามทั้งหมดสำหรับคำขอเดียวด้วย header `X-9Router-Token-Saver: off`

## ความปลอดภัย

- การยืนยันตัวของ dashboard: เข้าสู่ระบบด้วยรหัสผ่าน (ตัวจำกัดการเข้าสู่ระบบ, cookie session แบบ JWT) หรือ SSO (OIDC / SAML) `requireLogin=false` ใช้เฉพาะการติดตั้งที่ local เต็มรูปแบบ
- API key พร้อมการควบคุมการเข้าถึงราย key (จำกัดเฉพาะ combo/model ที่อนุญาต), `REQUIRE_API_KEY` แบบเลือกได้บน `/v1/*`
- จำกัดอัตราต่อ key/ต่อ IP บน `/v1` (`rateLimitPerMinute`, ค่าเริ่มต้น 600)
- security header (CSP, X-Frame-Options, nosniff, Referrer-Policy) ปิดบัง credential ใน log และการตอบสนอง API สถิติการใช้งานไม่เปิดเผย API key ดิบ
- โฟลว์ OAuth ผูก `state` (cookie + เปรียบเทียบฝั่ง client) และ proxy callback แบบ loopback ปฏิเสธคำขอข้าม origin
- pool ของ relay proxy แบบ serverless ปรับใช้ด้วย shared secret เฉพาะ deployment (`x-relay-secret`)

## การตั้งค่า

ข้อมูลอยู่ใน SQLite ที่ `DATA_DIR/db/data.sqlite` (ค่าเริ่มต้น `~/.9router`) ตัวแปรสภาพแวดล้อมหลัก — สัญญาฉบับเต็มอยู่ใน [.env.example](./.env.example):

| ตัวแปร | ค่าเริ่มต้น | วัตถุประสงค์ |
|---|---|---|
| `DATA_DIR` | `~/.9router` | ฐานข้อมูล, การติดตั้ง runtime, secret |
| `PORT` | `20128` (Docker) | พอร์ตรับฟัง — script npm ส่ง `--port` แบบระบุชัด ส่วน Docker อาศัย env นี้ |
| `INITIAL_PASSWORD` | *(สุ่มให้)* | แทนที่รหัสผ่านสุ่มของการรันครั้งแรก |
| `JWT_SECRET` | *(สุ่มให้)* | การเซ็น session ของ dashboard (ตั้งเพื่อใช้ร่วมกันระหว่าง instance) |
| `API_KEY_SECRET` | *(สุ่มให้)* | HMAC สำหรับ checksum ของ API key — ตั้งแยกต่อการติดตั้ง |
| `BASE_URL` | `http://localhost:20128` | การคลี่ callback ของ SSO |
| `REQUIRE_API_KEY` | `false` | บังคับใช้ API key ของ gateway บน `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | ตั้ง `true` เมื่ออยู่หลัง proxy HTTPS |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | proxy ขาออกสำหรับการเรียก upstream |

ส่วนเสริมด้านการดูแลระบบ: `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`, `HEADROOM_URL`, ตัวจำกัดอัตราของ `/v1` (`rateLimitPerMinute`, ค่าเริ่มต้น 600 — เป็นการตั้งค่าบน dashboard ไม่ใช่ env), pool ของ proxy (รวม relay ที่ปรับใช้เองบน Netlify/Vercel/Cloudflare/Deno) และ tunnel ของ Cloudflare/Tailscale สำหรับการเข้าถึงระยะไกล

## เอกสาร

| เอกสาร | เนื้อหา |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | แผนที่ระบบฉบับเต็ม — ผิวสัมผัส API, แกนกลางการกำหนดเส้นทาง, executor, saver, การจัดเก็บ, ความปลอดภัย, การปรับใช้ |
| [CHANGELOG.md](./CHANGELOG.md) | ประวัติการเผยแพร่ รวมถึงรอบการเสริมความปลอดภัย AegisX |
| [DOCKER.md](./DOCKER.md) | การปรับใช้คอนเทนเนอร์, compose, healthcheck |
| [gitbook/](./gitbook/) | ไซต์เอกสารใน repo (en, vi, zh-CN, es, ja) — เริ่มใช้งานอย่างรวดเร็ว, provider, ฟีเจอร์, การเชื่อมต่อ |
| [cli/](./cli/) | แพ็กเกจ CLI ประกอบ (connect, profile, hook) |
| [i18n/](./i18n/) | คำแปล README โดยชุมชน (10 ภาษา) |

## การพัฒนา

```bash
npm install
npm run build        # build production ของ Next.js (CI รันขั้นตอนนี้ + lint + baseline)
npm start            # custom-server.js บน :20128

cd tests && npm install
npx vitest run       # unit test 4,100+ รายการ (ชุด STT ต้องใช้ ffmpeg)
npx eslint src open-sse scripts   # ด่าน lint: 0 error
```

CI (GitHub Actions): lint → ตรวจ baseline ของ provider/alias → build → ชุด unit test ฉบับเต็ม workflow เฉพาะต้นน้ำ (deploy gitbook, publish Docker, tray ของ macOS) เรียกใช้แบบ dispatch เท่านั้นและถูกกันไว้เฉพาะ repo ต้นน้ำ

## การสนับสนุน

- **Issue และ PR**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **โปรเจกต์ต้นน้ำ**: [decolua/9router](https://github.com/decolua/9router) — รากฐานที่ fork นี้สร้างขึ้นบน ขอขอบคุณ

## สัญญาอนุญาต

[MIT](./LICENSE)
