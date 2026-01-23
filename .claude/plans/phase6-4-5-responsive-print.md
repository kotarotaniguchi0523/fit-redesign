---
status: 廃止
reason: 優先度低のため一旦廃止。必要に応じて再計画
---

# Plan: Phase 6-4/6-5 レスポンシブデザイン & 印刷用CSS

## 概要
モバイル・タブレット・デスクトップ対応のレスポンシブデザインと、印刷最適化CSSを実装する。

## 背景・課題
- タブUIは横並び固定でモバイルで操作しにくい
- 図コンポーネント（SVG）のviewBoxが固定サイズ
- 印刷時にナビゲーションが不要
- 解答のトグル状態を印刷時にどう扱うか未定義

---

## Phase 6-4: レスポンシブデザイン対応

### ブレークポイント
- モバイル: 〜640px
- タブレット: 641〜1024px
- デスクトップ: 1025px〜

### 実装ステップ

#### Step 1: useMediaQueryフック作成
```tsx
// src/hooks/useMediaQuery.ts
export function useMediaQuery(query: string): boolean
```

#### Step 2: タブコンポーネント修正 (UnitTabs.tsx)
- モバイル: HeroUI Selectに切り替え
- タブレット: コンパクトタブ（短縮名）
- デスクトップ: 現状維持

#### Step 3: 図コンポーネントのviewBox調整
各図にresponsiveプロパティ追加:
```tsx
responsive = true → width: "100%", preserveAspectRatio: "xMidYMid meet"
```

#### Step 4: YearSelectorのモバイル対応
- モバイル: 縦並び（vertical）
- デスクトップ: 横並び（horizontal）

---

## Phase 6-5: 印刷用CSS実装

### 実装ステップ

#### Step 1: index.cssに印刷用CSS追加
```css
@media print {
  @page { size: A4; margin: 15mm; }
  .no-print, button, nav { display: none !important; }
  .question-card { break-inside: avoid; }
  svg { max-width: 100% !important; }
}
```

#### Step 2: Header修正
- 画面用: HeroUI Navbar（print:hidden）
- 印刷用: シンプルなヘッダー（hidden print:block）

#### Step 3: PrintOptionsコンポーネント作成
- 「印刷時に解答を表示」チェックボックス
- 印刷ボタン

#### Step 4: QuestionCard印刷対応
- showAnswerOnPrintプロパティ追加
- 印刷用解答セクション（hidden print:block）

---

## 作成・変更するファイル
| ファイル | 操作 | 説明 |
|---------|------|------|
| src/hooks/useMediaQuery.ts | 新規作成 | メディアクエリフック |
| src/components/PrintOptions.tsx | 新規作成 | 印刷設定UI |
| src/index.css | 変更 | 印刷用CSS追加 |
| src/components/UnitTabs.tsx | 変更 | モバイル対応 |
| src/components/Header.tsx | 変更 | 印刷用ヘッダー |
| src/components/QuestionCard.tsx | 変更 | 印刷用解答表示 |
| src/components/ExamSection.tsx | 変更 | 印刷オプション統合 |
| src/components/YearSelector.tsx | 変更 | モバイル縦並び |
| src/components/figures/*.tsx | 変更 | responsive対応 |

## 検証方法

### Phase 6-4 (レスポンシブ)
- Chrome DevTools: 375px, 768px, 1280px
- タブ表示の切り替え確認
- 図の縮小確認

### Phase 6-5 (印刷)
- 印刷プレビューで確認
- ナビ非表示、ページ分割制御
- 解答表示オプション動作確認

## 依存関係
- Phase 6-4完了後にPhase 6-5を実装
- Task #3（レスポンシブ）→ Task #4（印刷CSS）
