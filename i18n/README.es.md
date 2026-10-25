<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**Pasarela de IA autoalojada para asistentes de programación — un solo endpoint, 40+ proveedores, 100+ modelos y un pipeline Token Saver que recorta el gasto de prompts en 20–40%.**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

Un fork endurecido y mantenido de forma independiente de [9router](https://github.com/decolua/9router) — todo el conjunto de funciones del upstream más endurecimiento de seguridad, contabilidad honesta de tokens, un CI en verde con una suite de más de 4.100 pruebas unitarias y documentación renovada. Consulta el [CHANGELOG](./CHANGELOG.md) para ver el delta.

[Documentación](#documentación) · [Inicio rápido](#inicio-rápido) · [Arquitectura](./docs/ARCHITECTURE.md) · [Changelog](./CHANGELOG.md)

</div>

---

## Qué hace

9Router AegisX se sitúa entre tus herramientas de programación con IA y sus proveedores:

- **Un único endpoint compatible con OpenAI/Anthropic/Gemini** para Claude Code, Codex CLI, Cursor, Cline, Roo, Continue, Gemini CLI, OpenCode, OpenClaw, Crush, Droid, Kilo y más — apúntalos a `http://localhost:20128/v1` y enruta por ID `proveedor/modelo`.
- **Combos con estrategias de fallback** — encadena niveles suscripción → económico → gratuito (fallback secuencial, round-robin, enrutamiento inteligente System One con políticas de sesión conscientes del prompt cache, o fusión paralela con un modelo juez).
- **Token Savers** — filtros de salida RTK, deduplicación de resultados de herramientas, History GC, caché de respuestas, integraciones Headroom/Caveman/Ponytail/Pxpipe; marcador en vivo de lo que ahorra cada saver.
- **Analítica de uso** — seguimiento de tokens y costes por proveedor/modelo/clave, tasa de acierto de caché, detalles de peticiones, seguimiento de cuotas con ping automático al restablecerse.
- **Control total** — tus credenciales permanecen en una base de datos SQLite local; autenticación del dashboard (contraseña o SSO vía OIDC/SAML), control de acceso por clave, limitación de tasa, cabeceras de seguridad y secretos de relay por despliegue para pools de proxies serverless.

## Cómo funciona

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

Mapa completo de componentes: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Inicio rápido

Requisitos: Node.js ≥ 22 (la imagen Docker fija la 22.23.4).

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start    # serves http://localhost:20128
```


**Docker (compilar desde el código fuente):**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

Las imágenes del registro upstream (`decolua/9router` en Docker Hub / GHCR) también ejecutan este código base si prefieres binarios precompilados. Consulta [DOCKER.md](./DOCKER.md) para notas de compose, healthcheck y actualizaciones.

**Primer inicio de sesión** — se genera una contraseña aleatoria del dashboard única por instalación y se imprime en la consola del servidor en la primera ejecución (guardada en `DATA_DIR/initial-password` hasta que fijes una permanente). Define `INITIAL_PASSWORD` para elegir la tuya.

## Conecta tus herramientas

Apunta cualquier cliente compatible con OpenAI a la pasarela y elige un modelo con su prefijo `proveedor/`:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| Formato de comunicación | Endpoint | Usar con |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor, Cline, la mayoría de herramientas |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI, Antigravity |

También se sirven: `/v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS), y un servidor MCP bajo `/api/mcp`.

La página **CLI Tools** del dashboard escribe la URL base correcta y los IDs de modelo en la configuración de cada herramienta por ti (o usa el comando `connect` de `cli/`). Prefijos de proveedor habituales: `cc/` Claude, `cx/` Codex, `gc/` Gemini CLI, `glm/`, `if/` iFlow, `kr/` Kiro, `oc/` OpenCode, `tr/` Trae, `ws/` Windsurf — la lista completa en vivo está en `/v1/models` y en el selector de modelos del dashboard.

## Combos

Un combo es un ID de modelo respaldado por una cadena ordenada con una estrategia:

1. **Fallback** — prueba los miembros en orden; avanza ante 429/5xx, errores transitorios y 4xx de ámbito de petición.
2. **Round Robin** — rota entre peticiones (límite de permanencia configurable).
3. **Smart Router (System One)** — un modelo de decisión elige el mejor miembro por prompt, con políticas de sesión que mantienen calientes las prompt caches de cada proveedor (Smart Switch ≥80% de confianza, Strict Lock = reutilización total sin latencia, o Per-Turn).
4. **Fusion** — consulta todos los miembros en paralelo y un modelo juez sintetiza la respuesta final (máxima calidad, facturación N+1).

## Token Savers

Se aplican al cuerpo final de la petición justo antes del envío; cada saver se puede activar o desactivar individualmente y el marcador del dashboard (`Usage → Token Saver Scoreboard`, `GET /api/usage/savers`) registra en vivo aciertos y bytes ahorrados.

| Saver | Efecto | Por defecto |
|---|---|---|
| Filtros RTK | Compresión sin pérdida consciente del tipo para `git diff`, `grep`, `ls`, `tree`, logs… | activado |
| Deduplicación de resultados de herramientas | Salidas de herramientas repetidas idénticas byte a byte → referencia de una línea | activado |
| Filtro de test-runner | Conserva fallos + resumen, omite el muro de pruebas superadas (vitest/jest/pytest/go/mocha/TAP) | auto |
| History GC | Comprime a resúmenes los resultados de herramientas anteriores a las últimas N intervenciones del usuario | desactivado (`historyGcEnabled`, N=6) |
| Caché de respuestas | Caché de petición exacta para chat sin streaming (LRU+TTL, `x-9r-cache: hit`) | desactivado |
| System prompt personalizado | Inyecta tu propio system prompt en todos los formatos de comunicación | desactivado |
| Headroom / Caveman / Ponytail / Pxpipe | Compresor externo, modo de salida conciso, sesgo de código mínimo, contexto texto→imagen | desactivado |

```bash
node scripts/enable-token-savers.mjs          # enable the safe set (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

Omite todo para una única petición con la cabecera `X-9Router-Token-Saver: off`.

## Seguridad

- Autenticación del dashboard: inicio de sesión con contraseña (limitador de inicio de sesión, cookie de sesión JWT) o SSO (OIDC / SAML); `requireLogin=false` solo para entornos completamente locales.
- Claves API con control de acceso por clave (restringe a combos/modelos permitidos), `REQUIRE_API_KEY` opcional en `/v1/*`.
- Limitación de tasa por clave/IP en `/v1` (`rateLimitPerMinute`, 600 por defecto).
- Cabeceras de seguridad (CSP, X-Frame-Options, nosniff, Referrer-Policy); redacción de credenciales en logs y respuestas de API; las estadísticas de uso nunca exponen claves API en bruto.
- Los flujos OAuth vinculan `state` (cookie + comparación en cliente) y los proxies de callback en loopback rechazan peticiones de origen cruzado.
- Los pools de proxies de relay serverless se despliegan con un secreto compartido por despliegue (`x-relay-secret`).

## Configuración

Los datos viven en SQLite en `DATA_DIR/db/data.sqlite` (por defecto `~/.9router`). Variables de entorno clave — contrato completo en [.env.example](./.env.example):

| Variable | Por defecto | Propósito |
|---|---|---|
| `DATA_DIR` | `~/.9router` | Base de datos, instalaciones de runtime, secretos |
| `PORT` | `20128` (Docker) | Puerto de escucha — los scripts npm pasan un `--port` explícito; Docker depende de esta variable |
| `INITIAL_PASSWORD` | *(generada)* | Sobrescribe la contraseña aleatoria de la primera ejecución |
| `JWT_SECRET` | *(generado)* | Firma de sesiones del dashboard (defínelo para compartir entre instancias) |
| `API_KEY_SECRET` | *(generado)* | HMAC para checksums de claves API — defínelo por instalación |
| `BASE_URL` | `http://localhost:20128` | Resolución de callbacks SSO |
| `REQUIRE_API_KEY` | `false` | Exigir una clave API de la pasarela en `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | Pon `true` detrás de un proxy HTTPS |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | Proxy de salida para llamadas upstream |

Extras de operación: `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`, `HEADROOM_URL`, el límite de tasa de `/v1` (`rateLimitPerMinute`, 600 por defecto — un ajuste del dashboard, no una variable de entorno), pools de proxies (incluidos relays auto-desplegados en Netlify/Vercel/Cloudflare/Deno) y túneles Cloudflare/Tailscale para acceso remoto.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Mapa completo del sistema — superficie de API, núcleo de enrutamiento, ejecutores, savers, persistencia, seguridad, despliegue |
| [CHANGELOG.md](./CHANGELOG.md) | Historial de versiones incluida la ronda de endurecimiento AegisX |
| [DOCKER.md](./DOCKER.md) | Despliegue en contenedores, compose, healthchecks |
| [gitbook/](./gitbook/) | Sitio de docs en el repo (en, vi, zh-CN, es, ja) — inicio rápido, proveedores, funciones, integraciones |
| [cli/](./cli/) | Paquete CLI complementario (connect, perfiles, hooks) |
| [i18n/](./i18n/) | Traducciones comunitarias del README (10 idiomas) |

## Desarrollo

```bash
npm install
npm run build        # Next.js production build (CI runs this + lint + baselines)
npm start            # custom-server.js on :20128

cd tests && npm install
npx vitest run       # 4,100+ unit tests (ffmpeg required for STT suites)
npx eslint src open-sse scripts   # lint gate: 0 errors
```

CI (GitHub Actions): lint → verificación de baselines de proveedor/alias → build → suite completa de pruebas unitarias. Los workflows exclusivos del fork (despliegue de gitbook, publicación de Docker, bandeja de macOS) son solo por dispatch y están limitados al repo upstream.

## Soporte

- **Issues y PRs**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **Proyecto upstream**: [decolua/9router](https://github.com/decolua/9router) — la base sobre la que se construye este fork, con agradecimiento.

## Licencia

[MIT](./LICENSE)
