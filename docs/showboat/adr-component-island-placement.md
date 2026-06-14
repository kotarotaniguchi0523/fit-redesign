# ADR: 共有 island の配置と components→features 合成の方針

## Status

Accepted（2026-06 / 負債解消 Phase 4）

## Context

`app/components/QuestionCard.tsx`（全画面共有の SSR コンポーネント）が `app/features/` 配下の
island を直接 import している状態が「依存方向の緊張関係」として検出された。

- `QuestionCard` → `features/answer/$AnswerSelector`・`features/answer/$SelfGrade`（回答 island）
- `QuestionCard` → `features/markdown/$CopyButton`（コピー island）
- `routes/dashboard/[userId].tsx` → `features/markdown/$CopyButton`

CLAUDE.md の**依存方向の不変条件**は `types/` `server/` `lib/` → `features/` の import のみを禁止して
おり、`components/` → `features/` や `routes/` → `features/` は禁止対象ではない。とはいえ、複数機能から
使われる汎用 UI が特定 feature 配下にあるのは配置として不適切なケースがある。

## Decision

1. **`$CopyButton` を `app/components/` へ昇格する。**
   - `$CopyButton` は `text` prop を受け取りクリップボードへコピーするだけの汎用 island で、
     `questionToMarkdown` 等の markdown 機能に依存しない（依存は icons と constants のみ）。
   - `QuestionCard`（全ページ）と dashboard ルートの双方から使われる横断 UI である。
   - island 判定は honox の正規表現 `.*/\$[a-zA-Z0-9-]+\.tsx$`（**ディレクトリ非依存・`$` 接頭辞**）
     のため、`components/` へ移しても island のままハイドレーションされる。

2. **`QuestionCard` は feature island（`$AnswerSelector`/`$SelfGrade`）を合成し続けてよい。**
   - `QuestionCard` は「問題カード＝設問本文 + 回答 UI」を組み立てる横断的な合成コンポーネントで、
     回答 island を内包することがその責務そのもの。
   - これを features へ動かすと `ExamSection`・`$DailySession` という複数 feature から参照される
     共有部品が単一 feature に閉じてしまい、かえって配置が崩れる。
   - 不変条件（types/server/lib → features 禁止）には抵触しないため、合成は許容する。

## Consequences

- dashboard ルートの `features/markdown` への直接 import が解消され、汎用 UI は `components/` に集約。
- `QuestionCard` の回答 island 合成は「意図された設計」として本 ADR で正当化済み。今後 island を
  props/slot 注入へ変える必要が出た場合は別 ADR で再検討する。
