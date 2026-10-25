<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**Passerelle IA auto-hébergée pour assistants de codage — un seul endpoint, plus de 40 fournisseurs, plus de 100 modèles, et un pipeline Token Saver qui réduit les dépenses de prompts de 20–40%.**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

Un fork durci et maintenu indépendamment de [9router](https://github.com/decolua/9router) — l'ensemble complet des fonctionnalités amont, plus durcissement de la sécurité, comptabilisation honnête des tokens, une CI verte avec une suite de plus de 4 100 tests unitaires, et une documentation actualisée. Voir le [CHANGELOG](./CHANGELOG.md) pour le détail des changements.

[Documentation](#documentation) · [Démarrage rapide](#démarrage-rapide) · [Architecture](./docs/ARCHITECTURE.md) · [Changelog](./CHANGELOG.md)

</div>

---

## Ce qu'il fait

9Router AegisX s'intercale entre vos outils de codage IA et leurs fournisseurs :

- **Un endpoint unique compatible OpenAI/Anthropic/Gemini** pour Claude Code, Codex CLI, Cursor, Cline, Roo, Continue, Gemini CLI, OpenCode, OpenClaw, Crush, Droid, Kilo et d'autres — pointez-les vers `http://localhost:20128/v1` et routez par ID `fournisseur/modèle`.
- **Combos avec stratégies de fallback** — enchaînez abonnement → économique → gratuit (fallback séquentiel, round-robin, routage intelligent System One avec des politiques de session tenant compte du prompt cache, ou fusion parallèle avec un modèle juge).
- **Token Savers** — filtres de sortie RTK, déduplication des résultats d'outils, History GC, cache de réponses, intégrations Headroom/Caveman/Ponytail/Pxpipe ; tableau de scores en direct de ce que chaque saver a économisé.
- **Analytique d'utilisation** — suivi des tokens et coûts par fournisseur/modèle/clé, taux de réussite du cache, détails des requêtes, suivi des quotas avec ping automatique à la réinitialisation.
- **Contrôle total** — vos identifiants restent dans une base SQLite locale ; authentification du dashboard (mot de passe ou SSO via OIDC/SAML), contrôle d'accès par clé, limitation de débit, en-têtes de sécurité et secrets de relay par déploiement pour les pools de proxies serverless.

## Comment ça marche

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

Carte complète des composants : [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Démarrage rapide

Prérequis : Node.js ≥ 22 (l'image Docker fixe la 22.23.4).

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start    # serves http://localhost:20128
```


**Docker (build depuis les sources) :**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

Les images du registre amont (`decolua/9router` sur Docker Hub / GHCR) exécutent aussi ce code si vous préférez du précompilé. Voir [DOCKER.md](./DOCKER.md) pour compose, healthcheck et notes de mise à niveau.

**Première connexion** — un mot de passe aléatoire du dashboard, propre à l'installation, est généré et affiché dans la console du serveur au premier démarrage (stocké dans `DATA_DIR/initial-password` jusqu'à ce que vous en définissiez un permanent). Définissez `INITIAL_PASSWORD` pour choisir le vôtre.

## Connectez vos outils

Pointez n'importe quel client compatible OpenAI vers la passerelle et choisissez un modèle avec son préfixe `fournisseur/` :

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| Format wire | Endpoint | À utiliser avec |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor, Cline, la plupart des outils |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI, Antigravity |

Également servis : `/v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/transcriptions` + `/v1/audio/speech` (STT/TTS), et un serveur MCP sous `/api/mcp`.

La page **CLI Tools** du dashboard écrit la bonne URL de base et les IDs de modèle dans la config de chaque outil pour vous (ou utilisez la commande `connect` de `cli/`). Préfixes fournisseurs courants : `cc/` Claude, `cx/` Codex, `gc/` Gemini CLI, `glm/`, `if/` iFlow, `kr/` Kiro, `oc/` OpenCode, `tr/` Trae, `ws/` Windsurf — la liste complète en direct est sur `/v1/models` et dans le sélecteur de modèles du dashboard.

## Combos

Un combo est un ID de modèle adossé à une chaîne ordonnée avec une stratégie :

1. **Fallback** — essaie les membres dans l'ordre ; avance sur 429/5xx, erreurs transitoires et 4xx limitées à la requête.
2. **Round Robin** — rotation entre les requêtes (limite de sticky configurable).
3. **Smart Router (System One)** — un modèle de décision choisit le meilleur membre par prompt, avec des politiques de session qui gardent les prompt caches des fournisseurs au chaud (Smart Switch ≥80% de confiance, Strict Lock = réutilisation complète sans latence, ou Per-Turn).
4. **Fusion** — interroge tous les membres en parallèle, un modèle juge synthétise la réponse finale (qualité maximale, facturation N+1).

## Token Savers

Appliqués au corps final de la requête juste avant l'envoi ; chaque saver s'active ou se désactive individuellement et le tableau de scores du dashboard (`Usage → Token Saver Scoreboard`, `GET /api/usage/savers`) suit en direct les succès et les octets économisés.

| Saver | Effet | Défaut |
|---|---|---|
| Filtres RTK | Compression sans perte et sensible au type pour `git diff`, `grep`, `ls`, `tree`, logs… | activé |
| Déduplication des résultats d'outils | Sorties d'outils répétées identiques octet par octet → référence sur une ligne | activé |
| Filtre test-runner | Garde les échecs + le résumé, masque le mur des succès (vitest/jest/pytest/go/mocha/TAP) | auto |
| History GC | Condense en résumés les résultats d'outils plus vieux que les N derniers tours utilisateur | désactivé (`historyGcEnabled`, N=6) |
| Cache de réponses | Cache exact-par-requête pour le chat non streamé (LRU+TTL, `x-9r-cache: hit`) | désactivé |
| System prompt personnalisé | Injecte votre propre system prompt dans tous les formats wire | désactivé |
| Headroom / Caveman / Ponytail / Pxpipe | Compresseur externe, mode sortie concise, biais code minimal, contexte texte→image | désactivé |

```bash
node scripts/enable-token-savers.mjs          # enable the safe set (RTK + dedup + GC)
node scripts/enable-token-savers.mjs --revert
```

Contournez tout pour une requête unique avec l'en-tête `X-9Router-Token-Saver: off`.

## Sécurité

- Authentification du dashboard : connexion par mot de passe (limiteur de connexions, cookie de session JWT) ou SSO (OIDC / SAML) ; `requireLogin=false` uniquement pour les installations totalement locales.
- Clés API avec contrôle d'accès par clé (restriction aux combos/modèles autorisés), `REQUIRE_API_KEY` optionnel sur `/v1/*`.
- Limitation de débit par clé/IP sur `/v1` (`rateLimitPerMinute`, 600 par défaut).
- En-têtes de sécurité (CSP, X-Frame-Options, nosniff, Referrer-Policy) ; masquage des identifiants dans les logs et réponses API ; les statistiques d'utilisation n'exposent jamais les clés API brutes.
- Les flux OAuth lient `state` (cookie + comparaison côté client) et les proxies de callback en loopback rejettent les requêtes cross-origin.
- Les pools de proxies de relais serverless se déploient avec un secret partagé par déploiement (`x-relay-secret`).

## Configuration

Les données vivent dans SQLite à `DATA_DIR/db/data.sqlite` (`~/.9router` par défaut). Variables d'environnement clés — contrat complet dans [.env.example](./.env.example) :

| Variable | Défaut | Rôle |
|---|---|---|
| `DATA_DIR` | `~/.9router` | Base de données, installations runtime, secrets |
| `PORT` | `20128` (Docker) | Port d'écoute — les scripts npm passent un `--port` explicite ; Docker s'appuie sur cette variable |
| `INITIAL_PASSWORD` | *(généré)* | Remplace le mot de passe aléatoire du premier démarrage |
| `JWT_SECRET` | *(généré)* | Signature des sessions du dashboard (définissez-le pour partager entre instances) |
| `API_KEY_SECRET` | *(généré)* | HMAC pour les checksums de clés API — à définir par installation |
| `BASE_URL` | `http://localhost:20128` | Résolution des callbacks SSO |
| `REQUIRE_API_KEY` | `false` | Exiger une clé API de la passerelle sur `/v1/*` |
| `AUTH_COOKIE_SECURE` | `false` | Mettez `true` derrière un proxy HTTPS |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | Proxy sortant pour les appels amont |

Extras d'exploitation : `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`, `HEADROOM_URL`, la limite de débit `/v1` (`rateLimitPerMinute`, 600 par défaut — un réglage du dashboard, pas une variable d'environnement), pools de proxies (y compris relais Netlify/Vercel/Cloudflare/Deno auto-déployés) et tunnels Cloudflare/Tailscale pour l'accès distant.

## Documentation

| Doc | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Carte complète du système — surface d'API, cœur de routage, exécuteurs, savers, persistance, sécurité, déploiement |
| [CHANGELOG.md](./CHANGELOG.md) | Historique des versions incluant la phase de durcissement AegisX |
| [DOCKER.md](./DOCKER.md) | Déploiement en conteneurs, compose, healthchecks |
| [gitbook/](./gitbook/) | Site de docs dans le repo (en, vi, zh-CN, es, ja) — démarrage rapide, fournisseurs, fonctionnalités, intégrations |
| [cli/](./cli/) | Paquet CLI compagnon (connect, profils, hooks) |
| [i18n/](./i18n/) | Traductions communautaires du README (10 langues) |

## Développement

```bash
npm install
npm run build        # Next.js production build (CI runs this + lint + baselines)
npm start            # custom-server.js on :20128

cd tests && npm install
npx vitest run       # 4,100+ unit tests (ffmpeg required for STT suites)
npx eslint src open-sse scripts   # lint gate: 0 errors
```

CI (GitHub Actions) : lint → vérification des baselines fournisseurs/alias → build → suite unitaire complète. Les workflows propres au fork (déploiement gitbook, publication Docker, tray macOS) sont en dispatch manuel uniquement et verrouillés sur le repo amont.

## Support

- **Issues et PR** : [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **Projet amont** : [decolua/9router](https://github.com/decolua/9router) — la fondation sur laquelle ce fork s'appuie, avec nos remerciements.

## Licence

[MIT](./LICENSE)
