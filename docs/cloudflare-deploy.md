# Cloudflare Workers デプロイガイド

## デプロイ情報

| 項目 | 値 |
| --- | --- |
| 本番URL | <https://fit-redesign.r02takako.workers.dev> |
| GitHubリポジトリ | <https://github.com/kotarotaniguchi0523/fit-redesign> |
| Worker名 | `fit-redesign` |
| D1データベース | `fit-timer-db` |

Worker、Assets、D1、Rate Limitingの設定は`wrangler.jsonc`で管理します。

## 静的HTMLとWorker配信

`pnpm build`はクライアントとWorkerをビルドした後、Honoの`toSSG()`で既知のページを`dist/`へ生成します。単元・年度、クイズ、小テスト内の全問題はそれぞれの`ssgParams()`で列挙します。現在はホーム、ガイド、スライド専用ページ、Not Found UIの`404.html`、40件の単元・年度ページ、試験別・問題別のクイズ実行ページ344件、Markdown 41件、LLM向けテキストを静的アセットとして配信します。`@hono/ssg-plugins-essential`の`sitemapPlugin`と`robotsTxtPlugin`も同じSSG処理で`sitemap.xml`と`robots.txt`を生成し、HTMLのrobots noindexを読み取って404とクイズページをサイトマップから除外します。`scripts/static-site-integrity.mjs`はSSG完了後に出力パス、HTML/CSS内の内部リンク・fragment・アセット、内部rewrite先、404のnoindex、canonical、サイトマップの一致を検証します。失敗時は参照元と原因を示してbuildを止めます。

Cloudflare AssetsがHTMLとMarkdownを返すため、対象リクエストではWorkerを実行しません。`not_found_handling: "404-page"`で未生成URLには`404.html`を返し、`html_handling: "auto-trailing-slash"`でHTML URLを処理します。`run_worker_first`で`/records`、`/progress`とその子パス、`/health`を先にWorkerへ送り、404 fallbackが動的ページやAPIを奪わないようにします。カタログ外のMarkdownパスも`404.html`になります。クイズのURLは`/{unit}/{year}/exam/{exam}`と`/{unit}/{year}/exam/{exam}/question/{questionId}`で、チャレンジIDや結果表示のクエリは同じ静的HTML上でクライアント側が読み取ります。旧クエリ形式のルートは残していません。Markdownの既存URLはビルドで生成する`_redirects`の内部rewriteで`.md`アセットへ対応させ、`text/markdown`と既存のキャッシュ期間を維持します。新しい静的ページやMarkdownルートを追加するときは、`scripts/generate-static-pages.mjs`と`ssgParams()`の対象、およびビルド出力を確認してください。

サイトマップは公式essential pluginのcanonical URL生成を利用し、HTMLのrobots noindexを見て対象URLを絞ります。ページ単位の信頼できる更新日時や`changefreq`・`priority`の設定元はないため、それらの任意項目は出力しません。現行のindexable HTMLから参照される画像ファイルはなく、図はinline SVG中心です。他言語URLもないためimage sitemapとhreflangは不要です。`public/images/guide/`内の画像は現行ページから参照されていません。公開URLは約43件で分割上限（50,000 URL）より十分少ないため、sitemap indexも生成しません。canonicalと生成HTMLパスの一致はintegrity pluginが検証します。

Cloudflareの静的アセットリクエストはWorkersのリクエスト枠を消費しません。これはWorker実行回数を減らす配信最適化であり、Worker自体を削除するものではありません。実際の公開構成・請求はCloudflare Dashboardで確認してください。

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
