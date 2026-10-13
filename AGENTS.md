# リポジトリ案内

## プロジェクト

情報処理技術者試験（明治大学「基本情報技術 I」）の問題・解答・学習記録を提供する Web アプリ。
**Remix 3**（`remix/router` + `remix/component` + `remix/data-table`）で実装し、Cloudflare Workers
（Workers Assets + D1）で配信する。ビルド/配信は **CF CLI**（`cf`）を使う（Wrangler は直接呼ばない）。

## 主な配置

- `app/routes.ts` / `app/router.ts` — URL とメソッドの契約、ルーターとミドルウェア
- `app/worker.ts` — Cloudflare Workers エントリ（`router.fetch` へ委譲）
- `app/actions/` — ルートコントローラー（薄い: 検証 + データ取得 + `context.render`）
  - `controller.tsx`（ページ/health/llms）、`markdown/`、`progress/`（API）、`public/entry.ts`（ブラウザーエントリ）
- `app/pages/` — ページ組成（`document.tsx` が共通シェル、`question-region.tsx` は Frame ソース）
- `app/features/<domain>/` — ドメイン単位で閉じる
  - `model.ts`（純関数）/ `storage.ts`（localStorage）/ `api.ts`（サーバー同期）/ `wire.ts`（Zod）/ `ui/`（表示）
  - `challenge/player/` はプレイヤー固有ロジック（session / timer / view / navigation / model / id）
- `app/db/` — `d1.ts`（D1 ドライバ）、`tables.ts`、`progress.ts`（Repository）、`registry.ts`
- `app/lib/` — 汎用ヘルパー・図表計算
- `app/ui/` — 複数ドメインで共有する表示のみ（`header.tsx`、`page-heading.tsx`、`icons.tsx`、`copy-button.tsx`、`unit-accordion.tsx`、`figures/`）
- `app/styles/global.css` — グローバルはトークンと最小の base のみ（それ以外は `css()` を併置）
- `app/data/` — 単元・スライド・試験データ（`exams-json/` は生成インデックス経由で読む）
- `migrations/` — D1 マイグレーション（`0001_initial.sql` が現行スキーマ）
- `scripts/` — CSS/クライアント/guide の生成と、試験JSON索引の生成
- `legacy/` — 旧 HonoX 実装（参照用。tsconfig から除外）

## 実装時の方針（Remix Way）

- ルートは URL とデータ読込のみを担い、UI は `remix/component` の関数コンポーネントで描く。
- 状態は島（`clientEntry`）の setup スコープに置き、変更時に `handle.update()` を呼ぶ。
  子コンポーネントは props だけの無状態 `Handle` コンポーネントにする。
- イベントは `mix={on('click', ...)}`、生 HTML は `innerHTML={unsafeHTML(...)}` を使う。
- 状態をサーバーへ送らない。DOM へ触る処理は島の中に閉じ込める。
- ドメイン規則は副作用のない純関数にする（`features/*/model.ts`）。
- 信頼できない入力は Zod スキーマで検証する。同期キーはログや応答へ出さない。
- スキーマ変更時は `migrations/`・`app/db/tables.ts`・テスト用 D1 を揃える。
- Vite は使わない。クライアントは esbuild、グローバル CSS は `app/styles/global.css` をコピーする。
- `@remix-run/ui` のプリミティブは `mix={[ownStyle, primitive.xxx()]}` で使い、見た目は `css()` で当てる。
  プリミティブは **hydrate されるコンポーネント内**でのみ動作する（`clientEntry` 境界に注意）。
- ルート所有の領域（問題本体など）は `<Frame>` で扱い、frame 応答では `Document` を出さない。
- 詳細な方針は `docs/remix3-migration/REARCHITECTURE.md`、作業計画は `docs/remix3-migration/TODO.md`。

## よく使うコマンド

- `pnpm dev` — CSS/クライアントを生成して `cf dev`
- `pnpm build` — 生成物を作成して `cf build`
- `pnpm deploy` — `cf deploy`
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — `remix test`
- `pnpm routes` — ルートツリー
- `pnpm check` — Biome 検査
- `pnpm db:migrate:local` — ローカル D1 にマイグレーション適用（`cf d1`）

## 検証

変更に近いテストを実行し、必要に応じて型検査・ビルド・SSR スモークを追加する。
コードやスキーマを変更したら `pnpm typecheck` と `pnpm test` を実行する。

%% lat:begin %%
# Before starting work

- Run `pnpm exec lat search` to find sections relevant to your task. Read them to understand the design intent before writing code.
- Run `pnpm exec lat expand` on user prompts containing `[[refs]]` to resolve those section names to file locations.

# Post-task checklist (REQUIRED — do not skip)

After EVERY task, before responding to the user:

- [ ] Update `lat.md/` if you added or changed any functionality, architecture, tests, or behavior
- [ ] Run `pnpm lat:lint` — all wiki links and code refs must pass
- [ ] Do not skip these steps. Do not consider your task done until both are complete.
%% lat:end %%
