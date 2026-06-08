# プロジェクト開発ガイドライン

## 技術スタック

- **Python ツール**: `uv`（pip/pipx ではなく `uv tool install` を使用）
- **フレームワーク**: HonoX 0.1.56（Hono メタフレームワーク。ファイルベースルーティング + Islands Architecture）
- **ホスティング**: Cloudflare Workers（`git push origin main` → CI が `wrangler deploy`）
- **DB**: Cloudflare D1（SQLite、永続データ）、Cloudflare KV（回答済み状態の read-through キャッシュ）
- **CSS**: Tailwind CSS v4
- **Lint/Format**: Biome
- **テスト**: Vitest
- **ドキュメント**: Showboat（実行可能なデモドキュメント生成）
- **パッケージマネージャー**: **pnpm**（npm, yarn 禁止）

## コマンド一覧

```bash
pnpm dev             # 開発サーバー起動（vite）
pnpm build           # 本番ビルド（vite build --mode client && vite build → dist/index.js + dist/static/）
pnpm preview         # ビルド成果物を wrangler dev で配信（本番相当のローカル検証）
pnpm format          # Biome フォーマット適用
pnpm check           # Biome lint + format チェック（CI用）
pnpm typecheck       # 型チェック（tsgo --noEmit）
pnpm typecheck:full  # 型チェック（tsgo --noEmit。Astro 廃止後は typecheck と同一）
pnpm test            # テスト実行（vitest）
pnpm test:run        # テスト実行（1回のみ、CI用）
```

> **dev の注意**: `pnpm dev`（vite）はクライアント/HMR 向け。D1/KV バインディングや SSR 全経路の
> 本番挙動を確認するときは `pnpm build` → `pnpm preview`（wrangler dev）を使う。

### コミット前チェック（必須）

コミット前に以下を順に実行すること:
1. `pnpm format` — フォーマット適用
2. `pnpm check` — lint エラー確認。エラー時は `npx biome check --write <file>` で自動修正
3. `pnpm typecheck:full` — 型チェック
4. `pnpm build` — ビルド確認（`pnpm preview`(wrangler dev) で SSR 全経路の実挙動も確認推奨）

### 型チェックルール

型チェックは `pnpm typecheck:full` を使う。Astro を廃止したため現在 `typecheck` と `typecheck:full`
は同一（どちらも `tsgo --noEmit`）だが、規約として `:full` を使い続ける。

---

## アーキテクチャ

### ディレクトリ構造

HonoX 規約に合わせ、コードはすべて `app/` 配下にコロケーションする（`src/` は廃止）。

```
app/                # HonoX フレームワークルート（フレームワーク + ドメインを全てここに）
├── server.ts       # composition root。trimTrailingSlash・セキュリティヘッダー → createApp
├── client.ts       # createClient() + 命令的コントローラの配線（進捗/タイマー/dashboard chart 等）
├── client-script.tsx # ClientScript（honox <Script> の HasIslands gate を外し全ページで client を出力）
├── routes/         # ファイルベースルーティング（ページ + API を /api プレフィックス無しで混在）
│   ├── _renderer.tsx     # jsxRenderer（canonical/OG/JSON-LD/Script/Link）。c.render(content,{title,...})
│   ├── _middleware.ts     # 全ルートに logger/request-id/timing（routes 直下=ページも API も波及）
│   ├── _lib.ts            # API 共有 plumbing のみ: 型付き createRoute(apiRoute, Bindings=D1/KV)・invalid・postBodyLimit（_=非ルート。schemas は features/<x> or types/ へ）
│   ├── index.tsx / [unit]/[year].tsx / today/[unit].tsx / exercises.tsx / guide.tsx / slide-only.tsx / _404.tsx
│   ├── dashboard/[userId].tsx, dashboard/index.tsx   # ダッシュボード（D1 集計, chart.js）
│   ├── sitemap.xml.ts, llms-full.txt.ts              # SSR 生成（@astrojs/sitemap 代替）
│   ├── health.ts                       # GET /health
│   ├── answer/{submit,status,history}.ts   # POST /answer/submit, GET /answer/status, /answer/history
│   ├── timer/{sync,load,clear}.ts          # POST /timer/sync, GET /timer/load, DELETE /timer/clear
│   └── markdown.ts      # /markdown(+/*)。基底+ワイルドカード二重経路は Hono sub-app + etag スコープ
├── components/     # 全画面共有の Hono JSX（Header, ExamSection, SlideSection, QuestionCard, figures/）
├── features/       # 機能別（縦スライス）。island($接頭辞)・client script・repository・型・集計を同居
│                   #   timer / answer($AnswerSelector,$SelfGrade) / srs / study / dashboard / markdown
├── server/         # 機能に属さない横断基盤（answerRepository(D1), answerCache(KV), userRepository）
├── data/           # 単元定義(units.ts) / スライド(slides.ts) / 試験データ(exams-json/ + exams/loader.ts)
├── content/        # 長文コンテンツの .mdx（guide.mdx）。@mdx-js/rollup が hono/jsx へコンパイル
├── lib/            # 真に汎用な helper（logger, mountAll, zod, userId, overline）+ 図表描画(figures/)
├── types/          # 共有 Zod スキーマ + TypeScript型（機能固有型は features/<x>/types.ts へ）
├── constants.ts, global.d.ts, env.d.ts, mdx.d.ts, index.css, style.css
migrations/         # D1 マイグレーション SQL
public/             # 静的ファイル（robots.txt, llms.txt, _headers, favicon.svg, images/）
```

### コード構成方針（Feature ベース）

機能別（Package by Feature）を採用する。判断基準は1つ:

- **特定ルートでしか使わないもの** → そのルート配下に co-location（HonoX は `_`/`$` 始まりをルーティング除外）
- **複数ルート横断 / ドメインロジック** → `app/features/<機能>/` に同居（island・client script・repository・型・集計）
- **真に汎用なヘルパー** → `app/lib/`。「とりあえず utils」は禁止（utils/ は廃止済み）
- **機能に属さない横断基盤** → `app/server/`（`answerRepository`, `answerCache`, `userRepository`）

**依存方向の不変条件**: `features/<x>` は `types/` `server/` `lib/` を import してよいが、**逆（`types/` `server/` `lib/` から `features/` への import）は禁止**。共有バレル（`types/index.ts` 等）に機能固有の型を再エクスポートしない（機能固有型は `features/<x>/types.ts` から直接 import する）。

詳細と却下案は `docs/showboat/adr-feature-based-structure.md`（ADR）参照。

### データフロー

- **D1**: 永続データストア（users, attempts, answers テーブル）
- **KV**: 回答済み状態の read-through キャッシュ（`app/server/answerCache.ts`）。障害時は D1 にフォールバック
- **localStorage**: 匿名ユーザー ID（`fit-exam-user-id`）と SRS スケジュール状態

### 主要パターン

- **Islands（インタラクティブ UI）**: `$` 接頭辞でファイル名を付け、使う feature にコロケーション（例 `app/features/answer/$AnswerSelector.tsx`）。`hono/jsx/dom` の Async React。island ソースに dom pragma は付けない（vitest の `islandComponents()` と競合）。命令的 DOM 制御で足りるものは island にせず `app/client.ts` に配線（対象要素が無いページでは no-op）。クライアントバンドルに Zod を入れない（軽量バリデーション手書き）
- **D1クエリ**: `app/server/answerRepository.ts` のパターンに従う。D1 型は `@cloudflare/workers-types` のグローバル `D1Database` を使う（ローカル再定義しない）。バッチは100件ずつ。`users` の upsert は `app/server/userRepository.ts`、KV キャッシュは `app/server/answerCache.ts`
- **API（file ルート + fetch）**: `app/routes/` 直下に per-endpoint で分解（/api プレフィックス無し）（`export default`=GET / `export const POST`/`DELETE`）。共通基盤は `_lib.ts`（型付き `apiRoute`・schemas・helper、`_`=非ルート）、cross-cutting middleware は `_middleware.ts`（logger/request-id/timing）。`@hono/zod-validator` で 400、bodyLimit で 413、markdown は sub-app で etag→304。**クライアントは `fetch("/...")` を直接呼ぶ（hc/RPC 型クライアントは廃止）**

---

## URL構造

末尾スラッシュは `server.ts` の `trimTrailingSlash` で除去（`/path/` → 301 → `/path`）。内部リンクは末尾スラッシュ無しで書く。

- トップ: `/`
- 単元ページ: `/unit-{slug}/{year}`（例: `/unit-base-conversion/2013`）
- 今日の道（SRS）: `/today/{unit-id}`
- 年度・単元別 演習問題一覧: `/exercises`
- ダッシュボード: `/dashboard/{userId}`（SSR）、`/dashboard`（localStorage の userId へリダイレクト）
- 回答API: `/answer/submit`, `/answer/status`, `/answer/history`
- タイマーAPI: `/timer/sync`, `/timer/load`, `/timer/clear`
- Markdown API: `/markdown/{unit-id}/{year}`（AI エージェント向け）
- ガイド: `/guide`、講義資料のみ: `/slide-only`

---

## デプロイ

- **本番URL**: https://fit-redesign.r02takako.workers.dev
- **デプロイ方法**: `git push origin main` で自動デプロイ（CI が `wrangler deploy` を実行）
- **反映タイミング**: push 後、静的ファイル（robots.txt等）の反映に数分かかる場合あり
- **CSP/セキュリティヘッダー**: `public/_headers` は**静的アセットにのみ**適用される。Worker が生成する SSR HTML には載らないため、HTML 向けの CSP/HSTS 等は `app/server.ts` のミドルウェアで付与する（両者を同期させること。外部リソース追加時は両方の `connect-src` 等を更新）
- **デプロイ用 API トークン権限**: `Workers Scripts:Edit` + `Workers KV Storage:Edit` + `D1:Edit`（+ 任意で `User Details:Read` / `Memberships:Read`）。Pages 用スコープでは Workers デプロイが `Authentication error[code:10000]` で失敗する
- **D1マイグレーション（リモート）**: `wrangler d1 execute fit-timer-db --remote --command="SQL文"` で個別実行（`--file` はリモートで認証エラーになる場合あり）。CI は main マージ時に `migrations/` の差分があれば自動適用
- **D1マイグレーション（ローカル）**: `pnpm db:migrate:local`（`migrations/` を `.wrangler/state/v3/d1` のローカルDBへ適用。`wrangler dev` はここを読むので、`no such table` が出たらこれを実行）。任意SQLは `pnpm db:query:local "SELECT ..."`
- **GEO/SEO**: `robots.txt`, `llms.txt`, `llms-full.txt`, `/markdown/`, JSON-LD, `sitemap.xml` 実装済み（base URL は `app/data/site.ts` の `SITE_URL` に集約）

---

## 既知の注意点（HonoX / Workers）

### vite は ^7 に固定（8 禁止）

vite 8（Rolldown/oxc）は honox 0.1.56 の SSR を実行時 `TypeError: e5.search is not a function` で壊す（ビルドは通るが全ページ 500）。`package.json` で `vite` を `^7` に固定。JSX は server=`hono/jsx`、island=`hono/jsx/dom`。

### honox `<Script>` は island の無いページで client を出さない

honox/server の `<Script>` は `HasIslands` でラップされ、ルートが island を import している時しか client バンドルを出力しない。ホーム/today/dashboard 等 island 無しページで命令的 client が全死する。`app/client-script.tsx` の `ClientScript`（gate を外した同等実装）を `_renderer.tsx` で使うこと。

### 末尾スラッシュ URL は 404

honox/Workers のファイルルートは `/path/` を別パス扱いで 404 にする。`app/server.ts` の `trimTrailingSlash` で正規化済み。内部リンクは末尾スラッシュ無しで書く。

### API は app/routes/ 直下の file ルート（/api プレフィックス無し）

API は `app/routes/` 直下に file ルートとして置く（health.ts→/health, answer/submit.ts→/answer/submit 等、`/api` プレフィックス無し）。各ファイルは `export default`(GET)/`export const POST`/`DELETE`。共通基盤（型付き `apiRoute`・schemas）は `_lib.ts`、cross-cutting middleware は `_middleware.ts`（routes 直下＝ページも含む全ルートに logger/request-id/timing が波及。いずれも `_` 接頭辞でルーティング除外）。基底+ワイルドカードの二重経路（markdown）は index.ts が基底にマッチしないため、Hono インスタンスを `export default` する単一ファイル（`markdown.ts`）の sub-app にする。**ページの `[unit]/[year]`（/:unit/:year）と API の 2 セグメントパス（/answer/submit 等）は衝突しうるが、Hono は static セグメントを param より優先するため動作する（要 wrangler dev 実測）。**

### dashboard の chart.js は遅延ロード

chart.js は重いので `app/client.ts` で `#dashboard-data` がある時のみ動的 import（別チャンクに分割され全ページ bloat を回避）。

### 使い方ガイド（/guide）は MDX を SSR 描画

`app/content/guide.mdx` を `@mdx-js/rollup`（`jsxImportSource: "hono/jsx"` + `remark-gfm`）が hono/jsx コンポーネントへコンパイルし、`guide.tsx` が `<GuideContent />` を SSR 描画する（旧 lobster.js の外部 CDN 依存は廃止。CSP からも `hacknock.github.io` を削除済み）。**mdx プラグインは `vite.config.ts` と `vitest.config.ts` の両方に必要**（テストが `.mdx` を import するため）。`.mdx` の型は `app/mdx.d.ts`。本文スタイルは Tailwind typography（`@plugin "@tailwindcss/typography"` → `prose`）。

### 配布資料（PDF/解答）は明治大学ページを直接参照

問題 PDF・解答 HTML はローカル配信せず `https://www.isc.meiji.ac.jp/~kikn/FIT/` を参照（`MEIJI_FIT_BASE`、`app/types/index.ts`）。`pdfPath`/`answerPdfPath` はこの base の URL であることを schema/型/integrity テストが強制する。

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
