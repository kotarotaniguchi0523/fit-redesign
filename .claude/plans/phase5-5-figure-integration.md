# Plan: Phase 5-5 図コンポーネント統合の検証・完了

## 概要
図コンポーネント（StateDiagram, BinaryTree, TruthTable, ParityCheck）がQuestionCardに正しく統合され、2017年度の問題で正しくレンダリングされることを検証する。

## 背景・課題
- 図コンポーネントは既に作成済み（Phase 5-1〜5-4完了）
- QuestionCardへの統合コミット（b983ca7）が存在
- 実際のブラウザ表示での動作確認が未完了

## 現状分析

### 図データ登録済み問題一覧（2017年度）
| 小テスト | 問題番号 | 図タイプ | データファイル |
|---------|---------|---------|--------------|
| Exam6 (FSM) | Q0 | stateDiagram | exam6-fsm.ts |
| Exam4 (論理) | Q3 | truthTable | exam4-logic.ts |
| Exam7 (ECC) | Q4 | parityCheck | exam7-ecc.ts |
| Exam8 (Stack) | Q1 | binaryTree | exam8-stack.ts |

## 実装ステップ

### Step 1: 開発サーバー起動・基本動作確認
```bash
pnpm dev
```
- TypeScriptエラーがないか確認

### Step 2: 各図コンポーネントの表示検証
1. **StateDiagram** (小テスト6 > 問題0)
   - 3ノード（S0, S1, S2）描画
   - 初期状態・受理状態の表示
   - 自己ループ・曲線遷移

2. **TruthTable** (小テスト4 > 問題3)
   - 3列×4行の表示
   - HeroUI Tableスタイル

3. **ParityCheck** (小テスト7 > 問題4)
   - データビット行列
   - 水平/垂直パリティビット

4. **BinaryTree** (小テスト5 > 問題1)
   - 二分木ノード配置
   - エッジ描画

### Step 3: 品質チェック
```bash
pnpm format && pnpm typecheck && pnpm build
```

## 作成・変更するファイル
| ファイル | 操作 | 説明 |
|---------|------|------|
| （検証のみ） | - | ファイル変更なし |

## 検証方法
1. `pnpm dev` で開発サーバー起動
2. 各タブで該当問題の図が表示されることを確認
3. agent-browserでスクリーンショット取得

## 完了条件
- 4種類全ての図コンポーネントが正しくレンダリングされる
- Lint/TypeCheck/Buildがパスする
