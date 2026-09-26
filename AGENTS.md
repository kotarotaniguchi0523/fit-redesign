# リポジトリ案内

## プロジェクト

情報処理技術者試験の問題・解答・学習記録を提供するWebアプリ。Cloudflare Workers上でHonoX/Honoを動かし、パッケージ管理にはpnpmを使う。

## 主な配置

- `app/routes/`: HonoXのページ/APIルート
- `app/features/`: 機能単位のUI・ドメインロジック・状態管理
- `app/components/`: 複数機能で使う共有Hono JSX
- `app/server/`: Worker側のDBアクセスなどサーバー処理
- `app/data/`: 単元・試験データ。試験問題JSONは`app/data/exams-json/`、検証スキーマは`app/data/exams/schema.ts`
- `app/lib/`: 機能に依存しない共有処理
- `migrations/`: Cloudflare D1のSQLマイグレーション

## 実装時の方針

- 変更前に関係する実装とテストを確認し、既存の構成・命名に合わせて必要な範囲だけ変更する。
- 機能固有の処理はその機能内に置く。複数箇所で実際に共有される処理だけを共有領域へ移す。
- ドメイン処理は可能な限り副作用のない関数にし、I/O・DB・ブラウザーAPIなどの副作用は境界に寄せる。
- API入力や保存済みデータなど、信頼できない値は既存のスキーマ・検証方法で検証する。
- DBスキーマを変更するときはDrizzle定義とマイグレーションを揃え、生成SQLを確認する。同期キーなどの秘密値をログやエラー応答へ出さない。
- 画面はサーバー描画を基本とし、ブラウザーでの操作が必要な箇所に既存のHonoX islandパターンを使う。

## よく使うコマンド

- `pnpm dev`: 開発サーバー
- `pnpm build`: クライアントとWorkerをビルド
- `pnpm check`: Biomeの検査
- `pnpm typecheck:full`: TypeScript型検査
- `pnpm test:run`: Vitestを一度実行
- `pnpm e2e`: ビルド後にPlaywrightを実行
- `pnpm db:check`: Drizzleマイグレーションの整合性を検査

## 検証

変更に近いテストを実行し、変更内容に応じて型検査・ビルド・E2Eを追加する。広い変更では関連する全体チェックも行う。ドキュメントだけの変更では、コード用チェックを一律に実行する必要はない。
