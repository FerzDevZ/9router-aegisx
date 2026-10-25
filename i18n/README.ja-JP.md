<div align="center">

<img src="./images/9router.png" alt="9Router AegisX" width="720"/>

# 9Router AegisX

**コーディングアシスタント向けセルフホスト AI ゲートウェイ — 単一エンドポイント、40+ プロバイダー、100+ モデル、そしてプロンプトコストを 20–40% 削減する Token Saver パイプライン。**

[![CI](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml/badge.svg)](https://github.com/FerzDevZ/9router-aegisx/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![Base](https://img.shields.io/badge/Based%20on-9router%20v0.5.109-blueviolet)](https://github.com/decolua/9router)

[9router](https://github.com/decolua/9router) のハードニング済み・独立メンテナンス fork です — 上流の全機能に加え、セキュリティ強化、正確な token 課金、4,100+ のユニットテストでグリーンの CI、刷新されたドキュメントを提供します。差分は [CHANGELOG](./CHANGELOG.md) を参照。

[ドキュメント](#ドキュメント) · [クイックスタート](#クイックスタート) · [アーキテクチャ](./docs/ARCHITECTURE.md) · [変更履歴](./CHANGELOG.md)

</div>

---

## できること

9Router AegisX は、AI コーディングツールとそのプロバイダーの間に位置します:

- **単一の OpenAI/Anthropic/Gemini 互換エンドポイント** — Claude Code、Codex CLI、Cursor、Cline、Roo、Continue、Gemini CLI、OpenCode、OpenClaw、Crush、Droid、Kilo などが `http://localhost:20128/v1` を指し、`provider/model` ID でルーティングします。
- **フォールバック戦略付き Combos** — サブスクリプション → 低価格 → 無料ティアのチェーン（順次 fallback、round-robin、prompt-cache を考慮したセッションポリシーを持つ System One スマートルーティング、または judge model による並列 fusion）。
- **Token Saver** — RTK 出力フィルター、ツール結果の重複排除、History GC、レスポンスキャッシュ、Headroom/Caveman/Ponytail/Pxpipe 統合。各 saver の節約量を示すライブスコアボード付き。
- **使用分析** — プロバイダー/モデル/キーごとの token とコストの追跡、キャッシュヒット率、リクエスト詳細、リセット時の自動 ping 付きクォータ追跡。
- **フルコントロール** — 認証情報はローカルの SQLite データベースに保存。ダッシュボード認証（パスワードまたは OIDC/SAML 経由の SSO）、キーごとのアクセス制御、レート制限、セキュリティヘッダー、サーバーレスプロキシプール向けのデプロイごとのリレーシークレット。

## 仕組み

```
Claude Code ─┐                              ┌─ Anthropic / Claude OAuth
Cursor ──────┤   /v1 (OpenAI, Responses,    ├─ OpenAI / Codex / GitHub Copilot
Codex CLI ───┼─▶ Anthropic, Gemini 形式) ───┼─ Gemini / Vertex / Antigravity
各種client ──┤   9Router AegisX gateway     ├─ 40+ プロバイダー executor
             └──────────────────────────────┴─ (OAuth、API-key、無料枠)
                     │
                     ├─ 変換レイヤー (request/response、4 wire format)
                     ├─ コンボエンジン (fallback · round-robin · smart · fusion)
                     ├─ Token Saver (RTK · dedup · History GC · cache)
                     └─ SQLite 使用量ストア + ダッシュボード (localhost:20128)
```

完全なコンポーネントマップ: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)。

## クイックスタート

要件: Node.js ≥ 22（Docker イメージは 22.23.4 に固定）。

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
npm install
npm run build
npm start -- --port 20128    # http://localhost:20128 で起動
```

> npm スクリプトのデフォルトポートは **20127**、Docker とこの README のすべての例は **20128** を使用します — 上記のように `-- --port 20128` を渡してください（または独自のポートを指定）。

**Docker（ソースからビルド）:**

```bash
git clone https://github.com/FerzDevZ/9router-aegisx.git
cd 9router-aegisx
docker build -t 9router-aegisx .
docker run -d --name 9router -p 20128:20128 \
  -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data 9router-aegisx
```

アップストリームのレジストリイメージ（Docker Hub / GHCR の `decolua/9router`）でもこのコードベースをそのまま実行できます。compose、ヘルスチェック、アップグレードについては [DOCKER.md](./DOCKER.md) を参照。

**初回ログイン** — 初回実行時にインストールごとのランダムなダッシュボードパスワードが生成され、サーバーコンソールに出力されます（永続的なパスワードを設定するまで `DATA_DIR/initial-password` に保存）。`INITIAL_PASSWORD` を設定すると自分で指定できます。

## ツールの接続

任意の OpenAI 互換クライアントをゲートウェイに向け、`provider/` プレフィックス付きのモデルを選択します:

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"cc/claude-sonnet","messages":[{"role":"user","content":"hi"}]}'
```

| ワイヤーフォーマット | エンドポイント | 対象ツール |
|---|---|---|
| OpenAI Chat | `/v1/chat/completions` | Cursor、Cline、ほとんどのツール |
| OpenAI Responses | `/v1/responses` | Codex CLI |
| Anthropic Messages | `/v1/messages` | Claude Code |
| Gemini | `/v1beta/models/...` | Gemini CLI、Antigravity |

その他に提供: `/v1/models`、`/v1/embeddings`、`/v1/images/generations`、`/v1/audio/transcriptions` + `/v1/audio/speech`（STT/TTS）、および `/api/mcp` 配下の MCP サーバー。

ダッシュボードの **CLI Tools** ページが、各ツールの設定に正しいベース URL とモデル ID を書き込みます（または `cli/` の `connect` コマンドを使用）。一般的なプロバイダープレフィックス: `cc/` Claude、`cx/` Codex、`gc/` Gemini CLI、`glm/`、`if/` iFlow、`kr/` Kiro、`oc/` OpenCode、`tr/` Trae、`ws/` Windsurf — 完全なライブリストは `/v1/models` とダッシュボードのモデルピッカーにあります。

## コンボ（Combos）

コンボとは、戦略付きの順序付きチェーンで支えられる 1 つのモデル ID です:

1. **Fallback** — メンバーを順に試行。429/5xx、一時的エラー、リクエストスコープの 4xx で次へ進みます。
2. **Round Robin** — リクエスト間でローテーション（スティッキー上限は設定可能）。
3. **Smart Router（System One）** — 意思決定モデルがプロンプトごとに最適なメンバーを選択。プロバイダーのプロンプトキャッシュを温かく保つセッションポリシー付き（信頼度 ≥80% の Smart Switch、レイテンシゼロで完全再利用する Strict Lock、または Per-Turn）。
4. **Fusion** — 全メンバーに並列クエリし、judge model が最終回答を統合（最高品質、N+1 課金）。

## Token Saver

ディスパッチ直前の最終リクエストボディに適用されます。各 saver は個別にオン/オフ可能で、ダッシュボードのスコアボード（`Usage → Token Saver Scoreboard`、`GET /api/usage/savers`）がヒット数と節約バイト数をライブ追跡します。

| Saver | 効果 | デフォルト |
|---|---|---|
| RTK フィルター | `git diff`、`grep`、`ls`、`tree`、ログなどの型awareロスレス圧縮 | オン |
| ツール結果の重複排除 | バイト同一の繰り返しツール出力 → 1 行参照 | オン |
| test-runner フィルター | 失敗 + サマリーを保持し、合格の壁を省略（vitest/jest/pytest/go/mocha/TAP） | 自動 |
| History GC | 直近 N ユーザーターンより古いツール結果をダイジェストに圧縮 | オフ（`historyGcEnabled`、N=6） |
| レスポンスキャッシュ | 非ストリーミングチャットの完全一致リクエストキャッシュ（LRU+TTL、`x-9r-cache: hit`） | オフ |
| カスタムシステムプロンプト | すべてのワイヤーフォーマットに独自のシステムプロンプトを注入 | オフ |
| Headroom / Caveman / Ponytail / Pxpipe | 外部圧縮器、簡潔出力モード、最小コードバイアス、テキスト→画像コンテキスト | オフ |

```bash
node scripts/enable-token-savers.mjs          # 安全なセット（RTK + dedup + GC）を有効化
node scripts/enable-token-savers.mjs --revert
```

単一リクエストですべてをバイパスするには、ヘッダー `X-9Router-Token-Saver: off` を指定します。

## セキュリティ

- ダッシュボード認証: パスワードログイン（ログインリミッター、JWT セッションクッキー）または SSO（OIDC / SAML）。`requireLogin=false` は完全ローカル構成のみ。
- キーごとのアクセス制御付き API キー（許可されたコンボ/モデルに制限）、`/v1/*` でのオプションの `REQUIRE_API_KEY`。
- `/v1` のキーごと/IP ごとのレート制限（`rateLimitPerMinute`、デフォルト 600）。
- セキュリティヘッダー（CSP、X-Frame-Options、nosniff、Referrer-Policy）。ログと API レスポンスでのクレデンシャルマスキング。使用統計は生の API キーを決して露出しません。
- OAuth フローは `state` をバインド（クッキー + クライアント比較）し、ループバックコールバックプロキシはクロスオリジンリクエストを拒否します。
- サーバーレスリレープロキシプールは、デプロイごとの共有シークレット（`x-relay-secret`）でデプロイされます。

## 設定

データは `DATA_DIR/db/data.sqlite` の SQLite に保存されます（デフォルト `~/.9router`）。主要な環境変数 — 完全な仕様は [.env.example](./.env.example):

| 変数 | デフォルト | 用途 |
|---|---|---|
| `DATA_DIR` | `~/.9router` | データベース、ランタイムインストール、シークレット |
| `PORT` | `20127`（npm スクリプト）/ `20128`（Docker） | リッスンポート — npm スクリプトは明示的な `--port` を渡し、Docker はこの環境変数に依存 |
| `INITIAL_PASSWORD` | *（生成）* | 初回実行時のランダムパスワードを上書き |
| `JWT_SECRET` | *（生成）* | ダッシュボードセッションの署名（インスタンス間で共有する場合は設定） |
| `API_KEY_SECRET` | *（生成）* | API キーチェックサムの HMAC — インストールごとに設定 |
| `BASE_URL` | `http://localhost:20128` | SSO コールバックの解決 |
| `REQUIRE_API_KEY` | `false` | `/v1/*` でゲートウェイ API キーを要求 |
| `AUTH_COOKIE_SECURE` | `false` | HTTPS プロキシの背後では `true` に設定 |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | — | 上流呼び出しのアウトバウンドプロキシ |

運用オプション: `ENABLE_REQUEST_LOGS`、`OBSERVABILITY_ENABLED`、`HEADROOM_URL`、`/v1` レート制限（`rateLimitPerMinute`、デフォルト 600 — 環境変数ではなくダッシュボード設定）、プロキシプール（自己デプロイされた Netlify/Vercel/Cloudflare/Deno リレーを含む）、リモートアクセス用の Cloudflare/Tailscale トンネル。

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 完全なシステムマップ — API サーフェス、ルーティングコア、executor、saver、永続化、セキュリティ、デプロイ |
| [CHANGELOG.md](./CHANGELOG.md) | AegisX ハードニングラウンドを含むリリース履歴 |
| [DOCKER.md](./DOCKER.md) | コンテナデプロイ、compose、ヘルスチェック |
| [gitbook/](./gitbook/) | リポジトリ内ドキュメントサイト（en、vi、zh-CN、es、ja） — クイックスタート、プロバイダー、機能、統合 |
| [cli/](./cli/) | コンパニオン CLI パッケージ（connect、プロファイル、hooks） |
| [i18n/](./i18n/) | コミュニティによる README 翻訳（10 言語） |

## 開発

```bash
npm install
npm run build        # Next.js 本番ビルド（CI はこれ + lint + ベースライン検証を実行）
npm start            # custom-server.js を :20128 で起動

cd tests && npm install
npx vitest run       # 4,100+ ユニットテスト（STT スイートには ffmpeg が必要）
npx eslint src open-sse scripts   # lint ゲート: 0 エラー
```

CI（GitHub Actions）: lint → プロバイダー/エイリアスベースライン検証 → ビルド → フルユニットスイート。fork 専用ワークフロー（gitbook デプロイ、Docker パブリッシュ、macOS トレイ）は手動 dispatch のみで、上流リポジトリにガードされています。

## サポート

- **Issue と PR**: [github.com/FerzDevZ/9router-aegisx](https://github.com/FerzDevZ/9router-aegisx/issues)
- **上流プロジェクト**: [decolua/9router](https://github.com/decolua/9router) — この fork の基盤。感謝を込めて。

## ライセンス

[MIT](./LICENSE)
