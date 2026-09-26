---
name: pdf-to-questions
description: 情報処理技術者試験のPDFを確認し、リポジトリの検証済み試験JSONに追加・修正する。
---

# PDFから試験問題データを作る

問題PDFと解答資料から内容を確認し、`app/data/exams-json/`のJSONを更新する。抽出結果だけで正解を推測しない。

## 手順

1. 対象年度・試験番号と対応する問題PDF・解答資料を確認する。
2. 初回だけ依存関係を用意し、PDFを一時ディレクトリへ抽出する。

   ```bash
   uv sync --project .agents/skills/pdf-to-questions
   uv run --project .agents/skills/pdf-to-questions python .agents/skills/pdf-to-questions/scripts/extract_pdf.py <pdf-path> --output /tmp/fit-redesign-extracted
   ```

3. `text.md`、`metadata.json`、抽出された全図を確認し、重要な箇所は元PDFと照合する。正解と解説は解答資料や根拠から確認する。
4. `app/data/exams/schema.ts`と近い年度のJSONを参照して、`app/data/exams-json/exam{番号}-{年度}.json`を編集する。JSONの項目名、図の`type`、値の形を推測で作らない。
5. 問題ID・問題番号・選択肢・正解・図表・解説を原資料と照合する。読めない箇所は推測で埋めず、不確実な点を報告する。
6. `pnpm exec vitest run app/data/exams/exams.integrity.test.ts`を実行し、データ検証を確認する。コードも変更した場合は、変更に対応する検査も実行する。

## データ上の注意

- 問題データはTypeScript配列ではなく、既存形式のJSONとして保存する。
- 試験メタデータを追加・変更する必要がある場合は`app/data/exams-json/exams-meta.json`も確認する。
- 図表は既存の`figureData`形式に合わせる。スキーマや表示コンポーネントの型をこのスキル内に複製しない。
- 生成物や一時ファイルをリポジトリへ残さない。
