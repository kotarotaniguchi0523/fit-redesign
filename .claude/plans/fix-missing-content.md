# Plan: 欠落コンテンツの修正

## ステータス: ✅ 完了 (2026-01-25)

## 概要
確率ページの欠落と、いくつかの年度・単元で欠落しているデータを追加する。

## 背景・課題
- 確率（probability）専用データはexam5-prob-2013.tsのみ
- 2014年以降は確率問題がFSM等と統合されている
- 一部年度のデータファイルが欠落

## 調査結果

### 確率データの問題
- `exam5-prob-2013.ts` のQ1は論理演算問題（誤配置）
- 2014-2017年は `exam6-fsm-*.ts` に確率問題が含まれる

### 欠落ファイル
| 年度 | 欠落 | 参照PDF |
|------|------|---------|
| 2015 | exam8（データ構造） | Exam8c-Stack.pdf |
| 2016 | exam3（集合・論理） | Exam4d-logic.pdf |
| 2017 | exam3（集合・論理） | Exam4e-logic.pdf |

## 実装ステップ

### Step 1: exam5-prob-2013.ts修正
Q1を正しい確率問題に置き換え

### Step 2: 欠落データファイル作成
- exam8-stack-2015.ts
- exam3-logic-2016.ts
- exam3-logic-2017.ts

### Step 3: index.ts更新
新規データのインポートと統合

### Step 4: units.ts修正
集合と確率単元のexamMapping更新

## 作成・変更するファイル

| ファイル | 操作 | 説明 |
|---------|------|------|
| src/data/exams/exam5-prob-2013.ts | 変更 | Q1修正 |
| src/data/exams/exam8-stack-2015.ts | 新規 | 2015年データ構造 |
| src/data/exams/exam3-logic-2016.ts | 新規 | 2016年集合・論理 |
| src/data/exams/exam3-logic-2017.ts | 新規 | 2017年集合・論理 |
| src/data/exams/index.ts | 変更 | インポート追加 |
| src/data/units.ts | 変更 | マッピング修正 |

## 検証方法
1. 確率ページに問題が表示されることを確認
2. 全単元・年度で問題が表示されることを確認

## 実装時の仕様変更

### 追加修正項目
当初計画に加えて、以下の修正も実施：

| 項目 | 修正内容 |
|------|---------|
| index.ts | PDFパス大文字小文字修正（Exam4-Logic.pdf→Exam4-logic.pdf） |
| units.ts | 符号理論2013年度のexamNumbers修正（[8]→[7]） |

### 作成ファイル
- `exam3-logic-2016.ts` - 5問（べき集合、論理式簡約、論理回路、XOR演算、条件付き確率）
- `exam3-logic-2017.ts` - 5問（べき集合、論理式簡約、真理値表、XOR演算、シフト演算）
- `exam8-stack-2015.ts` - データ構造問題
