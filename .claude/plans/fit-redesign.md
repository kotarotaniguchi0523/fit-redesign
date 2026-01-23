# Plan: 基本情報技術 I 講義資料サイト リデザイン

## 概要
明治大学の基本情報技術 I 講義資料サイトを、単元カード形式で「スライド・小テスト・解答」を1つのユニットとして表示するモダンなUIに再構築する。

## 背景・課題
- 単元とPDFの対応が混乱（FIT番号とExam番号が不一致）
- 年度別suffix（b,c,d,e）の意味が不明確
- 小テストと解答ページの突合が困難

## 技術スタック
- React + Vite + TypeScript
- pnpm（パッケージマネージャー）
- HeroUI（UIコンポーネント）
- Biome（Lint + Format、厳格ルール）
- TsGo（TypeScript型チェック）
- Tailwind CSS

## 実装ステップ

### Phase 1: PDF取得・解析 ✅
1. [x] 全小テストPDFをローカルにダウンロード
2. [x] 解答略解HTMLを取得
3. [x] 問題・選択肢・数式をJSONデータとして構造化（2017年度完了）

### Phase 2: プロジェクトセットアップ ✅
1. [x] pnpm create vite@latest fit-redesign
2. [x] Tailwind CSS 初期化
3. [x] Biome初期化（厳格ルール設定）
4. [x] TsGo設定
5. [x] HeroUI導入

### Phase 3: データ・型定義 ✅
1. [x] types/index.ts - Unit, Exam, Question型
2. [x] data/units.ts - 単元データ
3. [x] data/exams/*.ts - 各小テストの問題データ

### Phase 4: コンポーネント実装 ✅
1. [x] Header - サイトヘッダー
2. [x] UnitTabs - 単元タブ
3. [x] YearSelector - 年度ラジオボタン
4. [x] QuestionCard - 問題カード
5. [x] AnswerToggle - 解答トグル
6. [x] PdfLink - PDF印刷用リンク
7. [x] SlideSection - 講義スライドセクション

### Phase 5: 図コンポーネント 🔄 進行中
1. [x] StateDiagram - 状態遷移図
2. [x] BinaryTree - 二分木
3. [x] TruthTable - 真理値表
4. [x] ParityCheck - パリティ検査符号
5. [ ] 図コンポーネントを問題データに統合

### Phase 6: 統合 🔄 進行中
1. [x] タブ・年度状態管理
2. [x] 各タブで正しいexamデータを表示
3. [ ] 他の年度（2013-2016）のデータ追加
4. [ ] レスポンシブ対応
5. [ ] 印刷用CSS

## 作成・変更するファイル
| ファイル | 操作 | 説明 |
|---------|------|------|
| src/types/index.ts | 完了 | 型定義 |
| src/data/units.ts | 完了 | 単元データ |
| src/data/exams.ts | 完了 | 小テストデータ |
| src/data/exams/*.ts | 完了 | 年度別問題データ |
| src/components/*.tsx | 完了 | UIコンポーネント |
| src/components/figures/*.tsx | 完了 | 図コンポーネント |
| public/pdf/*.pdf | 完了 | PDFファイル |

## 検証方法
```bash
pnpm install
pnpm format      # Lint + Format
pnpm typecheck   # TsGo型チェック
pnpm dev         # 開発サーバー
```
- 年度フィルターの動作確認
- 2013年度: 9タブ表示
- 2014年度以降: 5タブ表示
- 解答トグルが正しく動作するか
- オリジナルPDFリンクが機能するか
