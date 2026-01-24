# Plan: 章テストPDFの埋め込み

## ステータス: ✅ 完了 (2026-01-25)

## 概要
章テストの問題PDFを単元と年度ごとにページ内に埋め込み表示する。

## 背景・課題
- 現在PDFは外部リンク（新規タブ）形式のみ
- ユーザーはページを離れる必要がある
- PDF埋め込みでユーザー体験向上

## PDFファイル命名規則
`Exam{番号}{サフィックス}-{単元名}.pdf`
- サフィックス: なし=2013, b=2014, c=2015, d=2016, e=2017

## 実装ステップ

### Step 1: PdfViewerコンポーネント作成
```tsx
interface PdfViewerProps {
  pdfPath: string;
  title: string;
  defaultExpanded?: boolean;
}

function PdfViewer({ pdfPath, title }: PdfViewerProps) {
  return (
    <iframe
      src={pdfPath}
      className="w-full h-[600px] border rounded"
      title={title}
    />
  );
}
```

### Step 2: ExamSectionに埋め込み機能追加
- 折りたたみ可能なアコーディオン形式
- 「PDF表示」ボタンで展開/折りたたみ
- 外部リンクボタンも残す

### Step 3: pdfPath欠落データ修正
index.tsの空文字列パスを修正または「PDFなし」フラグ追加

### Step 4: エラーハンドリング
PDF不存在時のフォールバック表示

## 作成・変更するファイル

| ファイル | 操作 | 説明 |
|---------|------|------|
| src/components/PdfViewer.tsx | 新規 | PDF埋め込みコンポーネント |
| src/components/ExamSection.tsx | 変更 | PdfViewer組み込み |
| src/data/exams/index.ts | 変更 | 欠落pdfPath修正 |

## 検証方法
1. 各単元でPDF表示ボタンをクリック
2. PDFがページ内に埋め込まれることを確認
3. PDF欠落時のフォールバック確認
4. モバイルでのレスポンシブ確認

## 実装時の仕様変更

### 遅延ロード対応
当初の計画ではiframeを常時描画する想定だったが、パフォーマンス改善のため以下を追加：
- `useState`でアコーディオン展開状態を管理
- 展開時のみiframeを描画（DOM非存在でPDFロードを防止）
- `loading="lazy"`属性も追加

### 実装コード
```tsx
const [isExpanded, setIsExpanded] = useState(defaultExpanded);

<Accordion onExpandedChange={(keys) => setIsExpanded(keys.has("pdf-viewer"))}>
  {isExpanded && <iframe loading="lazy" ... />}
</Accordion>
```
