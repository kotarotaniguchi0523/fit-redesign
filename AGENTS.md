<!-- BEGIN COMPOUND CODEX TOOL MAP -->
## Compound Codex Tool Mapping (Claude Compatibility)

This section maps Claude Code plugin tool references to Codex behavior.
Only this block is managed automatically.

Tool mapping:
- Read: use shell reads (cat/sed) or rg
- Write: create files via shell redirection or apply_patch
- Edit/MultiEdit: use apply_patch
- Bash: use shell_command
- Grep: use rg (fallback: grep)
- Glob: use rg --files or find
- LS: use ls via shell_command
- WebFetch/WebSearch: use curl or Context7 for library docs
- AskUserQuestion/Question: present choices as a numbered list in chat and wait for a reply number. For multi-select (multiSelect: true), accept comma-separated numbers. Never skip or auto-configure — always wait for the user's response before proceeding.
- Task (subagent dispatch) / Subagent / Parallel: run sequentially in main thread; use multi_tool_use.parallel for tool calls
- TaskCreate/TaskUpdate/TaskList/TaskGet/TaskStop/TaskOutput (Claude Code task-tracking, current): use update_plan (Codex's task-tracking primitive)
- TodoWrite/TodoRead (Claude Code task-tracking, legacy — deprecated, replaced by Task* tools): use update_plan
- Skill: open the referenced SKILL.md and follow it
- ExitPlanMode: ignore
<!-- END COMPOUND CODEX TOOL MAP -->

--- project-doc ---

# プロジェクト開発ガイドライン

## プロダクト方針

- 主目的は、情報処理技術者試験の問題と答えを見やすく、すぐ確認できること。
- 回答入力は求めず、「答えを見る」を学習完了として記録する。
- 学習記録と端末間同期は任意機能。問題閲覧の導線を妨げない。
- 認証アカウントは持たない。秘密の同期リンク（同期キー）を端末間で共有する。
- 機能追加では、ページ数・入力・状態・依存関係を増やす前に、既存の単純な導線で解決できないか確認する。

## 技術スタック

- **パッケージマネージャー**: pnpm（npm / yarn 禁止）
- **ランタイム／ホスティング**: Cloudflare Workers
- **Webフレームワーク**: HonoX + Hono、Vite
- **UI**: Hono JSX、Tailwind CSS v4
- **DB**: Cloudflare D1（SQLite）+ Drizzle ORM
- **入力検証**: Zod + `@hono/zod-validator`
- **エラー処理**: neverthrow
- **レート制限**: Cloudflare Workers Rate Limiting binding
- **Lint／Format**: Biome
- **テスト**: Vitest、Hono の `app.request()` によるHTTPテスト
- **未使用コード検査**: Knip
- **ドキュメント**: Showboat

## コマンド

```bash
pnpm dev                       # Vite 開発サーバー
pnpm build                     # クライアントとWorkerをビルド
pnpm preview                   # Wranglerでビルド結果を確認
pnpm format                    # Biome formatを適用
pnpm check                     # Biome CIチェック
pnpm typecheck:full            # プロジェクト全体の型チェック
pnpm test                      # Vitest watch
pnpm test:run                  # Vitestを1回実行
pnpm test:coverage             # カバレッジ付きテスト
pnpm knip                      # 未使用ファイル・依存・exportを検査
pnpm db:migrate:local          # ローカルD1へmigrationを適用
pnpm db:query:local -- "SQL"   # ローカルD1でSQLを実行
pnpm deploy                    # WranglerでWorkerをデプロイ
```

Biomeの対象ファイルだけを修正する場合は、`pnpm exec biome check --write <file>` を使う。

### コミット前チェック

以下を順に実行する。

1. `pnpm format`
2. `pnpm check`
3. `pnpm typecheck:full`
4. `pnpm test:run`
5. `pnpm build`
6. `pnpm knip`

ユーザーから型チェックを指示された場合も `pnpm typecheck:full` を使う。

## アーキテクチャ

```text
app/
├── components/          # 共有Hono JSXコンポーネント
├── features/
│   ├── answer/          # 答え表示とローカル進捗記録
│   ├── markdown/        # 問題のMarkdown変換
│   └── progress/        # 記録画面のクライアントUI
├── routes/              # HonoXファイルベースルート
│   ├── [unit]/[year].tsx
│   ├── progress.ts      # 同期スペース作成・同期・削除API
│   ├── records.tsx      # 学習記録ページ
│   └── markdown.ts      # Markdownエンドポイント
├── server/
│   ├── schema.ts        # Drizzleスキーマの唯一の定義
│   ├── progressRepository.ts
│   ├── progressEntry.ts
│   ├── syncKey.ts
│   └── syncSpaceId.ts
├── data/                # 単元、試験、スライドの静的データ
├── lib/                 # 表示ロジックなどの純粋関数
├── client.ts            # クライアントのエントリポイント
└── server.ts            # Workerのエントリポイント
migrations/              # D1 migration SQL
```

### データフロー

```text
答えを見る
  -> localStorageへ questionId / unitId / revealedAt を保存
  -> 同期が有効な場合だけ POST /progress/sync
  -> 同期キーをSHA-256で同期スペースIDへ変換
  -> D1の question_progress とマージ
  -> マージ結果を端末へ返してlocalStorageを更新
```

- ローカル利用だけなら同期スペースもネットワーク通信も不要。
- D1は `sync_spaces` と `question_progress` を保持する。
- 同期キーの生値をDBへ保存しない。ハッシュ化した同期スペースIDだけを保存する。
- `question_progress` は同期スペース内で問題ごとの最新 `revealedAt` を保持する。
- 同期キーはパスワード相当のcapability。ログ、エラー、分析基盤へ出さない。

## 実装パターン

### HonoXルート

- 画面は可能な限りサーバー描画し、操作が必要な小さな領域だけ `$` 接頭辞のクライアントコンポーネントにする。
- APIサブルーターは `new Hono<Env>()` で構成し、ルートファイルから default exportする。
- JSON入力は `_schemas.ts` のZodスキーマと `_lib.ts` の `validate()` を使う。
- リクエストボディには `_lib.ts` の `postBodyLimit` を適用する。
- APIテストは実サーバーを起動せず、Honoの `app.request()` とテスト用bindingsを使う。

### D1／Drizzle

- DBアクセスは `app/server/progressRepository.ts` に集約する。
- SQL文字列をルートやUIへ直接書かず、`app/server/schema.ts` のDrizzleスキーマを使う。
- DB列は `snake_case`、TypeScriptフィールドは `camelCase` とする。
- `schema.ts` と `migrations/*.sql` は手動で同期する。どちらかを変更したら両方を確認する。
- 永続化境界の失敗は `ResultAsync` と明示的なエラー型で表し、内部原因をHTTP応答へ漏らさない。

### クライアント状態

- 問題閲覧と答え確認はJavaScriptや同期APIが失敗しても利用可能にする。
- `localStorage` の値は信頼せず、読み取り時に軽量な検証を行う。
- 新しい同期キーは、最初の同期が成功してから永続化する。
- クライアントへZodを追加する前に、バンドル増加に見合うか確認する。

### 試験データ

- 単元と年に複数の試験が対応するため、`examMapping[].examNumbers` を配列として扱う。
- 同一問題集合だけでなく、他の試験の真部分集合となる試験も重複表示しない。
- 問題IDをDOM IDや進捗キーに使うため、1ページ内で重複させない。
- 試験データ変更後は `app/data/exams/exams.integrity.test.ts` を含むテストを実行する。

## 主要URL

- `/` — 単元・年度の選択
- `/unit-{slug}/{year}/` — 問題と答え
- `/records` — 端末内の学習記録と任意同期
- `/progress/spaces` — 同期スペース作成（POST）
- `/progress/sync` — 進捗のマージ（POST）
- `/progress` — 同期スペースと記録の削除（DELETE）
- `/markdown/{unit-id}/{year}` — Markdown出力
- `/guide` — 利用ガイド
- `/slide-only` — 講義資料
- `/health` — ヘルスチェック

`/dashboard`、`/exercises`、`/today/{unit}` は互換用リダイレクト。新機能の導線には使わない。

## セキュリティ

- 同期キーはURLや `X-Sync-Key` ヘッダーで扱われる秘密情報として保護する。
- 同期スペース発行は接続元のハッシュ、同期・削除は同期スペースIDを使ってレート制限する。
- クライアントから受け取った問題IDと単元IDは、サーバー側の問題カタログと照合する。
- 不正な同期キーと存在しない同期スペースは、外部から区別できない404として扱う。
- 外部サービスを追加する場合は、Worker設定とレスポンスヘッダーのCSPを確認する。

## テスト方針

- 変更箇所に最も近いテストを先に実行し、最後にコミット前チェックを通す。
- APIは正常系だけでなく、入力不正、未知の同期キー、レート制限、DB失敗を検証する。
- D1テストには `app/types/test/d1.ts` のテスト用DBを使う。
- 共有テストDBやビルドロックに起因するタイムアウトは、コード不良と断定する前に単独実行で再確認する。
- UI変更は開発サーバーとブラウザで、モバイル幅を含む実際の導線を確認する。

## デプロイ

- 本番URL: `https://fit-redesign.r02takako.workers.dev`
- `main` へのpushでGitHub Actionsがチェック、D1 migration、Worker deployを順に実行する。
- deploy workflowは毎回 `wrangler d1 migrations apply fit-timer-db --remote` を実行する。未適用分だけ適用され、なければno-opになる。
- 手動デプロイは明示的に依頼された場合だけ `pnpm deploy` を使う。
- migrationは破壊的変更を避け、既存データを保持できる段階的変更を優先する。

## 既知の注意点

- Hono JSXのHTML属性名はReactと完全には同じでない。型エラー時はHono JSXの定義を確認する。
- HonoXのクライアントコンポーネントは `$` 接頭辞を使い、サーバー専用コードをimportしない。
- `app/client-script.tsx` はHTML文字列として配信されるクライアント処理を含む。変更時はスクリプト単体テストも更新する。
- Cloudflare bindingsの型は `Cloudflare.Env` と `app/routes/_lib.ts` の `Env` を一致させる。
- Drizzleスキーマ変更時はmigrationだけでなく、テスト用D1セットアップも確認する。

## Showboat

- ADR: `docs/showboat/adr-{feature}.md`
- デモ: `docs/showboat/demo-{feature}.md`
- スクリーンショット: `screenshots/{feature}-{state}.png`

```bash
showboat init docs/showboat/feature.md "タイトル"
showboat note docs/showboat/feature.md "説明"
showboat exec docs/showboat/feature.md bash "検証コマンド"
showboat verify docs/showboat/feature.md
```

Showboatが未導入なら `uv tool install showboat` を使う。
