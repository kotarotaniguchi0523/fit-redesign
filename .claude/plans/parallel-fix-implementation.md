# Plan: 問題データ修正・バグ修正の並列実装

## 概要
2013年単元選択バグ、AIが作成した不完全な問題文、表組みの改善、欠落データの補完を、依存関係を考慮した並列実装で効率的に解決する。

## 背景・課題
1. 2013年選択時に単元が「基数変換」に戻るバグ
2. AIが適当に作成した問題文（PDFと乖離）
3. 表組みが見づらい（区切り線なし）
4. 年度データの欠落（2014年を中心に多数）

---

## 依存関係分析

```
┌─────────────────────────────────────────────────────────────────┐
│ Wave 1 (並列実行可能)                                            │
├─────────────────────────────────────────────────────────────────┤
│ [A] UnitTabs.tsx修正      [B] exam8-stack-2017.ts修正           │
│     (Phase 0)                 (Phase 1)                         │
│                                                                 │
│ [C] exam1-base-2017.ts修正  [D] exam5-ecc-2015.ts修正           │
│     (Phase 1)                   (Phase 1)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓ レビュー
┌─────────────────────────────────────────────────────────────────┐
│ Wave 2 (単独)                                                    │
├─────────────────────────────────────────────────────────────────┤
│ [E] types/figures.ts に TableData型追加 (Phase 2)               │
│     → types/index.ts で re-export                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Wave 3 (並列実行可能)                                            │
├─────────────────────────────────────────────────────────────────┤
│ [F] exam8-stack-2016.ts    [G] exam7-ecc-2014.ts                │
│     表データ修正               表データ修正                       │
│                                                                 │
│ [H] exam6-fsm-2014.ts      [I] TableRenderer.tsx作成            │
│     表データ修正               新規コンポーネント                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ レビュー
┌─────────────────────────────────────────────────────────────────┐
│ Wave 4 (並列実行可能) - Phase 3                                  │
├─────────────────────────────────────────────────────────────────┤
│ [J] exam2-2014作成         [K] exam6-2015作成                   │
│ [L] exam7-2015作成         [M] exam8-2014作成                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Wave 5 (単独)                                                    │
├─────────────────────────────────────────────────────────────────┤
│ [N] exams/index.ts 更新 - すべての新規ファイルを登録             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ 最終レビュー
```

---

## コンフリクト回避マトリクス

| ファイル | Wave 1 | Wave 2 | Wave 3 | Wave 4 | Wave 5 |
|---------|--------|--------|--------|--------|--------|
| UnitTabs.tsx | A | - | - | - | - |
| types/figures.ts | - | E | - | - | - |
| types/index.ts | - | E | - | - | - |
| exam8-stack-2017.ts | B | - | - | - | - |
| exam1-base-2017.ts | C | - | - | - | - |
| exam5-ecc-2015.ts | D | - | - | - | - |
| exam8-stack-2016.ts | - | - | F | - | - |
| exam7-ecc-2014.ts | - | - | G | - | - |
| exam6-fsm-2014.ts | - | - | H | - | - |
| TableRenderer.tsx | - | - | I(新規) | - | - |
| exam2-negative-2014.ts | - | - | - | J(新規) | - |
| exam6-fsm-2015.ts | - | - | - | K(新規) | - |
| exam7-ecc-2015.ts | - | - | - | L(新規) | - |
| exam8-stack-2014.ts | - | - | - | M(新規) | - |
| exams/index.ts | - | - | - | - | N |

**結論**: 各Wave内で同一ファイルへのアクセスなし → コンフリクトなし

---

## 実装ステップ

### Wave 1: 緊急修正（4並列）

| タスクID | 内容 | サブエージェント | 担当ファイル |
|---------|------|----------------|-------------|
| W1-A | UnitTabs.tsx制御コンポーネント化 | task-executor | UnitTabs.tsx |
| W1-B | exam8-stack-2017問題文修正 | task-executor | exam8-stack-2017.ts |
| W1-C | exam1-base-2017問題文修正 | task-executor | exam1-base-2017.ts |
| W1-D | exam5-ecc-2015選択肢修正 | task-executor | exam5-ecc-2015.ts |

**Wave 1完了後**: code-reviewer でレビュー

### Wave 2: 型定義追加（単独）

| タスクID | 内容 | サブエージェント | 担当ファイル |
|---------|------|----------------|-------------|
| W2-E | TableData型定義追加 | task-executor | types/figures.ts, types/index.ts |

### Wave 3: 表組み改善（4並列）

| タスクID | 内容 | サブエージェント | 担当ファイル |
|---------|------|----------------|-------------|
| W3-F | exam8-stack-2016表データ化 | task-executor | exam8-stack-2016.ts |
| W3-G | exam7-ecc-2014表データ化 | task-executor | exam7-ecc-2014.ts |
| W3-H | exam6-fsm-2014表データ化 | task-executor | exam6-fsm-2014.ts |
| W3-I | TableRendererコンポーネント作成 | task-executor | components/figures/TableRenderer.tsx |

**Wave 3完了後**: code-reviewer でレビュー

### Wave 4: 欠落データ補完（4並列）

| タスクID | 内容 | サブエージェント | 担当ファイル |
|---------|------|----------------|-------------|
| W4-J | exam2-2014作成 | task-executor | exam2-negative-2014.ts |
| W4-K | exam6-2015作成 | task-executor | exam6-fsm-2015.ts |
| W4-L | exam7-2015作成 | task-executor | exam7-ecc-2015.ts |
| W4-M | exam8-2014作成 | task-executor | exam8-stack-2014.ts |

### Wave 5: index.ts統合（単独）

| タスクID | 内容 | サブエージェント | 担当ファイル |
|---------|------|----------------|-------------|
| W5-N | 新規ファイルをindex.tsに登録 | task-executor | exams/index.ts |

**最終レビュー**: code-reviewer で全体レビュー

---

## 作成・変更するファイル

| ファイル | 操作 | Wave | 説明 |
|---------|------|------|------|
| src/components/UnitTabs.tsx | 変更 | 1 | 制御コンポーネント化、selectedKey追加 |
| src/data/exams/exam8-stack-2017.ts | 変更 | 1 | PDFから問題文を抽出して修正 |
| src/data/exams/exam1-base-2017.ts | 変更 | 1 | 問題文を精査・修正 |
| src/data/exams/exam5-ecc-2015.ts | 変更 | 1 | 空の選択肢を修正 |
| src/types/figures.ts | 変更 | 2 | TableData型追加 |
| src/types/index.ts | 変更 | 2 | TableData型をre-export |
| src/data/exams/exam8-stack-2016.ts | 変更 | 3 | 表データをfigureData形式に |
| src/data/exams/exam7-ecc-2014.ts | 変更 | 3 | 表データをfigureData形式に |
| src/data/exams/exam6-fsm-2014.ts | 変更 | 3 | 表データをfigureData形式に |
| src/components/figures/TableRenderer.tsx | 新規作成 | 3 | 汎用テーブルコンポーネント |
| src/data/exams/exam2-negative-2014.ts | 新規作成 | 4 | 2014年負数表現問題 |
| src/data/exams/exam6-fsm-2015.ts | 新規作成 | 4 | 2015年FSM問題 |
| src/data/exams/exam7-ecc-2015.ts | 新規作成 | 4 | 2015年符号理論問題 |
| src/data/exams/exam8-stack-2014.ts | 新規作成 | 4 | 2014年データ構造問題 |
| src/data/exams/index.ts | 変更 | 5 | 新規ファイルのimport/export追加 |

---

## サブエージェント使用計画

| エージェント | 用途 | 使用タイミング |
|-------------|------|---------------|
| taskmaster:task-executor | 個別タスク実装 | 各Wave内のタスク実行 |
| feature-dev:code-reviewer | 品質検証 | Wave 1, 3完了後、最終レビュー |
| context7-plugin:docs-researcher | PDFから問題抽出 | Wave 1, 4で必要に応じて |

---

## 検証方法

### Wave 1完了後
- [ ] 2013年で単元切替後、年度を変更しても正しい単元が維持される
- [ ] exam8-stack-2017の問題文がすべて具体的になっている
- [ ] exam5-ecc-2015の選択肢が空でない

### Wave 3完了後
- [ ] 表組み問題が適切にレンダリングされる
- [ ] TableRendererが正しく動作する

### 最終検証
- [ ] すべての年度・単元で問題が表示される
- [ ] 「準備中」メッセージが表示される年度が減少している
- [ ] ビルドエラーがない

---

## リスク・注意点

1. **PDFからの問題抽出**: PDFファイルが不足している場合は解答HTMLから推測が必要
2. **index.ts競合**: Wave 5は必ず最後に単独実行（他タスクとの競合回避）
3. **型定義変更**: Wave 2完了前にWave 3を開始しない（型エラー防止）
