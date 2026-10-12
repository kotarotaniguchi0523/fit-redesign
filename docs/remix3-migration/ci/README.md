# CI ワークフローの更新（`workflow` スコープが必要）

Remix 3 + CF CLI 構成に合わせた新しいワークフローを `ci/` に置いている。
**サンドボックスのGitHubトークンには `workflow` スコープが無く、`.github/workflows/*` を
pushできない**ため、ホスト側で適用する（または `workflow` スコープ付きトークンで push する）。

| ファイル | 変更点 |
| --- | --- |
| `ci.yml` | 除去された `typecheck:full`/`test:run`/`db:check` への依存をやめ、`pnpm check` / `pnpm typecheck` / `pnpm knip` / `pnpm test` / `pnpm build` を使う |
| `deploy.yml` | `cloudflare/wrangler-action` をやめ、CF CLI（`cf d1 migrations apply <id> --remote` → `cf deploy`）で配信する |
| `e2e.yml` | `remix test -t e2e` を実行（テスト自身がサーバーを起動）。ブラウザーは chromium のみ |

## 現状の互換性

`package.json` には旧名の互換エイリアスも残してあるため、**現行ワークフローの多くはそのまま動く**:

- `typecheck:full` → `cf workers types && tsc --noEmit`
- `test:run` → `NODE_ENV=test remix test`
- `db:check` → `node scripts/check-migrations.mjs`
- `knip` → `knip`

ただし `db:migrate:local`（`cf d1 migrations apply … --local`）は CI 上で Cloudflare の
アカウント文脈を要する可能性があり、`wrangler-action` を使う deploy は設定ファイルを
`cloudflare.config.ts` に統一したため動かない。上記ワークフローの適用が本筋。
