---
name: pdf-to-questions
description: PDFファイルから問題データを抽出し、TypeScriptコードとして出力する
allowed-tools: Bash(uv:*), Bash(python:*)
---

# PDF to Questions Skill

PDFファイルから問題データを抽出し、TypeScriptコードとして出力するスキル。
Doclingを使用して図も正確に抽出する。

## 引数

```
/pdf-to-questions <pdf-path>
```

- `<pdf-path>`: 変換するPDFファイルのパス（相対パスまたは絶対パス）

## 環境セットアップ（初回のみ）

スキルディレクトリで `uv sync` を実行する（`.venv` が自動作成される）。

```bash
cd .claude/skills/pdf-to-questions
uv sync
```

依存関係を追加する場合は `uv add` を使用:

```bash
cd .claude/skills/pdf-to-questions
uv add <package-name>
```

## 実行手順

### Step 1: PDFをDoclingで変換

```bash
uv run python .claude/skills/pdf-to-questions/scripts/extract_pdf.py "$ARGUMENTS" --output .claude/skills/pdf-to-questions/extracted/
```

出力:
- `extracted/text.md` - Markdown形式のテキスト
- `extracted/figures/` - 抽出された図（PNG）
- `extracted/metadata.json` - 図の分類情報

### Step 2: 抽出結果を確認

Readツールで以下を読み込む:
1. `extracted/text.md` - 問題文と選択肢
2. `extracted/metadata.json` - 図の種類と位置情報
3. `extracted/figures/*.png` - 図の画像

### Step 3: 問題データを構造化

抽出した情報から以下を特定:
- 問題番号、問題文、選択肢、正解
- 各図の種類（状態遷移図、二分木、真理値表、パリティ検査）

### Step 4: 図をデータ形式に変換

図の画像を見て、既存コンポーネントのデータ形式に変換:

| 図の種類 | type値 | 変換先 |
|---------|--------|--------|
| 状態遷移図（丸と矢印） | `"state-diagram"` | `StateDiagramProps` |
| 二分木（木構造） | `"binary-tree"` | `BinaryTreeProps` |
| 真理値表（表形式） | `"truth-table"` | `TruthTableProps` |
| パリティ検査（グリッド） | `"parity-check"` | `ParityCheckProps` |

**図データの詳細形式は [reference.md](reference.md) を参照すること。**

### Step 5: TypeScriptコードを生成

以下の形式で出力:

```typescript
import type { Question } from "@/types/question";

export const exam6_2013: Question[] = [
  {
    id: "exam6-2013-q3",
    number: 3,
    text: "問題文...",
    figure: {
      type: "state-diagram",
      data: {
        // StateDiagramProps形式
      }
    },
    options: [
      { label: "ア", text: "選択肢ア" },
      { label: "イ", text: "選択肢イ" },
      { label: "ウ", text: "選択肢ウ" },
      { label: "エ", text: "選択肢エ" }
    ],
    answer: "ア"
  }
];
```

## ディレクトリ構造

```
.claude/skills/pdf-to-questions/
├── SKILL.md              # この定義ファイル
├── reference.md          # 図コンポーネントのデータ形式
├── pyproject.toml        # 依存関係定義
├── scripts/
│   └── extract_pdf.py    # PDF変換スクリプト
└── extracted/            # 抽出結果（自動生成）
    ├── text.md
    ├── metadata.json
    └── figures/
```

## 出力例

```typescript
import type { Question } from "@/types/question";

export const exam6_2013: Question[] = [
  {
    id: "exam6-2013-q3",
    number: 3,
    text: "以下の状態遷移図で定義される有限オートマトンがある。この有限オートマトンが受理する文字列はどれか。",
    figure: {
      type: "state-diagram",
      data: {
        nodes: [
          { id: "S0", label: "S₀", x: 60, y: 75, isInitial: true },
          { id: "S1", label: "S₁", x: 200, y: 75 },
          { id: "S2", label: "S₂", x: 340, y: 75, isAccepting: true }
        ],
        transitions: [
          { from: "S0", to: "S0", label: "0" },
          { from: "S0", to: "S1", label: "1" },
          { from: "S1", to: "S0", label: "0", curveOffset: 20 },
          { from: "S1", to: "S2", label: "1" },
          { from: "S2", to: "S1", label: "0", curveOffset: 20 },
          { from: "S2", to: "S2", label: "1" }
        ],
        width: 400,
        height: 150
      }
    },
    options: [
      { label: "ア", text: "0100" },
      { label: "イ", text: "0110" },
      { label: "ウ", text: "1001" },
      { label: "エ", text: "1100" }
    ],
    answer: "イ"
  }
];
```

## 注意事項

- 問題文は原文のまま抽出（改行は適宜整形）
- 数式は可能な限りUnicodeで表現（例: S₀, S₁）
- 図の座標は見やすいレイアウトになるよう調整
- 選択肢ラベルは日本語（ア、イ、ウ、エ）
