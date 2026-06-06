# プロジェクト開発ガイドライン

## 技術スタック

- **Python ツール**: `uv`（pip/pipx ではなく `uv tool install` を使用）
- **フレームワーク**: Astro 6 (SSG + SSR hybrid)
- **ホスティング**: Cloudflare Pages（git push で自動デプロイ）
- **DB**: Cloudflare D1（SQLite）、Upstash Redis（キャッシュ）
- **CSS**: Tailwind CSS v4
- **Lint/Format**: Biome
- **テスト**: Vitest
- **ドキュメント**: Showboat（実行可能なデモドキュメント生成）
- **パッケージマネージャー**: **pnpm**（npm, yarn 禁止）

## コマンド一覧

```bash
pnpm dev             # 開発サーバー起動
pnpm build           # 本番ビルド（astro build）
pnpm preview         # ビルド結果プレビュー
pnpm format          # Biome フォーマット適用
pnpm check           # Biome lint + format チェック（CI用）
pnpm typecheck       # 型チェック（tsgo --noEmit）高速版
pnpm typecheck:full  # 型チェック（astro check + tsgo --noEmit）完全版
pnpm test            # テスト実行（vitest）
```

### コミット前チェック（必須）

コミット前に以下を順に実行すること:
1. `pnpm format` — フォーマット適用
2. `pnpm check` — lint エラー確認。エラー時は `npx biome check --write <file>` で自動修正
3. `pnpm typecheck:full` — 型チェック（`.astro` 含む完全版を必ず使う）
4. `pnpm build` — ビルド確認

### 型チェックルール

ユーザーから型チェック・typecheckの実行を指示された場合は、**必ず `pnpm typecheck:full` を使うこと**。
`pnpm typecheck`（tsgo のみ）は `.astro` ファイルをチェックしないため不十分。

---

## アーキテクチャ

### ディレクトリ構造

```
src/
├── features/       # 機能別（縦スライス）。横断機能の client script・repository・型・集計を同居
│   └── timer/      #   question-timer(client), timerRepository(D1), timerStorage/timerSync, timeFormat, types
│                   #   ※ answer / srs / dashboard / exams / figures は features/ へ順次移行中
├── server/         # 機能に属さない横断基盤（cloudflare:workers/D1/Redis）
│                   #   http.ts（json/badRequest/serverError/route）, userRepository（users テーブル）, redis
├── components/     # 全画面共有の Astro コンポーネント（Header, Layout 部品 等）
├── scripts/        # 旧・技術タイプ別の client script 置き場（features/ へ移行中。新規は features/ へ）
├── pages/          # ファイルベースルーティング（薄く保つ）。ルート専用部品は同階層に `_` で co-location
│   ├── [unit]/[year].astro   # 単元ページ（SSG）
│   ├── dashboard/[userId].astro  # ダッシュボード（SSR）
│   ├── api/answer/   # 回答記録API（submit, status, history）
│   ├── api/timer/    # タイマー同期API（sync, load, clear）
│   └── api/markdown/ # AI向けMarkdownエンドポイント
├── utils/          # 純粋ユーティリティ（dashboardAggregator, overline, zod, logger 等）※汎用のみ
├── types/          # 共有 Zod スキーマ + TypeScript型（機能固有の型は features/<x>/types.ts へ）
├── data/           # 単元定義（units.ts）、試験データ（exams/）
├── content/        # Content Collections（exams JSON）※Astro 固定・移動不可
└── layouts/        # Layout.astro（canonical, OG, JSON-LD対応）
migrations/         # D1 マイグレーション SQL
public/             # 静的ファイル（robots.txt, llms.txt, _headers）
```

### コード構成方針（Feature ベース）

機能別（Package by Feature）を採用する。判断基準は1つ:

- **特定ルートでしか使わないもの** → そのルート配下に `_` プレフィックスで co-location（例: `src/pages/dashboard/_components/`。Astro は `_` 始まりをルーティング除外する）
- **複数ルート横断 / ドメインロジック** → `src/features/<機能>/` に同居（client script・repository・型・集計）
- **真に汎用なヘルパー** → `src/utils/`（将来 `src/shared/`）。「とりあえず utils」は禁止
- **機能に属さない横断基盤** → `src/server/`（`http.ts` の `route()` 等、`userRepository`）

**依存方向の不変条件**: `features/<x>` は `types/` `server/` `utils/` を import してよいが、**逆（`types/` `server/` `utils/` から `features/` への import）は禁止**。共有バレル（`types/index.ts` 等）に機能固有の型を再エクスポートしない（機能固有型は `features/<x>/types.ts` から直接 import する）。

Astro が固定する `pages/` `content/` `layouts/` `components/` は移動しない。詳細と却下案は `docs/showboat/adr-feature-based-structure.md`（ADR）参照。

### データフロー

- **D1**: 永続データストア（users, attempts, answers テーブル）
- **Upstash Redis**: キャッシュ（回答済み状態）。ダウン時はD1にフォールバック
- **localStorage**: ユーザーID保存のみ（`fit-exam-user-id`）

### 主要パターン

- **Web Component**: `connectedCallback`/`disconnectedCallback` でライフサイクル管理。クライアントバンドルに Zod を入れない（軽量バリデーション関数を手書き、`features/timer/timerStorage.ts` 参照）
- **D1クエリ**: `features/timer/timerRepository.ts` / `server/answerRepository.ts` のパターンに従う。D1 型は `@cloudflare/workers-types` のグローバル `D1Database` を使う（ローカル再定義しない）。バッチは100件ずつ。`users` テーブルの upsert は `server/userRepository.ts`
- **APIエンドポイント**: `export const prerender = false` + `server/http.ts` の `route(label, handler)` でラップ（try/catch と env 注入を共通化）+ Zod バリデーション。レスポンスは `json` / `badRequest` / `serverError` で生成

---

## URL構造

- トップ: `/`
- 単元ページ: `/unit-{slug}/{year}/`（例: `/unit-base-conversion/2013/`）
- ダッシュボード: `/dashboard/{userId}/`（SSR）
- 回答API: `/api/answer/submit`, `/api/answer/status`, `/api/answer/history`
- タイマーAPI: `/api/timer/sync`, `/api/timer/load`, `/api/timer/clear`
- Markdown API: `/api/markdown/{unit-id}/{year}`（AI エージェント向け）
- ガイド: `/guide/`
- 講義資料のみ: `/slide-only/`
- 旧React SPAの日本語パス（`/論理演算/2013`）は無効（トップにリダイレクト）

---

## デプロイ

- **本番URL**: https://fit-redesign.pages.dev
- **デプロイ方法**: `git push origin main` で自動デプロイ（`wrangler pages deploy` は使わない）
- **反映タイミング**: push 後、静的ファイル（robots.txt等）の反映に数分かかる場合あり
- **CSP設定**: `public/_headers`（外部リソース追加時は `connect-src` 更新必須）
- **D1マイグレーション（リモート）**: `wrangler d1 execute fit-timer-db --remote --command="SQL文"` で個別実行（`--file` はリモートで認証エラーになる場合あり）
- **D1マイグレーション（ローカル）**: `pnpm db:migrate:local`（`migrations/` を `.wrangler/state/v3/d1` のローカルDBへ適用。`astro dev` はここを読むので、`no such table` エラーが出たらこれを実行）。任意SQLは `pnpm db:query:local "SELECT ..."`
- **Upstash Redis**: `wrangler secret put UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` で設定
- **GEO/SEO**: `robots.txt`, `llms.txt`, `llms-full.txt`, `/api/markdown/`, JSON-LD, sitemap.xml 実装済み

---

## 既知の注意点

### Astro で `<script>` に属性を付ける場合

`id` 等の属性がある `<script>` は Astro が `is:inline` 扱いにする。`<script type="application/json">` 等には明示的に `is:inline` を付けること。

### 外部サービス追加時の CSP 更新

`public/_headers` の `connect-src` に新ドメインを追加すること。忘れるとブラウザでリクエストがブロックされる。

### MDX で日本語括弧隣接の太字が効かない

`**「テキスト」**` は太字にならない。`<strong>「テキスト」</strong>` を使うこと。

### Unicode下付き文字をデータに使わない

`₍₂₎` 等はモバイルで文字化け。通常文字 `(2)` を使うこと。

### HeroUI PopoverContent はモバイルで背景が透過する

`background-color: #ffffff !important` と `backdrop-filter: none !important` で明示的に不透明化（`.timer-popover` クラス参照）。

### modify/delete コンフリクト後のビルド失敗

削除ファイルに依存する新規追加ファイルはgitのコンフリクト検出に引っかからない。マージ後は必ず `pnpm typecheck` でビルド確認。

---

## サブエージェント活用方針

**原則**: タスクは積極的にサブエージェントに委譲する。独立したタスクは**必ず並列で起動**する。

```
質問・調査系 → Explore / context7-plugin:docs-researcher
設計・計画系 → Plan / feature-dev:code-architect
実装系 → taskmaster:task-executor / general-purpose
レビュー系 → feature-dev:code-reviewer / taskmaster:task-checker
リファクタ → code-simplifier:code-simplifier
```

### インストール済みスキル（/コマンド）

| スキル | 用途 |
|--------|------|
| `/frontend-design` | 高品質フロントエンドUI作成 |
| `/agent-browser` | ブラウザ自動操作・テスト |
| `/docs` (context7) | ライブラリドキュメント参照 |

---

## スクリーンショット管理

**保存先**: `screenshots/` フォルダ。**命名**: `{機能名}-{状態}.png`

---

## Showboat（実行可能ドキュメント）

[simonw/showboat](https://github.com/simonw/showboat) — エージェントの作業を実行可能なMarkdownで記録・検証するツール。

**保存先**: `docs/showboat/` フォルダ。**命名**: `adr-{機能名}.md`（ADR）、`demo-{機能名}.md`（デモ）

### インストール

```bash
uv tool install showboat
```

### 基本ワークフロー

```bash
# 1. ドキュメント初期化
showboat init docs/showboat/feature-name.md "タイトル"

# 2. 解説テキスト追加
showboat note docs/showboat/feature-name.md "説明文"

# 3. コマンド実行＋出力キャプチャ
showboat exec docs/showboat/feature-name.md bash "コマンド"

# 4. スクリーンショット追加
showboat image docs/showboat/feature-name.md screenshots/feature.png

# 5. 直前のエントリ削除（ミス時）
showboat pop docs/showboat/feature-name.md

# 6. 全コードブロック再実行＋出力検証
showboat verify docs/showboat/feature-name.md

# 7. 再現用コマンド列を出力
showboat extract docs/showboat/feature-name.md
```

### 用途

- **ADR（Architecture Decision Record）**: 設計判断と検証結果を実行可能な形で記録
- **機能デモ**: API動作やビルド結果を再現可能なドキュメントとして残す
- **変更検証**: `showboat verify` で過去のドキュメントが現在も有効か確認
