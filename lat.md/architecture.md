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

## Data ownership

問題カタログは検証済みの静的データを読む。進捗と小テストの実行状態はブラウザー側が一次保存先で、利用者が同期リンクを作った場合に限りCloudflare D1へ同期する。ブラウザー保存、ドメイン変換、API、Repositoryの責務は[[features#Progress and challenge state]]に記録する。
