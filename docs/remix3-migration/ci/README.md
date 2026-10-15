# CI ワークフローの更新（`workflow` スコープが必要）

Remix 3 + CF CLI 構成に合わせた新しいワークフローを `ci/` に置いている。
**サンドボックスのGitHubトークンには `workflow` スコープが無く、`.github/workflows/*` を
pushできない**ため、ホスト側で適用する（または `workflow` スコープ付きトークンで push する）。

| ファイル | 変更点 |
| --- | --- |
| `ci.yml` | 除去された `typecheck:full`/`test:run`/`db:check` への依存をやめ、`pnpm check` / `pnpm typecheck` / `pnpm knip` / `pnpm test` / `pnpm build` を使う |
| `deploy.yml` | `cloudflare/wrangler-action` をやめ、CF CLI（`cf d1 migrations apply <id>` → `cf deploy`（このCLIは `--local` が任意フラグで、無指定がリモート））で配信する |
| `e2e.yml` | `remix test -t e2e` を実行（テスト自身がサーバーを起動）。ブラウザーは chromium のみ |

## 現状の互換性

`package.json` には旧名の互換エイリアスも残してあるため、**現行ワークフローの多くはそのまま動く**:

- `typecheck:full` → `cf workers types && tsc --noEmit`
- `test:run` → `NODE_ENV=test remix test`
- `db:check` → `node scripts/check-migrations.mjs`
- `db:migrate:local` → `node scripts/migrate-local.mjs`（CIでは `node:sqlite` で
  オフライン検証。`cf d1` はネットワーク初期化を要するためCIでは実行しない）
- `knip` → `knip`

`wrangler-action` を使う deploy は設定ファイルを `cloudflare.config.ts` に統一したため
動かない。上記ワークフローの適用が本筋。

## ブラウザー資産とテスト種別

`remix/assets` の**実行時**アセットサーバーは Cloudflare Workers では動かない
（oxc の `*-wasm32-wasi` バインディングが解決できず `cf dev` / `cf build` が失敗する）。
代わりに `scripts/build-assets.mjs` が Node 上で `createAssetServer` を回し、
アンバンドル ESM と `getScriptEntry()` の import map / modulepreload を
`public/assets/**` へ出力する（Workers Assets が配信、`.ts`/`.tsx` は Worker が
JavaScript の MIME を付与する）。

テストは境界ごとに分ける:

| 種別 | 実行 | 対象 |
| --- | --- | --- |
| server | `pnpm test` | ルーター・ドメイン（既定は `type: ["server"]`） |
| browser | `pnpm test:browser` | 島の操作（`*.test.browser.tsx`、`render()`） |
| e2e | `pnpm test:e2e` | SSR 導線（`*.test.e2e.ts`） |

CI の e2e ワークフローは `pnpm e2e` を実行し、資産生成のうえ browser と e2e の
両方を走らせる（Chromium を導入済みのため）。
