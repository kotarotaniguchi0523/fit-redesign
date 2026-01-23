# Plan: Phase 6-3 2013-2016年度の問題データ追加

## 概要
現在2017年度のみ実装されている問題データに、2013-2016年度のデータを追加する。

## 背景・課題
- 2017年度（suffix: e）のデータのみ実装済み
- PDFは全年度ダウンロード済み（public/pdf/）
- 解答HTMLも取得済み（public/answers/）

## 年度別suffixマッピング
| 年度 | suffix | 例 |
|------|--------|-----|
| 2013 | 無印 | Exam1-Base.pdf |
| 2014 | b | Exam1b-Base.pdf |
| 2015 | c | Exam1c-Base.pdf |
| 2016 | d | Exam1d-Base.pdf |
| 2017 | e | Exam1e-Base.pdf (実装済み) |

## 利用可能なPDFファイル
| Exam | 2013 | 2014 | 2015 | 2016 | 2017 |
|------|------|------|------|------|------|
| Exam1 (基数) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exam2 (負数) | ✓ | ✓ | ✓ | ✓ | - |
| Exam3 (浮動) | ✓ | - | - | - | - |
| Exam4 (論理) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exam5 (確率) | ✓ | - | - | - | - |
| Exam6 (FSM) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exam7 (ECC) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exam8 (Stack) | ✓ | ✓ | ✓ | ✓ | - |
| Exam9 (Sort) | ✓ | ✓ | - | - | - |

## 実装ステップ

### Step 1: 2016年度データ作成（優先度高）
対象: Exam1d〜Exam8d
作成ファイル:
- `src/data/exams/exam1-base-2016.ts`
- `src/data/exams/exam2-negative-2016.ts`
- `src/data/exams/exam4-logic-2016.ts`
- `src/data/exams/exam6-fsm-2016.ts`
- `src/data/exams/exam7-ecc-2016.ts`
- `src/data/exams/exam8-stack-2016.ts`

### Step 2: 2015年度データ作成
対象: Exam1c〜Exam8c

### Step 3: 2014年度データ作成
対象: Exam1b〜Exam9b

### Step 4: 2013年度データ作成
対象: Exam1〜Exam9（9つの小テスト、A/B版あり）

### Step 5: exams.ts への統合
- 各ExamByYearオブジェクトに年度別データを追加
- index.tsのエクスポート文更新

### Step 6: 検証
- TypeScriptコンパイルエラーチェック
- UIでの表示確認

## 作成・変更するファイル
| ファイル | 操作 | 説明 |
|---------|------|------|
| src/data/exams/*-2016.ts | 新規作成 | 2016年度問題データ |
| src/data/exams/*-2015.ts | 新規作成 | 2015年度問題データ |
| src/data/exams/*-2014.ts | 新規作成 | 2014年度問題データ |
| src/data/exams/*-2013.ts | 新規作成 | 2013年度問題データ |
| src/data/exams.ts | 変更 | 年度データの統合 |
| src/data/exams/index.ts | 変更 | エクスポート追加 |

## 検証方法
1. `pnpm typecheck` - 型エラーなし
2. UIで各年度を選択し、問題が表示されることを確認
3. 年度切り替えでデータが正しく反映されることを確認

## 工数見積もり
- 2016年度: 6ファイル × 5問 = 30問
- 2015年度: 5ファイル × 5問 = 25問
- 2014年度: 6ファイル × 5問 = 30問
- 2013年度: 9ファイル × 5問 = 45問（A/B版含む）
- **合計: 約130問の問題データ**
