# Remix 3 移行チェックリスト

`DESIGN.md` の段階的全量移行を実行するためのチェックリスト。
進めながら項目を追加する。各段階の完了条件は「該当する検証が通ること」。

凡例: `[ ]` 未着手 / `[x]` 完了

## Stage 0: 足場

- [x] `kotarotaniguchi0523/fit-redesign` を clone
- [x] ブランチ `remix3-migration` を作成
- [x] APM 初期化（`apm.yml`, `apm.lock.yaml`）
- [x] APM で Remix3 Skill を導入（`remix-run/remix/.agents/skills/remix`）
- [ ] パッケージマネージャー確定（pnpm 維持 or npm へ変更。virtiofs 制約の回避手段を決める）
- [x] `package.json` を Remix3 構成へ更新（remix, @remix-run/ui, cf, vite, workers-types, typescript）
- [x] 旧依存の除去（hono, honox, drizzle, wrangler, tailwind, vitest 等）
- [x] `tsconfig.json` を Remix3 向けに設定（jsxImportSource: remix/component）
- [x] Node 24 の導入（Remix3 と CF CLI の TS 設定読込に必須）
- [x] Wrangler 廃止 → CF CLI へ（`cloudflare.config.ts`, `vite.config.ts`）
- [x] 旧 HonoX 実装を `legacy/` へ退避（tsconfig から除外）
- [x] インストール成功を確認（pnpm hoisted。`.bin` はシムで代替）
- [x] `tsc --noEmit` 成功（`.cloudflare/types` を include）
- [x] `cf workers types` でバインディング型を生成

## Stage 1: Remix3 土台（Workers）

### 後続で確定した追加要件

- [x] **Vite 依存の排除**: `@cloudflare/vite-plugin` と `vite` を削除し、CF CLI が要求する
      dev/build サーバとして **wrangler** を採用（`wrangler dev` / `wrangler deploy`）。
      設定は `cloudflare.config.ts` から `wrangler.jsonc` に戻した。
- [ ] **テスト環境を `remix test` へ完全移行**（Vitest 廃止）。データ層は完了。残りは `legacy/` にある。

### 完了項目

- [x] `app/routes.ts`（全ルートの契約）
- [x] `app/router.ts`（createRouter + middleware 連結 + context 型拡張）
- [x] `app/worker.ts`（Workers fetch アダプタ）
- [x] `app/actions/document.tsx`（Document シェル）
- [x] `app/middleware/assets.ts`（Workers Assets へ委譲・判定関数）
- [x] `app/middleware/security.ts`（セキュリティヘッダー）
- [x] `cloudflare.config.ts`（CF CLI 設定: DB / レート制限 / observability）
- [x] `vite.config.ts`（@cloudflare/vite-plugin）
- [ ] `app/middleware/database.ts`（D1 → data-table を context に載せる）
- [ ] `app/middleware/rate-limit.ts`（PROGRESS_RATE_LIMITER）
- [ ] `app/middleware/request-log.ts`（`remix/middleware/logger` 利用。現状は logger() 直使用）
- [x] `cf workers types` / `remix routes` / `tsc --noEmit` が通る
- [x] `cf build` が成功（Worker バンドル生成）
- [x] SSR スモーク（`scripts/smoke.ts`）でトップ・health・単元・404 を検証
- [ ] `cf dev` の起動確認（サンドボックスの外向き通信制約で未検証）
- [ ] `context.render` の既定 404 を `NotFoundPage` に差し替え

## Stage 2: アセットパイプライン（Workers 用ビルド時生成）

- [ ] `app/assets.server.ts`（Node 専用 `createAssetServer` 設定）
- [ ] `app/actions/public/entry.ts`（ブラウザ entry、`remix/component` の `run`）
- [ ] `scripts/build-assets.ts`（entry href・import map・preloads・実ファイルを dist へ書き出し）
- [ ] `scriptEntry` を Worker が読める生成物（JSON/モジュール）として出力
- [ ] 生成物を `Document` から参照し、Workers Assets 配信で clientEntry が hydrate する
- [ ] `clientEntry` を含むページでブラウザ動作を確認

## Stage 3: データ・ドメイン層の移植

- [x] `app/data/slides.ts` / `site.ts` 移植
- [x] `app/data/units.ts` 移植（Zod 検証・examMapping 込み）
- [x] `app/lib/immutable.ts` / `app/lib/zod.ts`
- [x] `app/types/*`（domain / content / figures / browser / index）
- [x] `app/data/exams/*`（schema, assemble, index, loader）
- [x] `import.meta.glob` → `modules.generated.ts`（明示 import 索引 + 生成スクリプト）
- [x] データ整合性テストを `remix test` へ移植（20/20 pass）
- [ ] `app/lib/*`（純粋ヘルパー・図表計算）の残り
- [ ] `app/features/*` のドメインロジック移植
- [ ] `app/data/exams/homeCatalog.ts`（`features/answer` の型に依存）

## Stage 4: DB（data-table + D1）

- [x] `app/db/tables.ts`（sync_links, question_progress, challenges, answers）
- [x] `app/db/d1.ts`（`DatabaseDriver` 実装 + SQL コンパイラ + `createD1Database`）
- [x] `app/db/registry.ts` / `app/middleware/database.ts`（`cloudflare:workers` をルーターから隔離）
- [x] `migrations/0001_initial.sql`（履歴破棄、現行スキーマを初期マイグレーション化）
- [x] D1 ドライバの実 SQLite テスト（node:sqlite シム、6/6 pass）
- [ ] `app/server/*Repository` → data-table の query/CRUD へ移植
- [ ] 同期キー（syncKey/syncLinkId）を Web Crypto ベースで移植
- [ ] リポジトリテストを `remix test` へ移植
- [ ] ローカル D1（`wrangler d1 migrations apply --local`）でエンドツーエンド確認

## Stage 5: ページ移植（SSR + Remix component）

- [ ] `app/ui/`（Header, PageHeading, NotFoundPage, SlideSection, icons 等）
- [ ] ホームページ（単元タブ、続きから、JSON-LD）
- [ ] `/:unit/:year`（単元ナビ、小テスト一覧）
- [ ] `/:unit/:year/exam/:exam`（問題一覧）
- [ ] `/:unit/:year/exam/:exam/question/:question`（単問）
- [ ] 図表コンポーネント（LogicCircuit, StateDiagram, Flowchart, BinaryTree, ParityCheck, TableRenderer）
- [ ] `QuestionContent` / CopyButton
- [ ] `/guide`（MDX → コンポーネント）
- [ ] `/slide-only`
- [ ] `/records`
- [ ] 404

## Stage 6: インタラクティブ（clientEntry + @remix-run/ui）

- [ ] `$ExamPlayer`（タイマー・採点・SRS）を clientEntry 化
- [ ] `$SolutionReveal` / `$ContinueLearning`
- [ ] `$ChallengeHistory`
- [ ] `$ProgressHistory` / `$SyncSettings`
- [ ] `$CopyButton`
- [ ] `@remix-run/ui` の tabs / accordion / menu 等を適所で採用
- [ ] JS 無効でも閲覧できること（progressive enhancement）を確認

## Stage 7: API ルート

- [ ] `/progress/links` POST
- [ ] `/progress/sync` POST
- [ ] `/progress/challenges` POST
- [ ] `/progress` DELETE
- [ ] `/markdown` GET（ETag / 304 / Cache-Control）
- [ ] `/markdown/:unit/:year` GET
- [ ] `/health` GET
- [ ] `/llms.txt`, `/llms-full.txt`
- [ ] CSRF / レート制限 / 入力検証

## Stage 8: 検証・デプロイ

- [ ] `tsc --noEmit` / `remix doctor` / `remix routes` が通る
- [ ] `remix test`（unit / integration）
- [ ] Playwright E2E（`wrangler dev` 対象）
- [ ] `wrangler deploy --dry-run` が通る
- [ ] 旧スタック残置（Vite/HonoX/Drizzle）の完全除去
- [ ] ドキュメント更新（README, AGENTS.md, lat.md）
