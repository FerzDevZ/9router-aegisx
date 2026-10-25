<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**Gateway de IA auto-hospedado para assistentes de programação — um único endpoint, 40+ provedores, 100+ modelos e um pipeline Token Saver que corta o gasto de prompts em 20–40%.**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

Um fork endurecido e mantido de forma independente do [9router](https://github.com/decolua/9router) — conjunto completo de funcionalidades do upstream, mais endurecimento de segurança, contabilidade honesta de tokens, um CI verde com uma suíte de 4.100+ testes de unidade e documentação renovada. Veja o [CHANGELOG](./CHANGELOG.md) para o delta.

[Documentação](#documentação) · [Início rápido](#início-rápido) · [Arquitetura](./docs/ARCHITECTURE.md) · [Changelog](./CHANGELOG.md)

</div>

---

## O que ele faz

O 9Router AegisX fica entre suas ferramentas de programação com IA e os provedores delas:

- **Um único endpoint compatível com OpenAI/Anthropic/Gemini** para Claude Code, Codex CLI, Cursor, Cline, Roo, Continue, Gemini CLI, OpenCode, OpenClaw, Crush, Droid, Kilo e mais — aponte-os para `http://localhost:20128/v1` e roteie pelo ID `provedor/modelo`.
- **Combos com estratégias de fallback** — encadeie assinatura → barato → gratuito (fallback sequencial, round-robin, roteamento inteligente System One com políticas de sessão cientes do prompt cache, ou fusão paralela com um modelo juiz).
- **Token Savers** — filtros de saída RTK, deduplicação de resultados de ferramentas, History GC, cache de respostas, integrações Headroom/Caveman/Ponytail/Pxpipe; placar ao vivo do que cada saver economizou.
- **Analytics de uso** — rastreamento de tokens e custos por provedor/modelo/chave, taxa de acerto de cache, detalhes de requisições, acompanhamento de cotas com ping automático no reset.
- **Controle total** — suas credenciais ficam em um banco de dados SQLite local; autenticação do dashboard (senha ou SSO via OIDC/SAML), controle de acesso por chave, rate limiting, cabeçalhos de segurança e segredos de relay por implantação para pools de proxies serverless.

## Como funciona

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

## Início rápido

Requisitos: Node.js ≥ 22 (a imagem Docker fixa a 22.23.4).

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start    # serves http://localhost:20128
```


**Docker (build a partir do código-fonte):**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

As imagens do registro upstream (`decolua/9router` no Docker Hub / GHCR) também executam este código-fonte se você preferir pré-compiladas. Veja [DOCKER.md](./DOCKER.md) para compose, healthcheck e notas de upgrade.

**Primeiro login** — uma senha aleatória do dashboard, exclusiva por instalação, é gerada e impressa no console do servidor na primeira execução (guardada em `DATA_DIR/initial-password` até você definir uma permanente). Defina `INITIAL_PASSWORD` para escolher a sua.

## Conecte suas ferramentas

Aponte qualquer cliente compatível com OpenAI para o gateway e escolha um modelo com seu prefixo `provedor/`:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| Formato de comunicação | Endpoint | Usar com |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor, Cline, a maioria das ferramentas |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI, Antigravity |

Também servidos: `/v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS), e um servidor MCP sob `/api/mcp`.

A página **CLI Tools** do dashboard grava a URL base correta e os IDs de modelo na config de cada ferramenta para você (ou use o comando `connect` de `cli/`). Prefixos comuns de provedores: `cc/` Claude, `cx/` Codex, `gc/` Gemini CLI, `glm/`, `if/` iFlow, `kr/` Kiro, `oc/` OpenCode, `tr/` Trae, `ws/` Windsurf — a lista completa em tempo real está em `/v1/models` e no seletor de modelos do dashboard.

## Combos

Um combo é um ID de modelo apoiado por uma cadeia ordenada com uma estratégia:

1. **Fallback** — tenta os membros em ordem; avança em 429/5xx, erros transitórios e 4xx com escopo de requisição.
2. **Round Robin** — alterna entre requisições (limite de sticky configurável).
3. **Smart Router (System One)** — um modelo de decisão escolhe o melhor membro por prompt, com políticas de sessão que mantêm os prompt caches dos provedores quentes (Smart Switch ≥80% de confiança, Strict Lock = reuso completo sem latência, ou Per-Turn).
4. **Fusion** — consulta todos os membros em paralelo e um modelo juiz sintetiza a resposta final (qualidade máxima, cobrança N+1).

## Token Savers

Aplicados ao corpo final da requisição logo antes do envio; cada saver pode ser ativado ou desativado individualmente e o placar do dashboard (`Usage → Token Saver Scoreboard`, `GET /api/usage/savers`) acompanha ao vivo acertos e bytes economizados.

| Saver | Efeito | Padrão |
|---|---|---|
| Filtros RTK | Compressão sem perdas e ciente do tipo para `git diff`, `grep`, `ls`, `tree`, logs… | ligado |
| Deduplicação de resultados de ferramentas | Saídas de ferramentas repetidas idênticas byte a byte → referência de uma linha | ligado |
| Filtro de test-runner | Mantém falhas + resumo, omite o muro de testes aprovados (vitest/jest/pytest/go/mocha/TAP) | auto |
| History GC | Condensa em resumos os resultados de ferramentas mais antigos que os últimos N turnos do usuário | desligado (`historyGcEnabled`, N=6) |
| Cache de respostas | Cache de requisição exata para chat sem streaming (LRU+TTL, `x-9r-cache: hit`) | desligado |
| System prompt personalizado | Injeta o seu próprio system prompt em todos os formatos de comunicação | desligado |
| Headroom / Caveman / Ponytail / Pxpipe | Compressor externo, modo de saída conciso, viés de código mínimo, contexto texto→imagem | desligado |

```bash
node scripts/enable-token-savers.mjs          # enable the safe set (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

Ignore tudo para uma única requisição com o cabeçalho `X-9Router-Token-Saver: off`.

## Segurança

- Autenticação do dashboard: login com senha (limitador de login, cookie de sessão JWT) ou SSO (OIDC / SAML); `requireLogin=false` apenas para instalações totalmente locais.
- Chaves de API com controle de acesso por chave (restringe aos combos/modelos permitidos), `REQUIRE_API_KEY` opcional em `/v1/*`.
- Rate limiting por chave/IP em `/v1` (`rateLimitPerMinute`, padrão 600).
- Cabeçalhos de segurança (CSP, X-Frame-Options, nosniff, Referrer-Policy); remoção de credenciais em logs e respostas de API; as estatísticas de uso nunca expõem chaves de API brutas.
- Os fluxos OAuth vinculam `state` (cookie + comparação no cliente) e os proxies de callback em loopback rejeitam requisições cross-origin.
- Os pools de proxies de relay serverless são implantados com um segredo compartilhado por implantação (`x-relay-secret`).

## Configuração

Os dados ficam no SQLite em `DATA_DIR/db/data.sqlite` (padrão `~/.9router`). Variáveis de ambiente principais — contrato completo em [.env.example](./.env.example):

| Variável | Padrão | Finalidade |
|---|---|---|
| `DATA_DIR` | `~/.9router` | Banco de dados, instalações de runtime, segredos |
| `PORT` | `20128` (Docker) | Porta de escuta — os scripts npm passam um `--port` explícito; o Docker depende desta variável |
| `INITIAL_PASSWORD` | *(gerada)* | Sobrescreve a senha aleatória da primeira execução |
| `JWT_SECRET` | *(gerado)* | Assinatura das sessões do dashboard (defina para compartilhar entre instâncias) |
| `API_KEY_SECRET` | *(gerado)* | HMAC para checksums de chaves de API — defina por instalação |
| `BASE_URL` | `http://localhost:20128` | Resolução dos callbacks SSO |
| `REQUIRE_API_KEY` | `false` | Exigir uma chave de API do gateway em `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | Defina `true` atrás de um proxy HTTPS |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | Proxy de saída para chamadas upstream |

Extras de operação: `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`, `HEADROOM_URL`, o rate limit de `/v1` (`rateLimitPerMinute`, padrão 600 — uma configuração do dashboard, não uma variável de ambiente), pools de proxies (incluindo relays auto-hospedados em Netlify/Vercel/Cloudflare/Deno) e túneis Cloudflare/Tailscale para acesso remoto.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Mapa completo do sistema — superfície de API, núcleo de roteamento, executores, savers, persistência, segurança, implantação |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de versões incluindo a rodada de endurecimento AegisX |
| [DOCKER.md](./DOCKER.md) | Implantação em contêineres, compose, healthchecks |
| [gitbook/](./gitbook/) | Site de docs no repo (en, vi, zh-CN, es, ja) — início rápido, provedores, recursos, integrações |
| [cli/](./cli/) | Pacote CLI companheiro (connect, perfis, hooks) |
| [i18n/](./i18n/) | Traduções comunitárias do README (10 idiomas) |

## Desenvolvimento

```bash
npm install
npm run build        # Next.js production build (CI runs this + lint + baselines)
npm start            # custom-server.js on :20128

cd tests && npm install
npx vitest run       # 4,100+ unit tests (ffmpeg required for STT suites)
npx eslint src open-sse scripts   # lint gate: 0 errors
```

CI (GitHub Actions): lint → verificação de baselines de provedor/alias → build → suíte completa de testes de unidade. Workflows exclusivos do fork (deploy do gitbook, publicação Docker, tray do macOS) são somente por dispatch e restritos ao repo upstream.

## Suporte

- **Issues e PRs**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **Projeto upstream**: [decolua/9router](https://github.com/decolua/9router) — a base sobre a qual este fork se apoia, com agradecimentos.

## Licença

[MIT](./LICENSE)
