# ADR: 回答記録・成長ダッシュボード・GEO最適化

*2026-03-09T03:30:51Z by Showboat 0.6.1*
<!-- showboat-id: b9c108e0-89f6-4982-8e44-55a99df14a11 -->

## 概要

本ドキュメントは直近3コミット（74bfb1b, 5e2706d, 93e67aa）で実装した以下の機能について、設計判断と動作検証を記録するADR（Architecture Decision Record）です。

1. **回答選択・正誤記録機能** — 選択肢クリック→正誤フィードバック→D1永続化
2. **成長ダッシュボード** — Chart.jsによる月ごと推移・単元別正答率の可視化（SSR）
3. **GEO/AEO/LLMO最適化** — AI検索エンジン向けサイト構造改善

## ADR-1: 回答記録のデータストア選定

### 決定: D1を唯一の信頼源、Upstash Redisをキャッシュに使用

### 検討した選択肢
- **localStorage のみ**: ブラウザ操作で消失するリスク。ユーザーが明確に拒否。
- **D1 のみ**: 信頼性は高いが、ページ読み込みごとにD1クエリが発生しレイテンシ増大。
- **D1 + Redis（採用）**: D1に永続化、Redisで回答済み状態をキャッシュ。Redis障害時はD1にフォールバック。

### 理由
- ユーザーの「localStorageを使わない」という明確な要望
- Upstash Redis は Cloudflare Workers と HTTP ベースで通信（TCP不要）
- 無料枠（500K commands/月）で十分な規模

## 検証: D1 answers テーブルの存在確認

```bash
npx wrangler d1 execute fit-timer-db --remote --command="SELECT name, sql FROM sqlite_master WHERE type='table' AND name='answers';" 2>&1 | grep -A5 'results'
```

```output
    "results": [
      {
        "name": "answers",
        "sql": "CREATE TABLE answers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, question_id TEXT NOT NULL, selected_label TEXT NOT NULL, is_correct INTEGER NOT NULL, duration REAL, timestamp INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), FOREIGN KEY (user_id) REFERENCES users(id))"
      }
    ],
```

## ADR-2: 回答UIの実装方式

### 決定: `<answer-selector>` Web Component（確認ボタン式）

### 検討した選択肢
- **React/Preact island**: Astro のアイランドアーキテクチャでインタラクティブ化。依存追加が重い。
- **vanilla JS イベント委譲**: copy-button.ts のパターン。状態管理が複雑になる。
- **Web Component（採用）**: question-timer.ts の既存パターンに統一。CustomElements でカプセル化。

### UIフロー
1. 選択肢クリック → 青ハイライト + 「回答する」ボタン出現
2. 「回答する」クリック → 正解は緑、不正解は赤で視覚フィードバック
3. 解答セクション（`<details>`）が自動展開
4. D1に即時保存（fire-and-forget）
5. 「もう一度解く」ボタンで再挑戦可能（履歴として蓄積）

## 検証: 回答API動作確認

```bash
curl -s -X POST https://fit-redesign.pages.dev/api/answer/submit -H 'Content-Type: application/json' -d '{"userId":"showboat-test","questionId":"exam6-2013-q2","selectedLabel":"エ","isCorrect":true,"timestamp":1741484400000}'
```

```output
{"ok":true,"answerId":5}```
```

```bash
curl -s 'https://fit-redesign.pages.dev/api/answer/status?userId=showboat-test'
```

```output
{"statuses":{"exam6-2013-q2":{"label":"エ","isCorrect":true}}}```
```

## 検証: バリデーションエラー処理

```bash
curl -s -X POST https://fit-redesign.pages.dev/api/answer/submit -H 'Content-Type: application/json' -d '{"userId":"","questionId":"invalid","selectedLabel":"ア","isCorrect":true,"timestamp":123}' | python3 -m json.tool
```

```output
{
    "error": "Invalid request",
    "details": [
        {
            "origin": "string",
            "code": "too_small",
            "minimum": 1,
            "inclusive": true,
            "path": [
                "userId"
            ],
            "message": "Invalid input"
        },
        {
            "origin": "string",
            "code": "invalid_format",
            "format": "regex",
            "pattern": "/^exam[1-9]-\\d{4}-q\\d+$/",
            "path": [
                "questionId"
            ],
            "message": "questionId \u306f exam{1-9}-{year}-q{n} \u5f62\u5f0f\u3067\u3042\u308b\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059"
        }
    ]
}
```

## ADR-3: ダッシュボードのレンダリング方式

### 決定: Astro SSR + Chart.js クライアント描画

### 検討した選択肢
- **SSG + クライアントフェッチ**: ビルド時に静的HTML生成し、クライアントでAPIからデータ取得。初期表示が空になる。
- **SSR（採用）**: ユーザーIDがURLに含まれるため動的レンダリングが必須。D1からサーバーサイドで集計→HTMLに埋め込み→Chart.jsでクライアント描画。
- **全サーバーサイド（SVGチャート等）**: Chart.jsのインタラクティブ性が失われる。

### チャートライブラリ選定: Chart.js
- tree-shakeで必要モジュールのみバンドル（~14KB gzip）
- 折れ線＋ドーナツの両方をサポート
- CSPの問題なし（npmバンドル）
- データは `<script type="application/json">` でHTMLに埋め込み

## 検証: ダッシュボードSSRレンダリング

```bash
curl -s 'https://fit-redesign.pages.dev/dashboard/showboat-test/' | grep -oP '"totalAnswered":\d+|"overallAccuracy":\d+|"totalAttempts":\d+|"trend":"[^"]+"'
```

```output
"totalAnswered":1
"totalAttempts":1
"overallAccuracy":100
"trend":"stable"
"trend":"stable"
```

## 検証: データ0件時の空状態表示

```bash
curl -s 'https://fit-redesign.pages.dev/dashboard/nonexistent-user/' | grep -o '問題を解いていません'
```

```output
問題を解いていません
```

## ADR-4: GEO/AEO/LLMO最適化の実装方針

### 決定: Cloudflare Pages 上でAstro SSGの機能を活用

### 実装した施策
| 施策 | 対象 | 根拠 |
|------|------|------|
| robots.txt | GPTBot, ClaudeBot, PerplexityBot 許可 | AIボットのクロールを明示的に許可 |
| llms.txt | 全単元・全URL一覧 | AI向けサイトマップ標準（Cloudflare公式も採用） |
| llms-full.txt | 全問題+解答プレーンテキスト | LLMが直接学習可能な一次情報 |
| /api/markdown/ | Markdownエンドポイント | RAGシステムがパースしやすい形式 |
| JSON-LD | WebSite, Course, Quiz, LearningResource | 構造化データでAIにセマンティクスを伝達 |
| canonical/OG/Twitter | 全ページ | 基本的なSEO+ソーシャルシェア対応 |
| sitemap.xml | @astrojs/sitemap | 検索エンジン向け自動生成 |

### Workers ではなく Pages を選んだ理由
Astro の SSR エンドポイント（`export const prerender = false`）が Cloudflare Pages Functions として自動デプロイされるため、Workers を別途構築する必要がない。

## 検証: GEO施策の動作確認

```bash
cat public/robots.txt | head -8
```

```output
# AI Search Engine Bots - Allowed
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
```

```bash
cat public/llms.txt | head -12
```

```output
# 基本情報技術 I - 明治大学 演習問題サイト

> 明治大学の「基本情報技術 I」講義の演習問題サイト。2013〜2017年度の小テスト問題を単元別に整理し、選択肢の正誤記録と学習ダッシュボードを提供する。

## サイト構造

- トップページ: https://fit-redesign.pages.dev/
- 使い方ガイド: https://fit-redesign.pages.dev/guide/

## 単元一覧（演習問題ページ）

### 単元1: 基数変換
```

## 検証: JSON-LD 構造化データ

```bash
grep -o 'application/ld+json[^<]*' dist/index.html | head -1 && echo '' && cat dist/index.html | grep -oP '(?<=application/ld\+json">).*?(?=</script>)' | python3 -m json.tool | head -20
```

```output
application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"基本情報技術 I - 明治大学","url":"https://fit-redesign.pages.dev/","description":"明治大学の基本情報技術 I 講義の演習問題サイト。2013〜2017年度の9単元・全問題を掲載。","inLanguage":"ja","publisher":{"@type":"EducationalOrganization","name":"明治大学"}},{"@type":"Course","name":"基本情報技術 I","description":"基数変換、負数表現、浮動小数点、論理演算、集合と確率、オートマトン、符号理論、データ構造、ソート・探索の9単元を学習する情報技術の基礎講義。","provider":{"@type":"EducationalOrganization","name":"明治大学"},"educationalLevel":"大学学部","inLanguage":"ja","numberOfCredits":2,"hasCourseInstance":[{"@type":"CourseInstance","name":"基本情報技術 I (2013年度)","courseMode":"onsite"},{"@type":"CourseInstance","name":"基本情報技術 I (2014年度)","courseMode":"onsite"},{"@type":"CourseInstance","name":"基本情報技術 I (2015年度)","courseMode":"onsite"},{"@type":"CourseInstance","name":"基本情報技術 I (2016年度)","courseMode":"onsite"},{"@type":"CourseInstance","name":"基本情報技術 I (2017年度)","courseMode":"onsite"}]}]}

{
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "WebSite",
            "name": "\u57fa\u672c\u60c5\u5831\u6280\u8853 I - \u660e\u6cbb\u5927\u5b66",
            "url": "https://fit-redesign.pages.dev/",
            "description": "\u660e\u6cbb\u5927\u5b66\u306e\u57fa\u672c\u60c5\u5831\u6280\u8853 I \u8b1b\u7fa9\u306e\u6f14\u7fd2\u554f\u984c\u30b5\u30a4\u30c8\u30022013\u301c2017\u5e74\u5ea6\u306e9\u5358\u5143\u30fb\u5168\u554f\u984c\u3092\u63b2\u8f09\u3002",
            "inLanguage": "ja",
            "publisher": {
                "@type": "EducationalOrganization",
                "name": "\u660e\u6cbb\u5927\u5b66"
            }
        },
        {
            "@type": "Course",
            "name": "\u57fa\u672c\u60c5\u5831\u6280\u8853 I",
            "description": "\u57fa\u6570\u5909\u63db\u3001\u8ca0\u6570\u8868\u73fe\u3001\u6d6e\u52d5\u5c0f\u6570\u70b9\u3001\u8ad6\u7406\u6f14\u7b97\u3001\u96c6\u5408\u3068\u78ba\u7387\u3001\u30aa\u30fc\u30c8\u30de\u30c8\u30f3\u3001\u7b26\u53f7\u7406\u8ad6\u3001\u30c7\u30fc\u30bf\u69cb\u9020\u3001\u30bd\u30fc\u30c8\u30fb\u63a2\u7d22\u306e9\u5358\u5143\u3092\u5b66\u7fd2\u3059\u308b\u60c5\u5831\u6280\u8853\u306e\u57fa\u790e\u8b1b\u7fa9\u3002",
            "provider": {
                "@type": "EducationalOrganization",
```

## 検証: ビルド・型チェック

```bash
pnpm typecheck:full 2>&1 | tail -3
```

```output
- 0 warnings
- 0 hints

```

```bash
pnpm build 2>&1 | tail -3
```

```output
12:34:14 [@astrojs/sitemap] `sitemap-index.xml` created at `dist`
12:34:14 [build] Server built in 5.53s
12:34:14 [build] Complete!
```

## 関連コミット

| コミット | 内容 |
|---------|------|
| `74bfb1b` | feat: 回答選択・正誤記録機能と成長ダッシュボードを追加 |
| `5e2706d` | feat: GEO/AEO/LLMO最適化 - AI検索エンジン向けサイト構造改善 |
| `93e67aa` | docs: CLAUDE.md をアーキテクチャ・コマンド・デプロイ手順で全面改訂 |

## 今後の検討事項

- Upstash Redis シークレット設定後のキャッシュ有効化検証
- ダッシュボードのプライバシー設定（公開/非公開の切り替え）
- 統合試験の重複カウント排除（1つの exam が複数 unit に属する場合）
- Cloudflare Markdown for Agents 機能の有効化（ダッシュボードから設定）
