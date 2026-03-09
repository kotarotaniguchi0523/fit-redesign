# プロジェクト開発ガイドライン

## 技術スタック

- **フレームワーク**: Astro 6 (SSG + SSR hybrid)
- **ホスティング**: Cloudflare Pages（git push で自動デプロイ）
- **DB**: Cloudflare D1（SQLite）、Upstash Redis（キャッシュ）
- **CSS**: Tailwind CSS v4
- **Lint/Format**: Biome
- **テスト**: Vitest
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
├── components/     # Astro コンポーネント（QuestionCard, Header 等）
├── scripts/        # クライアント Web Component（question-timer, answer-selector, dashboard）
├── pages/
│   ├── [unit]/[year].astro   # 単元ページ（SSG）
│   ├── dashboard/[userId].astro  # ダッシュボード（SSR）
│   ├── api/answer/   # 回答記録API（submit, status, history）
│   ├── api/timer/    # タイマー同期API（sync, load, clear）
│   └── api/markdown/ # AI向けMarkdownエンドポイント
├── utils/          # D1リポジトリ、Redis、集計ロジック等
├── types/          # Zod スキーマ + TypeScript型
├── data/           # 単元定義（units.ts）、試験データ（exams/）
└── layouts/        # Layout.astro（canonical, OG, JSON-LD対応）
migrations/         # D1 マイグレーション SQL
public/             # 静的ファイル（robots.txt, llms.txt, _headers）
```

### データフロー

- **D1**: 永続データストア（users, attempts, answers テーブル）
- **Upstash Redis**: キャッシュ（回答済み状態）。ダウン時はD1にフォールバック
- **localStorage**: ユーザーID保存のみ（`fit-exam-user-id`）

### 主要パターン

- **Web Component**: `connectedCallback`/`disconnectedCallback` でライフサイクル管理。クライアントバンドルに Zod を入れない（軽量バリデーション関数を手書き、`timerStorage.ts` 参照）
- **D1クエリ**: `d1TimerRepository.ts` / `d1AnswerRepository.ts` のパターンに従う。バッチは100件ずつ
- **APIエンドポイント**: `export const prerender = false` + Zod バリデーション + `cloudflare:workers` から env 取得

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
- **CSP設定**: `public/_headers`（外部リソース追加時は `connect-src` 更新必須）
- **D1マイグレーション**: `wrangler d1 execute fit-timer-db --remote --command="SQL文"` で個別実行（`--file` はリモートで認証エラーになる場合あり）
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
