# Cloudflare Workers デプロイガイド

## デプロイ情報

| 項目 | 値 |
| --- | --- |
| 本番URL | <https://fit-redesign.r02takako.workers.dev> |
| GitHubリポジトリ | <https://github.com/kotarotaniguchi0523/fit-redesign> |
| Worker名 | `fit-redesign` |
| D1データベース | `fit-timer-db` |

Worker、Assets、D1、Rate Limitingの設定は`wrangler.jsonc`で管理します。

## 手動デプロイ

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm deploy
```

`pnpm deploy`は`wrangler deploy`を実行します。デプロイ前にローカルでD1を確認する場合は、次を実行します。

```bash
pnpm db:migrate:local
pnpm build
pnpm preview
```

## GitHub Actionsによる自動デプロイ

`main`ブランチへのpushで`.github/workflows/deploy.yml`が起動します。ワークフローは次を順に実行します。

1. `pnpm install --frozen-lockfile`
2. Biome、型チェック、Vitest、Knip、ビルド
3. D1 migrationの適用
4. `wrangler deploy`によるWorkerデプロイ

Pull Requestでは`.github/workflows/ci.yml`が検証のみを実行します。

## GitHub Secrets

GitHubリポジトリの **Settings** → **Secrets and variables** → **Actions** に次を設定します。

| Secret名 | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | WorkersデプロイとD1 migration |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflareアカウントの識別 |

API Tokenには、少なくとも次の権限が必要です。

- Workers Scripts: Edit
- D1: Edit

Pages用の権限だけではWorkersのデプロイに使えません。

## 関連設定

- Worker設定: [`wrangler.jsonc`](../wrangler.jsonc)
- CI: [`ci.yml`](../.github/workflows/ci.yml)
- デプロイ: [`deploy.yml`](../.github/workflows/deploy.yml)
