# プロジェクト開発ガイドライン

## 技術スタック

- **Python ツール**: `uv`（pip/pipx ではなく `uv tool install` を使用）
- **フレームワーク**: HonoX 0.1.61（Hono メタフレームワーク。ファイルベースルーティング + Islands Architecture）
- **ホスティング**: Cloudflare Workers（`git push origin main` → CI が `wrangler deploy`）
- **DB**: Cloudflare D1（SQLite、永続データ）
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
2. `pnpm check` — lint エラー確認。エラー時は `pnpm exec biome check --write <file>` で自動修正（`npx` 禁止）
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
├── server.ts       # composition root。request-id / structured logger / trimTrailingSlash / security headers → createApp
├── client.ts       # createClient()（island 自動ハイドレーション）+ SRS recorder リスナ
├── client-script.tsx # ClientScript（honox <Script> の HasIslands gate を外し全ページで client を出力）
├── routes/         # ファイルベースルーティング（ページ + API を /api プレフィックス無しで混在）
│   ├── _renderer.tsx     # jsxRenderer（canonical/OG/JSON-LD/Script/Link）。c.render(content,{title,...})
│   ├── _lib.ts            # API 共有処理（apiRoute・invalid・postBodyLimit。_=非ルート）
│   ├── index.tsx / [unit]/[year].tsx / guide.tsx / records.tsx / slide-only.tsx / _404.tsx
│   ├── sitemap.xml.ts, llms-full.txt.ts              # SSR 生成（@astrojs/sitemap 代替）
│   ├── health.ts                       # GET /health
│   ├── progress.ts        # /progress sub-app（同期リンク・進捗・小テスト）
│   └── markdown.ts       # /markdown。etag→304
├── components/     # 全画面共有の Hono JSX（Header, ExamSection, SlideSection, QuestionCard, figures/）
├── features/       # 機能別（縦スライス）。island($接頭辞)・client script・repository・型・集計を同居
│                   #   answer / challenge / progress / markdown / navigation
├── server/         # D1 repositories、schema、request logging
├── data/           # 単元定義(units.ts) / スライド(slides.ts) / 試験データ(exams-json/ + exams/loader.ts)
├── content/        # 長文コンテンツの .mdx（guide.mdx）。@mdx-js/rollup が hono/jsx へコンパイル
├── lib/            # date/time、immutable utilities、validation、sorting、figures
├── types/          # 共有 TypeScript型（API schema は routes/_schemas.ts、機能固有型は features/<x>/types.ts へ）
├── constants.ts, global.d.ts, env.d.ts, mdx.d.ts, index.css, style.css
migrations/         # D1 マイグレーション SQL
public/             # 静的ファイル（robots.txt, llms.txt, _headers, favicon.svg, images/）
```

### コード構成方針（Feature ベース）

機能別（Package by Feature）を採用する。判断基準は1つ:

- **特定ルートでしか使わないもの** → そのルート配下に co-location（HonoX は `_`/`$` 始まりをルーティング除外）
- **複数ルート横断 / ドメインロジック** → `app/features/<機能>/` に同居（island・client script・repository・型・集計）
- **真に汎用なヘルパー** → `app/lib/`。「とりあえず utils」は禁止（utils/ は廃止済み）
- **機能に属さない横断基盤** → `app/server/`（`answerRepository`, `userRepository`）

**依存方向の不変条件**: `features/<x>` は `types/` `server/` `lib/` を import してよいが、**逆（`types/` `server/` `lib/` から `features/` への import）は禁止**。共有バレル（`types/index.ts` 等）に機能固有の型を再エクスポートしない（機能固有型は `features/<x>/types.ts` から直接 import する）。

詳細と却下案は `docs/showboat/adr-feature-based-structure.md`（ADR）参照。

### データフロー

- **D1**: 永続データストア（users, questions, answers テーブル）
- **localStorage**: 匿名ユーザー ID（`fit-exam-user-id`）と SRS スケジュール状態

### 主要パターン

- **Islands（インタラクティブ UI）**: `$` 接頭辞のコンポーネントを使う feature にコロケーションする。island の描画状態と副作用が増えたら view と controller hook を分ける。`app/client.ts` は island hydration と SRS recorder の document listener を配線する。クライアントバンドルには不要な server code を含めない。
- **D1クエリ**: DB access は `app/server/progressRepository.ts` と `app/server/challengeRepository.ts` に集約する。D1 型は `@cloudflare/workers-types` の `D1Database` を使い、SQLは `app/server/schema.ts` のDrizzleスキーマを通す。
- **API（HonoX file routes + Hono sub-apps）**: 機能ごとのAPIは `app/routes/progress.ts` と `markdown.ts` を default export し、ファイル名のprefix（`/progress`, `/markdown`）でマウントする。共有処理は `_lib.ts` に置き、POST body limit は書き込みrouteだけに適用する。`app/server.ts` では全ルートに request-id、`@hono/structured-logger`、security headers を適用し、CSRF と D1 初期化は `/progress` sub-app に閉じる。Server-Timing は返さない。

---

## URL構造

末尾スラッシュは `app/server.ts` の `trimTrailingSlash` で除去（`/path/` → 301 → `/path`）。

- トップ: `/`
- 問題ページ: `/{unit}/{year}` と `/{unit}/{year}/exam`
- 学習記録: `/records`
- ヘルスチェック: `GET /health`
- 進捗API: `POST /progress/links`, `POST /progress/sync`, `POST /progress/challenges`, `DELETE /progress`
- Markdown API: `/markdown/{unit-id}/{year}`
- ガイド: `/guide`、講義資料のみ: `/slide-only`

---

## デプロイ

- **本番URL**: https://fit-redesign.r02takako.workers.dev
- **デプロイ方法**: `git push origin main` で自動デプロイ（CI が `wrangler deploy` を実行）
- **反映タイミング**: push 後、静的ファイル（robots.txt等）の反映に数分かかる場合あり
- **CSP/セキュリティヘッダー**: `public/_headers` は**静的アセットにのみ**適用される。Worker が生成する SSR HTML には載らないため、HTML 向けの CSP/HSTS 等は `app/server.ts` のミドルウェアで付与する（両者を同期させること。外部リソース追加時は両方の `connect-src` 等を更新）
- **デプロイ用 API トークン権限**: `Workers Scripts:Edit` + `D1:Edit`（+ 任意で `User Details:Read` / `Memberships:Read`）。`Workers KV Storage:Edit` は KV 廃止により不要。Pages 用スコープでは Workers デプロイが `Authentication error[code:10000]` で失敗する
- **D1マイグレーション（リモート）**: `wrangler d1 execute fit-timer-db --remote --command="SQL文"` で個別実行（`--file` はリモートで認証エラーになる場合あり）。CI は main マージ時に `migrations/` の差分があれば自動適用
- **D1マイグレーション（ローカル）**: `pnpm db:migrate:local`（`migrations/` を `.wrangler/state/v3/d1` のローカルDBへ適用。`wrangler dev` はここを読むので、`no such table` が出たらこれを実行）。任意SQLは `pnpm db:query:local "SELECT ..."`
- **GEO/SEO**: `robots.txt`, `llms.txt`, `llms-full.txt`, `/markdown/`, JSON-LD, `sitemap.xml` 実装済み（base URL は `app/data/site.ts` の `SITE_URL` に集約）

---

## 既知の注意点（HonoX / Workers）

### Vite 8 / Rolldown

Vite 8.3のRolldownベースのビルドを使う。現行のHonoX 0.1.61構成ではクライアント・SSRビルドとWrangler上のSSR実行を確認済み。Vite更新時は同じ経路を再検証する。JSXはserver=`hono/jsx`、island=`hono/jsx/dom`。

### honox `<Script>` は island の無いページで client を出さない

honox/server の `<Script>` は island がないページで client bundle を出力しない。island のないページにクライアント処理が必要なら、`app/client-script.tsx` の `ClientScript` を `_renderer.tsx` で使う。

### 末尾スラッシュ URL は 404

honox/Workers のファイルルートは `/path/` を別パス扱いで 404 にする。`app/server.ts` の `trimTrailingSlash` で正規化済み。内部リンクは末尾スラッシュ無しで書く。

### API は app/routes/ 直下の sub-app ファイル

HonoX が `app/routes/progress.ts` と `markdown.ts` をそれぞれ `/progress` と `/markdown` にマウントする。単発の `/health` は `health.ts` に置く。全ルート共通の request-id、structured logger、security headers は `app/server.ts`、CSRF・D1初期化・POST body limit は progress sub-app で管理する。