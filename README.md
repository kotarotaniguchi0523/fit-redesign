# FIT Redesign

明治大学「基本情報技術 I」のインタラクティブ学習プラットフォーム。
過去の小テスト（2013〜2017年度）を Web 上で演習できるアプリケーションです。

**本番 URL**: https://fit-redesign.pages.dev

## 機能

- 全 9 単元 × 最大 5 年分の小テスト演習
- 選択肢の正誤判定と解説表示
- タイマー機能（経過時間・問題ごとの所要時間記録）
- 各単元の講義スライド閲覧
- 問題の Markdown エクスポート（クリップボードコピー）
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
| フレームワーク | React 19 + TypeScript |
| ビルドツール | Vite 7 |
| UIライブラリ | HeroUI 2 |
| スタイリング | TailwindCSS 4 |
| アニメーション | Framer Motion 12 |
| バリデーション | Zod 4 |
| リンター/フォーマッター | Biome 2 |
| テスト | Vitest 4 |
| 型チェック | tsgo (TypeScript native preview) |
| デプロイ | Cloudflare Pages |
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

### 開発サーバー起動

```bash
pnpm dev
```

`http://localhost:5173` でアクセスできます。

---

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | 本番ビルド（tsgo + vite build） |
| `pnpm preview` | ビルド結果をローカルで確認 |
| `pnpm format` | Biome でコードフォーマット |
| `pnpm check` | Biome で Lint・フォーマットチェック（CI 用） |
| `pnpm typecheck` | 型チェック（tsgo --noEmit） |
| `pnpm knip` | 未使用コードの検出 |
| `pnpm test` | テスト実行（watch モード） |
| `pnpm test:run` | テスト実行（1 回のみ、CI 用） |
| `pnpm test:coverage` | カバレッジ付きテスト実行 |
| `pnpm data:convert` | 試験データ JSON を再生成 |

---

## ディレクトリ構成

```
fit-redesign/
├── src/
│   ├── components/          # React コンポーネント
│   │   ├── figures/         # 図表描画（オートマトン、論理回路、二分木 等）
│   │   └── icons/           # アイコンコンポーネント
│   ├── data/
│   │   ├── exams/           # 試験データローダー・スキーマ定義
│   │   ├── exams-json/      # 試験データ JSON ファイル（41 ファイル）
│   │   ├── units.ts         # 単元定義・試験マッピング
│   │   └── slides.ts        # 講義スライド設定
│   ├── hooks/               # カスタム Hooks（タイマー、クリップボード 等）
│   ├── types/               # 型定義・Zod スキーマ
│   ├── utils/               # ユーティリティ関数
│   ├── App.tsx              # メインアプリコンポーネント
│   ├── main.tsx             # エントリーポイント
│   └── index.css            # グローバルスタイル・CSS 変数
├── scripts/
│   └── convert-exams-to-json.mjs  # TS → JSON 変換スクリプト
├── public/
│   └── pdf/                 # 試験 PDF・解答 PDF
├── .github/workflows/
│   └── deploy.yml           # CI/CD パイプライン
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── biome.json
└── knip.json
```

---

## 試験データの管理

### データ構造

試験データは `src/data/exams-json/` に JSON ファイルとして格納されています。

```
exam{番号}-{年度}.json    # 例: exam1-2013.json
exams-meta.json           # 全試験のメタデータ（利用可能な年度一覧）
```

各 JSON ファイルは Zod スキーマ（`src/data/exams/schema.ts`）でバリデーションされ、型安全が保証されています。

### 試験データの更新手順

1. TypeScript のソースデータを更新する
2. JSON ファイルを再生成する：
   ```bash
   pnpm data:convert
   ```
3. 整合性テストを実行して検証する：
   ```bash
   pnpm test:run
   ```

### 図表コンポーネント

試験データ内の図表は専用コンポーネントで描画されます。

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

`main` ブランチへの push 時に以下が自動実行されます。

```
1. 依存関係インストール（pnpm install --frozen-lockfile）
2. Lint・フォーマットチェック（biome ci）
3. 型チェック（tsgo --noEmit）
4. テスト実行（vitest run）
5. 未使用コード検出（knip）
6. ビルド（tsgo + vite build）
7. リンク切れチェック（lychee）
8. Cloudflare Pages へデプロイ
```

Pull Request 時はステップ 1〜7 が実行されます（デプロイはスキップ）。

### デプロイに必要な Secrets

| Secret 名 | 説明 |
|-----------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |

---

## 保守・運用ガイド

### 新しい年度のデータを追加する

1. `src/types/index.ts` の `YEARS` に年度を追加
2. 試験データの TypeScript ソースを作成
3. `src/data/units.ts` で該当年度の `examMapping` を追加
4. `pnpm data:convert` で JSON を再生成
5. `pnpm test:run` で整合性を確認

### 新しい単元を追加する

1. `src/data/units.ts` に単元定義を追加
2. 必要に応じて `src/data/slides.ts` にスライド設定を追加
3. 各年度の試験マッピングを設定

### 新しい図表タイプを追加する

1. `src/types/figures.ts` に図表の型定義を追加
2. `src/components/figures/` に描画コンポーネントを作成
3. `src/data/exams/schema.ts` で Zod スキーマを更新
4. テストを追加

### トラブルシューティング

| 症状 | 対処法 |
|-----|--------|
| ビルドが `tsgo` で失敗する | `@typescript/native-preview` のバージョンを確認 |
| 試験データが表示されない | `pnpm data:convert` で JSON を再生成 |
| スタイルが適用されない | TailwindCSS の設定と `index.css` の import を確認 |
| テストが失敗する | `pnpm test:run` でエラー詳細を確認。スキーマ変更時は JSON 再生成が必要 |
| デプロイが失敗する | GitHub Secrets の設定と Cloudflare プロジェクト名を確認 |

---

## 開発ルール

- **パッケージマネージャー**: pnpm のみ使用（npm/yarn 禁止）
- **コードスタイル**: Biome による自動フォーマット（タブインデント、100 文字幅）
- **型安全**: 外部データは必ず Zod スキーマでバリデーション
- **テスト**: Hooks・ユーティリティ・データ整合性のテストを維持

## ライセンス

Private
