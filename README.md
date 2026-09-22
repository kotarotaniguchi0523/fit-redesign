# FIT Redesign

明治大学「基本情報技術 I」の過去の小テスト（2013〜2017年度）を、単元と年度から探して、問題・解答・解説をすぐ確認できるサイトです。

本番環境: <https://fit-redesign.r02takako.workers.dev>

## 機能

- 9単元の小テストを単元・年度から検索
- 同じ単元・年度に複数の小テストがある場合のまとめて表示
- 問題への回答入力や採点を行わず、「答えを見る」で解答・解説を確認
- 答えを確認した問題と確認日時を端末内に保存
- 小テストを一問ずつ進め、問題ごとの可視時間と ○ / × の自己判定を記録
- 小テストの今回の結果と、複数回分の総合正解率を表示
- 前回の続きや最近確認した問題の表示
- アカウント不要の秘密リンクによる端末間の学習記録同期
- 講義スライドの閲覧
- 問題のMarkdown出力とAIエージェント向けMarkdown API
- オートマトン、論理回路、二分木、フローチャートなどの図表表示

学習記録と小テスト結果は通常、ブラウザのlocalStorageに保存されます。同期を有効にした場合だけ、秘密リンクから導出した同期リンクへD1を使って完了済み記録を統合します。同期キーそのものはD1に保存しません。

## 技術スタック

| 分類 | 使用技術 |
| --- | --- |
| Webフレームワーク | HonoX `0.1.61` + Hono `4.13` |
| ビルド | Vite `8.3` |
| UI | Hono JSX / `hono/jsx/dom` Islands |
| スタイリング | Tailwind CSS `4.3` |
| 実行環境 | Cloudflare Workers + Workers Assets |
| データベース | Cloudflare D1（SQLite） |
| ORM | Drizzle ORM `1.0.0-rc.4` |
| バリデーション | Zod `4` + `@hono/zod-validator` |
| Lint / Format | Biome `2.5` |
| 型チェック | TypeScript Native Preview `7` |
| テスト | Vitest `5` + jsdom `30` |
| 未使用コード検査 | Knip |
| パッケージマネージャー | pnpm `11.5.0` |

Vite 8のRolldownベースのビルドを使用しています。現行のHonoX/Workers実行経路でクライアント・SSRビルドとWrangler上のSSR実行を検証済みです。

## セットアップ

### 前提条件

- Node.js 24
- pnpm 11.5.0

### インストール

```bash
git clone https://github.com/kotarotaniguchi0523/fit-redesign.git
cd fit-redesign
pnpm install --frozen-lockfile
```

### 開発サーバー

```bash
pnpm dev
```

Viteの開発サーバーでは、画面やクライアント側の動作を確認できます。D1を含むWorkerのSSR・API経路を確認する場合は、本番ビルド後にWranglerでプレビューします。

```bash
pnpm db:migrate:local
pnpm build
pnpm preview
```

### ローカルD1

同期APIをローカルで確認する場合は、最初にマイグレーションを適用します。

```bash
pnpm db:migrate:local
pnpm db:query:local -- "SELECT name FROM sqlite_master WHERE type = 'table'"
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | Vite開発サーバーを起動 |
| `pnpm build` | クライアントとWorkerをビルド |
| `pnpm preview` | ビルド結果をWranglerで配信 |
| `pnpm format` | Biomeでフォーマットを適用 |
| `pnpm check` | BiomeのLint・フォーマット検査 |
| `pnpm typecheck:full` | プロジェクト全体の型チェック |
| `pnpm test` | Vitestのwatch実行 |
| `pnpm test:run` | Vitestを1回実行 |
| `pnpm test:coverage` | カバレッジ付きテスト |
| `pnpm knip` | 未使用コード・依存・exportの検査 |
| `pnpm db:migrate:local` | ローカルD1へmigrationを適用 |
| `pnpm db:query:local -- "SQL"` | ローカルD1でSQLを実行 |
| `pnpm deploy` | Workerへデプロイ（明示的に必要な場合のみ） |

コミット前は次の順で確認します。

```bash
pnpm format
pnpm check
pnpm typecheck:full
pnpm test:run
pnpm build
pnpm knip
```

## 主なURL

| URL | 内容 |
| --- | --- |
| `/` | 単元・年度の選択 |
| `/unit-{slug}/{year}` | 単元・年度ごとの問題ページ |
| `/{unit}/{year}/exam?exam={number}` | 小テストモード |
| `/{unit}/{year}/exam?exam={number}&question={questionId}` | 単問計測モード |
| `/records` | 端末内の学習記録と同期設定 |
| `/guide` | 利用ガイド |
| `/slide-only` | 講義スライド |
| `/health` | ヘルスチェック |
| `/progress/links` | 同期リンクの発行（POST） |
| `/progress/sync` | 学習記録の同期（POST） |
| `/progress/challenges` | 完了済み小テスト結果の同期（POST） |
| `/progress` | 同期リンクと記録の削除（DELETE） |
| `/markdown` | サイト概要のMarkdown（GET） |
| `/markdown/{unit}/{year}` | 単元・年度のMarkdown（GET） |

## ディレクトリ構成

```text
fit-redesign/
├── app/
│   ├── components/       # 共有Hono JSXコンポーネント
│   ├── content/          # MDXの長文コンテンツ
│   ├── data/              # 単元、試験JSON、講義スライド
│   ├── features/         # 答え表示、Markdown、進捗などの機能単位
│   ├── lib/               # 汎用ヘルパーと図表描画
│   ├── routes/            # HonoXのファイルベースルートとAPI
│   ├── server/            # D1スキーマ、Repository、同期キー処理
│   ├── types/             # ドメイン・API型とテスト用型
│   ├── client.ts          # クライアントエントリポイント
│   └── server.ts          # Workerのcomposition root
├── migrations/            # Cloudflare D1 migrations
├── public/                # robots.txt、sitemap関連、静的画像など
├── vite.config.ts         # HonoX、MDX、Tailwind、Workerビルド設定
├── vitest.config.ts       # HonoX/MDXを含むテスト設定
├── wrangler.jsonc         # Worker、Assets、D1、Rate Limiting設定
└── pnpm-lock.yaml         # pnpmの単一ロックファイル
```

試験データは`app/data/exams-json/`にコミットし、`app/data/exams/loader.ts`が読み込みます。問題PDF・解答ページなどの配布資料は、元の明治大学ページを参照します。データを変更した場合は、試験データの整合性テストを実行してください。

## CI/CDとデプロイ

Pull Requestでは、GitHub Actionsが次を実行します。

1. `pnpm install --frozen-lockfile`
2. Biomeチェック
3. 型チェック
4. Vitest
5. Knip
6. Workerビルド

`main`へのpushでは、上記の検証に加えてD1 migrationを適用し、Cloudflare Workersへデプロイします。

本番のCloudflare設定は`wrangler.jsonc`で管理します。同期機能ではD1とRate Limiting bindingを使用します。手動デプロイは、明示的に必要な場合だけ次を実行してください。

```bash
pnpm deploy
```

## 開発ルール

- パッケージマネージャーはpnpmのみ使用します。
- 画面は可能な限りサーバー描画し、操作が必要な小さな領域だけ`$`接頭辞のIslandに分けます。
- 問題閲覧はJavaScriptや同期APIが失敗しても利用できるようにします。
- 同期キーはパスワード相当の秘密情報として扱い、ログや外部分析へ出しません。
- D1スキーマを変更するときは、`migrations/`とテスト用D1のセットアップも確認します。
- 依存更新後は`pnpm-lock.yaml`を必ず同期し、`pnpm check`、`pnpm typecheck:full`、`pnpm test:run`、`pnpm build`を実行します。

## ライセンス

Private
