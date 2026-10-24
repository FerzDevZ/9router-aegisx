# トークン節約（Token Saver）

エージェント型コーディングツールは、プロンプト予算の30〜50%を定型物に浪費します：長大なツール出力（`git diff`、`grep`、テストログ）、重複したツール結果、毎ターン再生される古い履歴。9Router の **Token Saver** は、リクエストがマシンを出る*前に*この死重を削除・圧縮します — セーバーごとに透明で、各自が何を節約したかのライブ・スコアボード付き。

すべてのセーバーはモデルの意思決定に対してロスレスです：重要な失敗や詳細は保持され、冗長な塊だけが圧縮・除去されます。

## セーバー一覧

| セーバー | 機能 | デフォルト |
|---|---|---|
| **RTK フィルター** | ツール出力の種類（git diff/status、grep、find、ls、tree、ログ）を検出し、種類別のロスレス・フィルターで圧縮 | オン |
| **ツール結果 dedup** | 同一リクエスト内のバイト同一ツール出力を 1 行参照に（`duplicate of tool result #N`） | オン |
| **History GC** | 直近 N ユーザーターンより古いツール結果をダイジェスト化（先頭 + サイズ + フィンガープリント + 再実行ヒント） | オフ（`historyGcEnabled`、保持ターン数は設定可、デフォルト 6） |
| **test-runner フィルター** | vitest/jest/pytest/go/mocha/TAP 出力を圧縮 — 失敗 + サマリーを保持、パスの壁は省略 | 自動検出 |
| **レスポンスキャッシュ** | 非ストリーミング chat の完全一致リクエスト・キャッシュ（LRU + TTL）；ヒットは `x-9r-cache: hit` 付き | オフ（`responseCacheEnabled`） |
| **カスタム system prompt** | OpenAI/Claude/Gemini/Kiro リクエスト形状に独自 system prompt を注入 | オフ |
| **Headroom** | ローカル Headroom サービスでコンテキストを圧縮（ツール出力、長文；ネイティブ Gemini/Responses/Claude 形状） | オフ |
| **Caveman** | LLM *出力*が会話に戻る前に圧縮 | オフ |
| **Ponytail** | "怠けたシニア dev" モード — 冗長なアシスタント履歴をトリム | オフ |
| **Pxpipe** | 大きなテキスト文脈を最適化画像に変換（ビジョンモデル向け） | オフ |

## 有効化

ダッシュボード → **Token Saver**：ツール結果 dedup、History GC（保持ターン数入力付き）、レスポンスキャッシュのトグル。

ローカル DB に対して CLI で：

```bash
node scripts/enable-token-savers.mjs            # RTK + dedup + History GC
node scripts/enable-token-savers.mjs --response-cache --smart-combo
node scripts/enable-token-savers.mjs --revert   # デフォルトに戻す
```

## スコアボード

ダッシュボード → **Usage → Token Saver Scoreboard** に、プロセス開始以来の各セーバーのヒット数・節約バイト数・キャッシュ統計をライブ表示（`GET /api/usage/savers`、POST でリセット）。Usage 概要には **Cache Hit Rate** — プロバイダーのプロンプトキャッシュから供給された入力トークンの割合 — も表示されます。

## バイパス

任意の chat リクエストにヘッダー `X-9Router-Token-Saver: off` を付けるだけで、そのリクエストは無変更で送信されます。
