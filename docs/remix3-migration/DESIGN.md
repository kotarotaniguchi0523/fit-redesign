# Remix 3 全面移行 設計書

HonoX/Hono/Vite/Drizzle/Tailwind 構成から、Remix 3（`remix` パッケージ）の
フルスタック構成へ全面移行する。実行環境は Cloudflare Workers + Workers Assets + D1 を維持する。

- 対象リポジトリ: `kotarotaniguchi0523/fit-redesign`
- 作業ブランチ: `remix3-migration`
- Skill: APM 経由で `remix-run/remix/.agents/skills/remix` を導入済み

## 1. 全体像

```
ブラウザ
  │  HTML / import map / /assets/*
  ▼
Cloudflare Workers (worker.ts)
  │  router.fetch(request)             … Remix の Fetch ハンドラ契約
  ├─ Workers Assets (ASSETS binding)   … 事前ビルド済み静的アセット
  └─ D1 (DB binding)                   … remix/data-table + D1 ドライバ
        ▲
   remix/data-table (公式 Query/CRUD 層)

ビルド時 (Node, CI/ローカルのみ)
  remix/assets でクライアント bundle + import map を生成 → dist/ へ書き出し
```

Remix は「Request → Response」を返す Fetch ハンドラ。`router.fetch` は Workers でも
そのまま動く。問題は **実行時に Node API を要求する部分**（アセットのオンデマンドコンパイル、
静的ファイル配信、SQLite ドライバ）で、ここだけ Workers 用に差し替える。

## 2. Remix 3 が標準で提供するもの（そのまま使う）

| 領域 | Remix の API | 置き換える対象 |
| --- | --- | --- |
| ルーティング | `remix/routes`（`route`/`get`/`post`/`form`）+ `remix/router`（`createRouter`/`createController`） | HonoX のファイルベースルーティング |
| ミドルウェア | `remix/middleware/render`, `form-data`, `session`, `csrf`, `cop`, `cors`, `logger`, `method-override`, `async-context` | Hono ミドルウェア |
| UI | `remix/component`（`Handle`, `css`, `on`, `clientEntry`, `Frame`）, `remix/component/server`（`ImportMap`） | Hono JSX + Islands + Tailwind |
| プリミティブ UI | `@remix-run/ui`（accordion, anchor, animation, combobox, listbox, menu, popover, select, tabs, toggle） | 自作 UI コンポーネント |
| データ | `remix/data-table`（`table`, `query`, CRUD, `db.migrate`） | Drizzle ORM |
| バリデーション | `remix/data-schema`（新規フォーム入力に使用。ドメインデータは既存 Zod を維持） | `@hono/zod-validator`（API 入力） |
| HTTP | `remix/headers`, `remix/response/{html,redirect,file,compress}`, `remix/cookie` | 手書きヘッダー処理 |
| テスト | `remix test`（`remix/test`） | Vitest |
| 設定 | `remix.json`, `remix/cli`（`remix routes`/`db`/`doctor`） | vite.config.ts |

## 2.5 ツールチェーン: Wrangler を廃止し CF CLI へ

Wrangler は使わない。Cloudflare 公式の `cf` CLI（導入済み / devDependency にも宣言）で統一する。

| 用途 | コマンド |
| --- | --- |
| ローカル開発 | `cf dev` |
| ビルド | `cf build` |
| デプロイ | `cf deploy` |
| 型生成 | `cf workers types`（`.cloudflare/types`） |
| D1 マイグレーション | `cf d1 migrations apply --dir db/migrations` |
| D1 クエリ | `cf d1 query` |

- プロジェクト設定は `wrangler.jsonc` ではなく **`cloudflare.config.ts`**（`defineConfig` / `bindings` / `defineWorker`）。
  バインドは `bindings.d1(...)` / `bindings.rateLimit(...)` / `bindings.assets()` で宣言する。
- CF CLI の dev/build は **`@cloudflare/vite-plugin`（または wrangler）を必須**とする（実測:
  「A project must declare exactly one of ...」）。wrangler を外すため Vite + プラグインを dev ツールとして使う。
- Node は **24.3.0 以上**が必須（Remix の `engines` と、CF CLI が `cloudflare.config.ts` を TS として読むため）。

## 2.6 Node.js 互換（調査結果）

Workers は Node ではない。`nodejs_compat` により一部の `node:*` は workerd がネイティブ実装する。
どのモジュールがいつからネイティブかは `@cloudflare/unenv-preset` に定義されており、
Skill `cloudflare-workers-node-compat` に機械導出したマトリクスを保存した
（`.apm/skills/cloudflare-workers-node-compat/`）。

要点（`compatibilityDate: 2026-10-06`, `nodejs_compat`）:

- `node:fs` / `node:fs/promises` は **2025-09-15 以降ネイティブ**。それ未満は unenv の
  ポリフィルで `readFileSync` 等は `notImplemented`、`existsSync()` は常に `false`。
- `node:sqlite` は **2026-01-29 以降ネイティブ**。
- `node:child_process` / `worker_threads` / `perf_hooks` / `readline` は 2026-03-17 以降ネイティブ。
- 実行時ポリフィル（inject）は `Buffer`, `global`, `process`, `setImmediate`, `clearImmediate` のみ。

**ただし「ネイティブ `node:fs` がある」= 「任意のファイルが読める」ではない。** Workers に
永続ファイルシステムは無く、読めるのはバンドルに含めたファイル等に限られる。したがって
`remix/assets`（ソース探索・watch）や `remix/middleware/static`（リポジトリのファイル配信）は
**実行時には使えない**という結論は変わらない。この点は上の Skill に明記した。

## 3. Remix 3 が「提供しない」もの = 自作が必要な部分

`自作は禁止` の原則は維持し、**Remix の公開拡張点として明示されている箇所のみ**最小実装する。
それ以外は Remix のエクスポートを直接使う。

### 3.1 Workers アダプタ（`app/worker.ts`）
- Remix の公式テンプレートは Node の `server.ts`（`node:http` + `remix/node-fetch-server`）。
- Workers は Fetch ハンドラを直接受け取るため、`export default { fetch(request, env, ctx) }` で
  `router.fetch(request)` を返すだけの薄いアダプタを書く（公式ガイド "Alternate runtimes" の形）。
- `env`（`DB`, `ASSETS`, `PROGRESS_RATE_LIMITER`）をルーターのコンテキストへ渡す。

### 3.2 アセットパイプライン（ビルド時 `remix/assets` → Workers Assets）
- `remix/assets` は Node 上でのオンデマンドコンパイル前提で、Workers 実行時には使えない。
- **ビルド時**に Node で `createAssetServer` を起動し、`getScriptEntry(entry)` が返す
  entry href・import map・preloads と、それらが指す実ファイルを `dist/assets/` へ書き出す
  ビルドスクリプト（`scripts/build-assets.ts`）を用意する。生成物は Workers Assets が配信。
- Worker 側は生成済みの `scriptEntry`（JSON）を import し、`Document` が import map を描画する。
- これが唯一「独自ビルド」になる部分。Remix のアセット生成結果をそのまま流用し、ロジックは再実装しない。

### 3.3 D1 ドライバ（`app/db/d1-driver.ts`）
- `remix/data-table` の公式ドライバは SQLite(node:sqlite/bun:sqlite) / Postgres / MySQL のみ。
- Remix は `DatabaseDriver` インターフェースを「integration packages が独自 dialect を追加する
  公開拡張点」としてエクスポートしている。これに沿って D1 を実装する。
- 実装範囲: `dialect`, `capabilities`, `execute`, `executeScript`, `beginTransaction` 系,
  `hasTable`, `hasColumn`, `wipe`, `close`。
- SQL は D1 の `prepare().bind().all()/run()/first()` で実行。トランザクションは
  `BEGIN`/`COMMIT`/`ROLLBACK` を `batch()`/`exec()` で送出。

### 3.4 静的ファイル配信（Workers Assets）
- `remix/middleware/static` は Node の `fs` 前提。Workers では `env.ASSETS.fetch(request)` に委譲する
  `app/middleware/assets.ts` を使う（`run_worker_first` で動的ルートのみ Worker を通す）。

### 3.5 セキュリティヘッダー
- Remix に単体のセキュリティヘッダーミドルウェアは無いため、`remix/headers` を使って
  既存 `app/server/securityHeaders.ts` 相当のレスポンスヘッダー付与ミドルウェアを書く（アプリのミドルウェアは通常の利用範囲）。

### 3.6 レート制限（Workers binding）
- 既存の `PROGRESS_RATE_LIMITER` binding を使う `app/middleware/rate-limit.ts` を書く。
  Remix のミドルウェア契約に沿った最小実装。

### 3.7 同期キーの暗号処理
- 既存 `syncKey`/`syncLinkId` は Web Crypto（`crypto.subtle`）ベースなら Workers でそのまま動く。
  移植時に `globalThis.crypto` 前提へ寄せる（Node 固有 API を使わない）。

## 4. ルート対応表

| 現行（HonoX） | Remix 3 ルート | 種別 |
| --- | --- | --- |
| `/` | `routes.home` | ページ |
| `/guide` | `routes.guide` | ページ（MDX） |
| `/records` | `routes.records` | ページ（SSR + clientEntry） |
| `/slide-only` | `routes.slideOnly` | ページ |
| `/:unit/:year` | `routes.unitYear` | ページ（SSG→SSR/キャッシュ） |
| `/:unit/:year/exam/:exam` | `routes.exam` | ページ（clientEntry: player） |
| `/:unit/:year/exam/:exam/question/:question` | `routes.question` | ページ |
| `/progress/links` (POST) | `routes.progress.links` | API |
| `/progress/sync` (POST) | `routes.progress.sync` | API |
| `/progress/challenges` (POST) | `routes.progress.challenges` | API |
| `/progress` (DELETE) | `routes.progress.root` | API |
| `/markdown`, `/markdown/:unit/:year` | `routes.markdown.*` | API |
| `/health` | `routes.health` | API |
| `/llms.txt`, `/llms-full.txt` | docs | API |
| 404 | ルーター既定 + `not-found-page.tsx` | ページ |

## 5. データ・ドメイン層

- `app/data/units.ts`, `slides.ts`, `site.ts`, `exams/*`: フレームワーク非依存。基本そのまま移植。
- 唯一の変更点: `import.meta.glob`（Vite 専用）→ 静的 import の索引モジュール `app/data/exams/index.generated.ts`。
- `app/lib/*`, `app/features/*` の純粋ロジック・テストは移植して再利用する（フレームワーク依存部のみ書き換え）。
- UI はすべて `remix/component` の関数コンポーネントへ書き換え、`css()` で Tailwind を置換。

## 6. DB スキーマ（data-table へ移行）

- 既存 D1 の `sync_links`, `question_progress`, `challenges`, `answers` を `remix/data-table` の
  `table(...)` 定義 + `db/migrations/<番号>_<名前>/{up,down}.sql` へ移行。
- 既存データはそのまま使えるよう、SQL スキーマは現行 `migrations/*.sql` の最終形に一致させる。

## 7. テスト

- 現行 Vitest → `remix test`（Node server tests / browser tests）。
- Playwright E2E は `wrangler dev` に対する現行構成を維持。
- 検証コマンドは `remix doctor`, `remix routes`, `remix test`, `tsc --noEmit`。

## 8. 既知の制約・リスク

- このサンドボックスでは virtiofs が **symlink 不可**、pnpm のリンク構成が EBADF で壊れる。
  → ローカル検証は pnpm の hoisted 構成（`--config.node-linker=hoisted`）＋ `.bin` の手当てで行う。
  リポジトリのパッケージマネージャー方針は移行時に確定する。
- Node は 24.3.0 以上が必要（Remix の `engines`、CF CLI の TS 設定読込）。
- Remix 3 はアセットを実行時生成する設計のため、Workers ではビルド時生成が必須（3.2）。
- `/`: 既存は SSG（`generate-static-pages.mjs`）。Remix では SSR + キャッシュヘッダーで代替する。
