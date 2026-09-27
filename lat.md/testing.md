---
lat:
  require-code-mention: true
---

# Request logging

リクエストログはHonoXルート越しに検証する。状態を持つテストはstorage、DOM、D1、spyをテスト単位で準備・後片付けし、Playwright全シナリオは5つすべてのブラウザー・端末プロジェクトで実行する。

## Route template logging and query redaction

アプリ構造化ログにはHonoXのroute template・HTTP method・最終statusを含め、request timing・request ID・URLを重複保存しない。query内の同期キーを含めず、Cloudflare invocation logとRay IDを照合元にする。

## Redirect status

末尾スラッシュのリダイレクトも、構造化ログのstatusとHTTP応答のstatusが一致することを維持する。設計は[[architecture#Request pipeline]]を参照する。

## Challenge client and player

小テストの同期、プレイヤー状態、結果表示、保存状態の復元が、画面やAPIの境界を越えて一貫することを守る。

### Client sync returns local and server results together

クライアント同期はローカル結果を失わず、サーバーに保存済みの結果も取り込んで統合する。

### Exam and single-question player scopes

試験モードと一問モードで開始位置、対象問題、履歴フィルター、ナビゲーション範囲を正しく分ける。

### Timer reset clears sampling and changes the active question

問題切り替え時にタイマーの計測状態を止め、次の問題のサンプル開始へ移る。

### Initial HTML shows the first question before island hydration

小テストの最初の問題がJavaScript初期化前のHTMLに含まれ、Page Objectが操作可能な状態まで待ってから操作する。

### Result views show mode-specific summaries and actions

小テストとタイムアタックで正しい集計、空履歴表示、再挑戦・一覧復帰の操作を示す。

### Active attempts become restorable completed history

保存中の試行を復元でき、完了時には進行中記録から履歴へ移して結果を再構成する。

### Timer locks remain owner-scoped until their heartbeat expires

同時実行ロックは所有者だけが更新でき、heartbeat期限後は別端末が取得できる。

# Static site integrity

Hono SSG の生成物をデプロイ前に検証する。出力パスの重複、404・robots・canonical・サイトマップ、ページリンク、fragment、静的アセット、内部rewrite先を実際のHTML成果物で確認する。

## SSG generates a noindex 404 document

共有Not Found UIから404.htmlをSSG生成し、noindexを付ける。

## Indexable canonical pages are listed in sitemap

サイトマップにはcanonicalと一致する生成済みindexableページだけを含める。

## Valid internal links and assets pass

生成HTMLとCSSから参照する内部ページ・fragment・アセット、および内部rewrite先が実在するときにビルドを通す。

## Internal links can target parameterized Worker routes

内部リンクが生成済みファイルでなく、実在するパラメーター付きGET Worker routeに一致するときも有効として扱う。

## Broken internal links fail the build

生成HTMLから存在しない内部ページまたはfragmentを参照した場合、参照元と先を示して失敗する。

## Missing static assets fail the build

生成HTML/CSSがWorker routeしかない場所をアセットとして参照した場合や、出力にない静的ファイルを参照した場合に失敗する。

## Canonical URLs match generated pages

indexableページのcanonicalが生成されたHTMLパスと一致し、重複canonicalがないことを確認する。

## Duplicate output paths fail the build

異なるSSGルートが同じ出力パスを生成しないことを確認する。
