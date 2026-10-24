# Token Saver

Agent coding tools burn 30–50% of your prompt budget on boilerplate: wall-of-text tool outputs (`git diff`, `grep`, test logs), duplicate tool results, and stale history that gets replayed every turn. 9Router's **Token Saver** strips or compresses that dead weight *before* the request leaves your machine — transparently, per saver, with a live scoreboard of what each one saved.

All savers are lossless for the model's decision-making: failures and details that matter are preserved; only redundant bulk is compressed or dropped.

## The savers

| Saver | What it does | Default |
|---|---|---|
| **RTK filters** | Detects tool-output types (git diff/status, grep, find, ls, tree, logs) and compresses them with type-aware, lossless filters | On |
| **Tool-result dedup** | Byte-identical tool outputs repeated in one request become a one-line reference (`duplicate of tool result #N`) | On |
| **History GC** | Tool results older than the last N user turns are squashed to a digest (head + size + fingerprint + re-run hint) | Off (`historyGcEnabled`, keep-turns configurable, default 6) |
| **test-runner filter** | Compresses vitest/jest/pytest/go/mocha/TAP output — keeps failures + summary, elides the passing wall | Auto-detected |
| **Response cache** | Exact-request cache for non-streaming chat (LRU + TTL); hits served with `x-9r-cache: hit` | Off (`responseCacheEnabled`) |
| **Custom system prompt** | Inject your own system prompt across OpenAI/Claude/Gemini/Kiro request shapes | Off |
| **Headroom** | Compresses context through the local Headroom service (tool outputs, long text; native Gemini/Responses/Claude shapes) | Off |
| **Caveman** | Compresses LLM *output* before it re-enters the conversation | Off |
| **Ponytail** | "Lazy senior dev" mode — trims verbose assistant history | Off |
| **Pxpipe** | Transforms large textual context into optimized images (vision models) | Off |

## Enabling

Dashboard → **Token Saver**: toggles for tool-result dedup, History GC (with keep-turns input), and the response cache. Everything else lives on the same page or under the provider's settings.

From the CLI on the local DB:

```bash
node scripts/enable-token-savers.mjs            # RTK + dedup + History GC
node scripts/enable-token-savers.mjs --response-cache --smart-combo
node scripts/enable-token-savers.mjs --revert   # back to defaults
```

## Scoreboard

Dashboard → **Usage → Token Saver Scoreboard** shows live hits, bytes saved, and response-cache stats for every saver since process start (`GET /api/usage/savers`, POST resets). The Usage overview also shows your **Cache Hit Rate** — the share of input tokens served from provider prompt caches.

## Bypassing

Send header `X-9Router-Token-Saver: off` on any single chat request to ship it untouched.
