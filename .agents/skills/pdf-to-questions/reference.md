# 図コンポーネント データ形式リファレンス

このドキュメントは、PDF→構造化データ変換時に使用する図コンポーネントのデータ形式を定義する。

## 1. StateDiagram（状態遷移図）

### インターフェース定義

```typescript
interface StateNode {
  id: string;           // ノードの一意識別子（例: "S0", "S1"）
  label: string;        // 表示ラベル（例: "S₀", "S₁"）
  x: number;            // X座標（SVG座標系）
  y: number;            // Y座標（SVG座標系）
  isInitial?: boolean;  // 初期状態か（左端に入力矢印）
  isAccepting?: boolean; // 受理状態か（二重丸）
}

interface Transition {
  from: string;         // 遷移元ノードID
  to: string;           // 遷移先ノードID
  label: string;        // 遷移ラベル（例: "0", "1", "a"）
  curveOffset?: number; // 曲線の場合のオフセット（双方向遷移用）
}

interface StateDiagramData {
  nodes: StateNode[];
  transitions: Transition[];
  width?: number;       // SVG幅（デフォルト: 400）
  height?: number;      // SVG高さ（デフォルト: 150）
}
```

### 座標設計のガイドライン

- ノード半径: 20px（受理状態の外円: 25px）
- 推奨Y座標: 75（単一行の場合）
- ノード間隔: 100〜150px
- 初期状態の矢印スペース: 左に40px確保

### 使用例

```typescript
figure: {
  type: "state-diagram",
  data: {
    nodes: [
      { id: "S0", label: "S₀", x: 60, y: 75, isInitial: true },
      { id: "S1", label: "S₁", x: 200, y: 75 },
      { id: "S2", label: "S₂", x: 340, y: 75, isAccepting: true }
    ],
    transitions: [
      { from: "S0", to: "S0", label: "0" },           // 自己ループ
      { from: "S0", to: "S1", label: "1" },           // 直線
      { from: "S1", to: "S0", label: "0", curveOffset: 20 }, // 曲線（逆方向）
      { from: "S1", to: "S2", label: "1" },
      { from: "S2", to: "S1", label: "0", curveOffset: 20 },
      { from: "S2", to: "S2", label: "1" }
    ],
    width: 400,
    height: 150
  }
}
```

### 特殊ケース

**自己ループ**: `from === to` の遷移。ノードの上に円として描画される。

**双方向遷移**: A→BとB→Aの両方がある場合、`curveOffset` を設定して曲線にする。
- 正の値: 上に曲がる
- 負の値: 下に曲がる
- 推奨値: 20〜30

---

## 2. BinaryTree（二分木）

### インターフェース定義

```typescript
interface TreeNode {
  value: string | number;  // ノードの値
  left?: TreeNode;         // 左の子ノード
  right?: TreeNode;        // 右の子ノード
}

interface BinaryTreeData {
  root: TreeNode;
  width?: number;          // SVG幅（デフォルト: 300）
  height?: number;         // SVG高さ（デフォルト: 200）
  nodeRadius?: number;     // ノード半径（デフォルト: 20）
}
```

### 使用例

```typescript
figure: {
  type: "binary-tree",
  data: {
    root: {
      value: "A",
      left: {
        value: "B",
        left: { value: "D" },
        right: { value: "E" }
      },
      right: {
        value: "C",
        left: { value: "F" },
        right: { value: "G" }
      }
    },
    width: 300,
    height: 200
  }
}
```

### 変換のコツ

- PDFの木構造を上から順に読み取る
- 左の子は `left`、右の子は `right` に配置
- 葉ノードは子プロパティを省略

---

## 3. TruthTable（真理値表）

### インターフェース定義

```typescript
interface TruthTableColumn {
  key: string;    // 内部キー（英数字推奨）
  label: string;  // 表示ラベル（数式可）
}

interface TruthTableRow {
  [key: string]: string | number | boolean;  // 各列の値
}

interface TruthTableData {
  columns: TruthTableColumn[];
  rows: TruthTableRow[];
  ariaLabel?: string;  // アクセシビリティラベル
}
```

### 使用例

```typescript
figure: {
  type: "truth-table",
  data: {
    columns: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
      { key: "and", label: "A ∧ B" },
      { key: "or", label: "A ∨ B" }
    ],
    rows: [
      { a: 0, b: 0, and: 0, or: 0 },
      { a: 0, b: 1, and: 0, or: 1 },
      { a: 1, b: 0, and: 0, or: 1 },
      { a: 1, b: 1, and: 1, or: 1 }
    ]
  }
}
```

### 変換のコツ

- 表のヘッダーを `columns` に変換
- 各行を `rows` に変換（キーはcolumnsのkeyと一致させる）
- 論理演算子はUnicode使用（∧, ∨, ¬, →, ↔）

---

## 4. ParityCheck（パリティ検査）

### インターフェース定義

```typescript
interface ParityCheckData {
  data: number[][];    // データビット行列（0または1）
  width?: number;      // SVG幅（デフォルト: 300）
  height?: number;     // SVG高さ（デフォルト: 300）
  cellSize?: number;   // セルサイズ（デフォルト: 40）
}
```

### 使用例

```typescript
figure: {
  type: "parity-check",
  data: {
    data: [
      [1, 0, 1, 1],
      [0, 1, 1, 0],
      [1, 1, 0, 1],
      [0, 0, 1, 0]
    ],
    width: 300,
    height: 300
  }
}
```

### 重要な注意点

- `data` にはデータビットのみを格納
- 水平・垂直パリティビットはコンポーネントが自動計算
- PDFにパリティビットが含まれている場合は、データビット部分のみを抽出

---

## Question型との統合

### Question型定義（参考）

```typescript
interface QuestionOption {
  label: string;  // "ア", "イ", "ウ", "エ"
  text: string;   // 選択肢のテキスト
}

interface QuestionFigure {
  type: "state-diagram" | "binary-tree" | "truth-table" | "parity-check";
  data: StateDiagramData | BinaryTreeData | TruthTableData | ParityCheckData;
}

interface Question {
  id: string;
  number: number;
  text: string;
  figure?: QuestionFigure;
  options: QuestionOption[];
  answer: string;
}
```

### 複数の図がある場合

問題に複数の図がある場合は、`figures` 配列を使用：

```typescript
{
  id: "exam-q5",
  number: 5,
  text: "問題文...",
  figures: [
    {
      type: "state-diagram",
      data: { /* ... */ }
    },
    {
      type: "truth-table",
      data: { /* ... */ }
    }
  ],
  options: [...],
  answer: "ウ"
}
```

---

## Unicode文字リファレンス

よく使う特殊文字：

| 用途 | 文字 | Unicode |
|------|------|---------|
| 下付き数字 | ₀₁₂₃₄₅₆₇₈₉ | U+2080〜U+2089 |
| 論理積 | ∧ | U+2227 |
| 論理和 | ∨ | U+2228 |
| 否定 | ¬ | U+00AC |
| 含意 | → | U+2192 |
| 同値 | ↔ | U+2194 |
| 排他的論理和 | ⊕ | U+2295 |
