---
status: 完了
completed: 2025-01-24
---

# Plan: UI改善 - アカデミック・エレガント

## 概要
既存のコンポーネント構成を維持しながら、アカデミックでエレガントな雰囲気に洗練させる。機能を壊さず、CSSとスタイリングの改善のみで見た目を向上。

## デザイン方向性

**トーン**: **Scholarly Elegance（学術的優雅）** - 落ち着いた知性と現代的な洗練を両立

**カラーパレット**:
- プライマリ: ディープネイビー `#1e3a5f` （知性・信頼）
- アクセント: ゴールド/アンバー `#c9a227` （アカデミックな威厳）
- バックグラウンド: ウォームホワイト `#faf9f7` （紙のような温かみ）
- セカンダリ: スレートグレー `#64748b`

**タイポグラフィ**:
- 見出し: "Noto Serif JP" （学術的な格調）
- 本文: "Noto Sans JP" （読みやすさ）
- 数式・コード: "JetBrains Mono"

## 改善項目

### 1. グローバルスタイル (index.css)
```css
@import "tailwindcss";

/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap');

/* CSS Variables */
:root {
  --color-primary: #1e3a5f;
  --color-primary-light: #2d4a6f;
  --color-accent: #c9a227;
  --color-accent-light: #dbb84a;
  --color-bg: #faf9f7;
  --color-bg-card: #ffffff;
  --color-text: #1a1a1a;
  --color-text-muted: #64748b;
  --color-border: #e2e0dc;
  --font-serif: 'Noto Serif JP', serif;
  --font-sans: 'Noto Sans JP', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-text);
}

/* 微細なテクスチャ背景 */
.bg-texture {
  background-image:
    radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0);
  background-size: 24px 24px;
}
```

### 2. Header.tsx - 洗練されたヘッダー
**変更点**:
- グラデーション背景（ネイビー→ダークネイビー）
- ゴールドのアクセントライン
- セリフ体の大学名

```tsx
<Navbar maxWidth="full" className="bg-gradient-to-r from-[#1e3a5f] to-[#152a45] text-white border-b-2 border-[#c9a227]">
  <NavbarBrand className="gap-4">
    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
      <span className="text-xl">🎓</span>
    </div>
    <div className="flex flex-col">
      <span className="text-lg font-bold tracking-wide" style={{ fontFamily: 'var(--font-serif)' }}>
        基本情報技術 I
      </span>
      <span className="text-xs text-white/70 tracking-widest">MEIJI UNIVERSITY</span>
    </div>
  </NavbarBrand>
</Navbar>
```

### 3. App.tsx - 背景テクスチャ
```tsx
<div className="min-h-screen bg-[#faf9f7] bg-texture">
```

### 4. UnitTabs.tsx - エレガントなタブ
**変更点**:
- アンダーラインからピル型に変更
- ホバー時のスムーズなトランジション
- 選択時のゴールドアクセント

```tsx
<Tabs
  aria-label="単元"
  variant="light"
  classNames={{
    tabList: "gap-2 p-1 bg-white rounded-xl shadow-sm border border-gray-200",
    tab: "px-4 py-2 rounded-lg data-[hover=true]:bg-gray-100 transition-all",
    tabContent: "text-gray-600 group-data-[selected=true]:text-[#1e3a5f] font-medium",
    cursor: "bg-[#1e3a5f] rounded-lg shadow-md",
  }}
>
```

### 5. QuestionCard.tsx - 問題カードの洗練
**変更点**:
- 左ボーダーにアクセントカラー
- 問題番号のバッジスタイル
- より洗練された解答セクション

```tsx
<Card className="mb-4 border-l-4 border-l-[#1e3a5f] shadow-sm hover:shadow-md transition-shadow">
  <CardBody className="p-5">
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-sm font-bold">
        {question.number}
      </span>
      <div className="flex-1">
        <p className="text-gray-800 leading-relaxed">{question.text}</p>
      </div>
    </div>

    {/* 解答アコーディオン */}
    <Accordion variant="light" className="mt-4">
      <AccordionItem
        title={
          <span className="text-sm font-medium text-[#1e3a5f]">
            解答を表示
          </span>
        }
      >
        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 font-bold">A.</span>
            <span className="font-medium text-emerald-900">{question.answer}</span>
          </div>
        </div>
      </AccordionItem>
    </Accordion>
  </CardBody>
</Card>
```

### 6. SlideSection.tsx - スライドカードの改善
**変更点**:
- アイコンとタイトルの配置改善
- ホバー効果の追加

```tsx
<Card className="mb-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border border-blue-100">
  <CardBody className="p-5">
    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#1e3a5f]">
      <span className="w-8 h-8 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
        📖
      </span>
      講義スライド
    </h3>
    ...
  </CardBody>
</Card>
```

### 7. ExamSection.tsx - 小テストヘッダーの改善
**変更点**:
- ヘッダーのグラデーション
- 年度セレクターのスタイル改善

```tsx
<CardHeader className="flex flex-col gap-4 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
  <div className="flex justify-between items-center w-full">
    <h3 className="text-lg font-semibold flex items-center gap-2 text-[#1e3a5f]">
      <span className="w-8 h-8 rounded-lg bg-[#c9a227]/20 flex items-center justify-center">
        📝
      </span>
      {title}
    </h3>
    ...
  </div>
</CardHeader>
```

### 8. YearSelector.tsx - 年度セレクターの改善
**変更点**:
- ピル型のラジオボタン
- 選択時のゴールドアクセント

```tsx
<RadioGroup
  orientation="horizontal"
  classNames={{
    wrapper: "gap-2",
  }}
>
  {YEARS.map((year) => (
    <Radio
      key={year}
      value={year}
      classNames={{
        base: "border-2 border-transparent data-[selected=true]:border-[#c9a227] rounded-full px-4 py-1 bg-white shadow-sm",
        label: "text-sm font-medium",
      }}
    >
      {year}
    </Radio>
  ))}
</RadioGroup>
```

## 作成・変更するファイル

| ファイル | 操作 | 変更内容 |
|---------|------|---------|
| src/index.css | 変更 | CSS変数、フォント、テクスチャ追加 |
| index.html | 変更 | タイトル変更 |
| src/App.tsx | 変更 | 背景クラス追加 |
| src/components/Header.tsx | 変更 | グラデーション、アクセントライン |
| src/components/UnitTabs.tsx | 変更 | タブスタイル改善 |
| src/components/QuestionCard.tsx | 変更 | カード・解答スタイル改善 |
| src/components/SlideSection.tsx | 変更 | カードスタイル改善 |
| src/components/ExamSection.tsx | 変更 | ヘッダースタイル改善 |
| src/components/YearSelector.tsx | 変更 | ラジオボタンスタイル改善 |

## 検証方法

1. `pnpm dev` で開発サーバー起動
2. 各タブ・年度を確認
3. 解答トグルの動作確認
4. 図コンポーネントの表示確認
5. `pnpm typecheck` でエラーなし

## リスク・注意点

- HeroUIのclassNamesプロパティで上書きするため、一部スタイルが効かない可能性
- フォント読み込みによる初期表示のちらつき（FOUT）
- Tailwindのカスタムカラーとの競合に注意

## 優先順位

1. **高**: index.css（グローバルスタイル）
2. **高**: Header.tsx（第一印象）
3. **中**: QuestionCard.tsx（最も見る部分）
4. **中**: UnitTabs.tsx, ExamSection.tsx
5. **低**: その他の微調整
