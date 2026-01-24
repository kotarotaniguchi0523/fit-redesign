# Plan: 論理回路図コンポーネントの実装

## ステータス: ✅ 完了 (2026-01-25)

## 概要
論理回路を描画するLogicCircuitコンポーネントを新規作成し、図が表示されていない問題に対応する。

## 背景・課題
- exam4-2013-q2、exam4-2014-q5で論理回路図が必要
- 現在は `figureDescription` のみでプレースホルダー表示
- `FigureData` 型に `logicCircuit` タイプが存在しない

## 実装ステップ

### Step 1: 型定義追加
```typescript
// types/figures.ts
export type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR";

export interface LogicGate {
  id: string;
  type: GateType;
  x: number;
  y: number;
  inputs: string[];
}

export interface LogicCircuitData {
  type: "logicCircuit";
  inputs: { id: string; label: string; x: number; y: number }[];
  outputs: { id: string; label: string; x: number; y: number }[];
  gates: LogicGate[];
  wires: { from: string; to: string; points?: {x:number;y:number}[] }[];
}
```

### Step 2: LogicCircuitコンポーネント作成
SVGベースで論理ゲートを描画（StateDiagram.tsxを参考）

### Step 3: QuestionCardに統合
renderFigure関数にlogicCircuitケース追加

### Step 4: 問題データにfigureData追加
exam4-logic-2013.ts等に回路データを追加

## 作成・変更するファイル

| ファイル | 操作 | 説明 |
|---------|------|------|
| src/types/figures.ts | 変更 | 論理回路型追加 |
| src/types/index.ts | 変更 | FigureData拡張 |
| src/components/figures/LogicCircuit.tsx | 新規 | 回路描画コンポーネント |
| src/components/figures/index.ts | 変更 | export追加 |
| src/components/QuestionCard.tsx | 変更 | renderFigure拡張 |
| src/data/exams/exam4-logic-2013.ts | 変更 | figureData追加 |

## 検証方法
1. 小テスト4（2013年度）で論理回路図が表示されることを確認
2. 各ゲート（AND, OR, NOT等）が正しく描画されることを確認

## 実装時の仕様変更

### LogicGate.inputs削除
当初計画では`LogicGate.inputs`で接続情報を持つ設計だったが、`LogicWire`と重複するため削除：

```typescript
// 変更前
export interface LogicGate {
  id: string;
  type: GateType;
  x: number;
  y: number;
  inputs: string[]; // 削除
}

// 変更後
export interface LogicGate {
  id: string;
  type: GateType;
  x: number;
  y: number;
}
```

### レスポンシブ対応追加
モバイル対応のため以下を追加：
- `width="100%"`, `height="auto"`
- `preserveAspectRatio="xMidYMid meet"`
- `style={{ aspectRatio }}`

### 対応ゲートタイプ
AND, OR, NOT, NAND, NOR, XOR, XNOR（7種類）
