# FIT Redesign

明治大学「基本情報技術 I」のインタラクティブ学習プラットフォーム。
過去の小テスト（2013〜2017年度）を Web 上で演習し、間隔反復（SRS）で定着させるアプリケーションです。

**本番 URL**: https://fit-redesign.r02takako.workers.dev

## 機能

- 全 9 単元 × 最大 5 年分の小テスト演習（選択式・自己採点式の両方に対応）
- 選択肢の正誤判定と解説表示
- **「今日の道」学習体験**: SRS（Leitner ボックス方式）で今日解くべき問題を出題、試験本番メーターで単元到達度を可視化
- タイマー機能（ストップウォッチ / カウントダウン、問題ごとの所要時間記録）
- 回答履歴のサーバー記録とダッシュボード集計（月次推移・単元別正答率・トレンド）
- 各単元の講義スライド閲覧
- 問題の Markdown エクスポート（クリップボードコピー / AI エージェント向け API）
- オートマトン・論理回路・二分木などのインタラクティブな図表描画

### 単元一覧

| # | 単元名 |
|---|--------|
| 1 | 基数変換 |
| 2 | 負の数の表現 |
| 3 | 浮動小数点 |
| 4 | 論理演算 |
| 5 | 集合と確率 |
| 6 | オートマトン |
| 7 | 誤り検出・訂正符号 |
| 8 | データ構造 |
| 9 | ソートと探索 |

講義スライド専用の単元（ガイダンス、制御理論、二分探索木、計算量、プログラミング言語）も含みます。

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Astro 6（SSG + SSR ハイブリッド、`experimental.advancedRouting`） |
| サーバー / API | Hono（RPC、`src/app.ts` で Astro パイプラインへマウント） |
| ホスティング | Cloudflare Pages |
| データストア | Cloudflare D1（SQLite、永続データ） |
| キャッシュ | Cloudflare KV（回答済み状態の read-through キャッシュ） |
| クライアント UI | hono/jsx/dom（Async React）+ 軽量 DOM コントローラ |
| スタイリング | Tailwind CSS 4 |
| バリデーション | Zod 4 + @hono/zod-validator |
| リンター / フォーマッター | Biome 2 |
| テスト | Vitest 4（jsdom） |
| 型チェック | astro check + tsgo（TypeScript native preview） |
| 未使用コード検出 | Knip |
| CI/CD | GitHub Actions |
| パッケージマネージャー | pnpm |

---

## セットアップ

### 前提条件

- Node.js 24 以上
- pnpm 10 以上

### インストール

```bash
git clone <repository-url>
cd fit-redesign
pnpm install
```

### ローカル D1 の初期化

D1 を参照するページ（ダッシュボード等）は、ローカル DB へマイグレーションを適用しないと
`no such table` エラーになります。初回および `migrations/` 変更時に実行してください。

```bash
pnpm db:migrate:local
```

### 開発サーバー

```bash
pnpm dev
```

> **注意**: `experimental.advancedRouting` 有効時、`astro dev` は Hono アプリへ env/ctx を
> 渡せず全ページが 500 になります。実際の動作確認は本番ビルド + `wrangler dev`（ビルド成果物）で
> 行ってください。

```bash
pnpm build
npx wrangler pages dev dist
```

---

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動（astro dev） |
| `pnpm build` | 本番ビルド（astro build） |
| `pnpm preview` | ビルド結果をローカルで確認（astro preview） |
| `pnpm format` | Biome でコードフォーマット |
| `pnpm check` | Biome で Lint・フォーマットチェック（CI 用） |
| `pnpm typecheck` | 型チェック（tsgo --noEmit、高速版） |
| `pnpm typecheck:full` | 型チェック（astro check + tsgo、`.astro` 含む完全版） |
| `pnpm knip` | 未使用コード・依存の検出 |
| `pnpm test` | テスト実行（watch モード） |
| `pnpm test:run` | テスト実行（1 回のみ、CI 用） |
| `pnpm test:coverage` | カバレッジ付きテスト実行 |
| `pnpm db:migrate:local` | ローカル D1 へマイグレーション適用 |
| `pnpm db:query:local "SQL"` | ローカル D1 へ任意 SQL を実行 |

### コミット前チェック

1. `pnpm format` — フォーマット適用
2. `pnpm check` — Lint チェック
3. `pnpm typecheck:full` — 型チェック（`.astro` 含む完全版を使う）
4. `pnpm test:run` / `pnpm knip` / `pnpm build` — テスト・未使用検出・ビルド確認

---

## アーキテクチャ

機能別（Package by Feature）構成を採用しています。

```
fit-redesign/
├── src/
│   ├── pages/            # ファイルベースルーティング（薄く保つ）
│   │   ├── [unit]/[year].astro    # 単元ページ（SSG）
│   │   ├── today/[unit].astro     # 「今日の道」セッション
│   │   ├── dashboard/[userId].astro  # ダッシュボード（SSR）
│   │   └── api/markdown/          # AI 向け Markdown（旧 API は Hono RPC へ移行済み）
│   ├── features/         # 機能別の縦スライス（client script・repository・型・集計を同居）
│   │   ├── answer/       #   AnswerSelector / SelfGrade（hono/jsx/dom）, answerClient
│   │   ├── timer/        #   question-timer, timerRepository(D1), timeFormat
│   │   ├── srs/          #   srs（Leitner エンジン）, srs-recorder, progressClient
│   │   ├── study/        #   studyHome, dailySession（DOM コントローラ）
│   │   ├── dashboard/    #   dashboard（chart.js 描画）
│   │   └── markdown/     #   markdownContent（SSR レンダリング）
│   ├── server/           # 機能横断の基盤（answerCache(KV), answerRepository(D1), userRepository）
│   ├── components/       # 全画面共有の Astro コンポーネント
│   ├── layouts/          # Layout.astro（canonical / OG / JSON-LD）
│   ├── content/          # Content Collections（exams JSON）※Astro 固定
│   ├── data/             # 単元定義（units.ts）・スライド設定
│   ├── utils/            # 純粋ユーティリティ（dashboardAggregator, apiClient, userId 等）
│   ├── api.ts            # Hono RPC ルート定義（answer / timer / markdown）
│   └── app.ts            # advancedRouting エントリ（Hono + Astro 合成、env 注入）
├── migrations/           # D1 マイグレーション SQL
├── patches/              # @astrojs/cloudflare の advancedRouting 対応パッチ
├── public/               # 静的ファイル（robots.txt, llms.txt, _headers）
└── .github/workflows/    # ci.yml / deploy.yml
```

### データフロー

- **Cloudflare D1**: 永続データストア（users / attempts / answers テーブル）。信頼源。
- **Cloudflare KV**: 回答済み状態の read-through キャッシュ。submit 時に write-invalidate、
  障害時は D1 にフォールバック。
- **localStorage**: 匿名ユーザー ID（`fit-exam-user-id`）と SRS スケジュール状態のみ保持。

### API（Hono RPC）

`src/api.ts` に定義し、`hc<ApiType>` で型付きクライアントから呼び出します（`src/utils/apiClient.ts`）。
ミドルウェア（logger / request-id / timing / etag / body-limit）は `/api/*` にスコープされます。

| メソッド | パス | 用途 |
|---------|------|------|
| GET | `/api/health` | ヘルスチェック |
| POST | `/api/answer/submit` | 回答記録 |
| GET | `/api/answer/status` | 回答済み状態（KV キャッシュ） |
| GET | `/api/answer/history` | 回答履歴 |
| POST | `/api/timer/sync` | タイマー同期 |
| GET | `/api/timer/load` | タイマー読み込み |
| DELETE | `/api/timer/clear` | タイマー削除 |
| GET | `/api/markdown/{unit}/{year}` | AI 向け Markdown（ETag / Cache-Control） |

---

## 試験データの管理

試験データは `src/data/exams-json/` に JSON で格納し、`src/data/exams/loader.ts` が
`import.meta.glob` で読み込みます（ビルド時に worker バンドルへインライン化）。各 JSON は
Zod スキーマ（`src/data/exams/schema.ts`）でバリデーションされ、型安全が保証されます。

データは静的にコミット済みです。JSON を編集したら `pnpm test:run` で整合性テストを
実行してください。

### 図表コンポーネント

| コンポーネント | 対応する図表 |
|--------------|------------|
| `StateDiagram` | 状態遷移図（オートマトン） |
| `BinaryTree` | 二分木 |
| `LogicCircuit` | 論理回路（AND/OR/NOT 等 7 種のゲート） |
| `Flowchart` | フローチャート |
| `TruthTable` | 真理値表 |
| `ParityCheck` | パリティ検査行列 |
| `TableRenderer` | 汎用テーブル |

---

## CI/CD パイプライン

`main` ブランチへの push 時に `deploy.yml` が以下を自動実行します（PR 時は `ci.yml` がデプロイ以外を実行）。

```
1. 依存関係インストール（pnpm install --frozen-lockfile）
2. Lint・フォーマットチェック（biome ci）
3. 型チェック（astro check + tsgo、最大 3 回リトライ）
4. テスト実行（vitest run）
5. 未使用コード検出（knip）
6. ビルド（astro build、最大 3 回リトライ）
7. リンク切れチェック（lychee）
8. D1 マイグレーション適用（migrations/ に差分がある場合のみ）
9. Cloudflare Pages へデプロイ
```

> 型チェック / ビルドのリトライは、`advancedRouting` 下で worker introspection が非決定的に
> "Network connection lost" でフレークするための保険です（真の型エラー・ビルドエラーは
> 3 回とも落ちるためゲートの完全性は維持されます）。

### デプロイに必要な Secrets

| Secret 名 | 説明 |
|-----------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン（Pages デプロイ / D1 マイグレーション） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |

KV / D1 のバインディングは `wrangler.jsonc` で設定します。

---

## 開発ルール

- **パッケージマネージャー**: pnpm のみ使用（npm / yarn 禁止）
- **コードスタイル**: Biome による自動フォーマット（タブインデント、100 文字幅）
- **構成方針**: 複数ルート横断 / ドメインロジックは `src/features/<機能>/` に同居。
  特定ルート専用部品は `_` プレフィックスで co-location。`features` から `types` / `server` /
  `utils` への import は可、逆は禁止。
- **型安全**: 外部データは必ず Zod スキーマでバリデーション
- **テスト**: 古典派（Detroit）ユニットを中心に、public 関数の入出力を AAA で検証

## ライセンス

Private
