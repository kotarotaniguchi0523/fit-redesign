# Cloudflare Pages デプロイガイド

## デプロイ情報

| 項目 | 値 |
|------|-----|
| 本番URL | https://fit-redesign.pages.dev |
| GitHub リポジトリ | https://github.com/kotarotaniguchi0523/fit-redesign |
| Account ID | `6a9ec77cec188e5ff1c6451edc9dd48d` |

---

## 手動デプロイ（Wrangler CLI）

```bash
# ビルド
pnpm build

# デプロイ
wrangler pages deploy dist --project-name=fit-redesign
```

---

## 自動デプロイ（GitHub Actions）

### 1. Cloudflare API Token の取得

1. [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) にアクセス
2. **Create Token** をクリック
3. **Edit Cloudflare Workers** テンプレートを選択（または Custom token）
4. Custom token の場合:
   - Permissions: `Cloudflare Pages: Edit`
   - Account Resources: `Include: Your Account`
5. **Create Token** → トークンをコピー（一度しか表示されない）

### 2. GitHub Secrets の設定

リポジトリの **Settings** → **Secrets and variables** → **Actions** で以下を追加:

| Secret 名 | 値 |
|-----------|-----|
| `CLOUDFLARE_API_TOKEN` | 取得したトークン |
| `CLOUDFLARE_ACCOUNT_ID` | `6a9ec77cec188e5ff1c6451edc9dd48d` |

### 3. 自動デプロイの動作

- `main` ブランチへの push で自動デプロイ
- PR 作成でプレビューデプロイ

ワークフローファイル: `.github/workflows/deploy.yml`

---

## ビルド設定

| 項目 | 値 |
|------|-----|
| Build command | `pnpm build` |
| Build output | `dist` |
| Node.js version | 24 |
