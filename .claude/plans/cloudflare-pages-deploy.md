---
status: 進行中
started: 2025-01-24
---

# Plan: Cloudflare Pages デプロイ

## 概要
fit-redesignプロジェクトをCloudflare Pagesにデプロイし、継続的デプロイ環境を構築する。

## 背景・課題
- React + Vite の静的SPAをホスティングする必要がある
- 高速なCDN配信と無料の無制限帯域が求められる
- 継続的デプロイで開発効率を向上させたい

## 実装ステップ

### Phase 1: Wrangler CLIでの初回デプロイ

1. **Step 1: Wrangler CLIのインストール**
   ```bash
   pnpm add -g wrangler
   ```

2. **Step 2: Cloudflareにログイン**
   ```bash
   wrangler login
   ```
   - ブラウザが開き、Cloudflareアカウントで認証

3. **Step 3: プロジェクトのビルド**
   ```bash
   cd fit-redesign
   pnpm build
   ```

4. **Step 4: Cloudflare Pagesにデプロイ**
   ```bash
   wrangler pages deploy dist --project-name=fit-redesign
   ```
   - 初回実行時にプロジェクトが自動作成される
   - デプロイ完了後、URLが発行される（例: `fit-redesign.pages.dev`）

5. **Step 5: 動作確認**
   - 発行されたURLにアクセス
   - SPAのルーティングが正常に動作するか確認

### Phase 2: GitHub連携による自動デプロイ

1. **Step 1: GitHubリポジトリの準備**
   ```bash
   cd fit-redesign
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create fit-redesign --public --source=. --push
   ```

2. **Step 2: Cloudflare Pagesダッシュボードで連携設定**
   - [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages) にアクセス
   - 作成済みの `fit-redesign` プロジェクトを選択
   - 「Settings」→「Builds & deployments」→「Connect to Git」

3. **Step 3: ビルド設定**
   | 項目 | 値 |
   |------|-----|
   | Production branch | `main` |
   | Build command | `pnpm build` |
   | Build output directory | `dist` |
   | Root directory | `/` |

4. **Step 4: 環境変数の設定（必要に応じて）**
   - 「Settings」→「Environment variables」
   - Node.jsバージョン: `NODE_VERSION = 20`

5. **Step 5: 自動デプロイの確認**
   - コードを変更してpush
   ```bash
   git add .
   git commit -m "Test auto deploy"
   git push
   ```
   - Cloudflareダッシュボードでビルドログを確認
   - プレビューURLが自動生成されることを確認

## 作成・変更するファイル

| ファイル | 操作 | 説明 |
|---------|------|------|
| `public/_redirects` | 新規作成 | SPAルーティング対応（完了済み） |
| `.gitignore` | 確認 | node_modules, distが除外されているか確認 |

## 検証方法

### Phase 1 完了条件
- [ ] `fit-redesign.pages.dev` でサイトにアクセスできる
- [ ] 全ページが正常に表示される
- [ ] SPAルーティングが動作する（リロードでも404にならない）

### Phase 2 完了条件
- [ ] GitHubリポジトリとCloudflare Pagesが連携している
- [ ] `git push` で自動ビルド・デプロイが実行される
- [ ] PRごとにプレビューURLが生成される

## 注意点

- Cloudflareアカウントが必要（無料で作成可能）
- GitHubアカウントとの連携にはOAuth認証が必要
- カスタムドメインは後から設定可能
