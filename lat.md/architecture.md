# Architecture

このアプリはCloudflare Workers上で動き、ページ/API、ブラウザー状態、永続化の境界を分ける。

## Runtime boundaries

Cloudflare Workers上でHonoXがページとファイルベースのAPIルートを提供する。`app/server.ts`がHonoアプリへ共通Middlewareを登録し、HonoXのサーバーへ渡す。APIごとの入力検証・レート制限は各ルートに置く。

- Worker entry: [[app/server.ts#app]]
- Progress API route: [[app/routes/progress.ts#progress]]

## Request pipeline

共通リクエストログMiddlewareは最外周に置き、末尾スラッシュのリダイレクトも最終statusとして記録する。Cloudflare invocation logと重複する時間・statusを計算せず、HonoX route templateだけを構造化ログへ加える。

- Middleware: [[app/server/requestLogging.ts#requestLoggingMiddleware]]
- Log entry construction: [[app/server/requestLogging.ts#requestLogEntry]]
- Enforced test contract: [[testing#Route template logging and query redaction]]

Workersとブラウザーの性能計測は[[performance-observability#Measurement boundaries]]を参照。

## Static asset delivery

既知のHTMLページとMarkdownエンドポイントをHono SSGで生成し、Cloudflare AssetsからWorkerを介さず配信する。

- Static asset generation and URL rewrites: [[scripts/generate-static-pages.mjs]]
- HTML parameter enumeration: [[app/routes/[unit]/[year]/index.tsx]]
- Markdown parameter enumeration: [[app/routes/markdown.ts]]
- Deployment and routing notes: [[docs/cloudflare-deploy.md#静的HTMLとWorker配信]]

ホーム、ガイド、スライド専用ページ、登録済み単元・年度ページ、Markdown概要と登録済み単元・年度Markdownを静的生成する。記録ページ、クイズ実行ページ、同期API、ヘルスチェック、未生成MarkdownパスはWorkerで処理する。生成対象を変えるときはURL依存値の固定化を確認し、成果物とWranglerプレビューで配信先を検証する。

## Data ownership

問題カタログは検証済みの静的データを読む。進捗と小テストの実行状態はブラウザー側が一次保存先で、利用者が同期リンクを作った場合に限りCloudflare D1へ同期する。ブラウザー保存、ドメイン変換、API、Repositoryの責務は[[features#Progress and challenge state]]に記録する。
