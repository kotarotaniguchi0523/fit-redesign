# 一問一答プレイヤー QA

## Reference and scope

- 参考画像: `/workspace/scratch/2523c1bba4ef/upload/A3455508-31BA-44A8-8789-7FBA04F60BAA.jpeg` (1536 × 1024)
- 変更対象: 小テストモード・個別計測モードのプレイヤー
- Desktop, default player: `/workspace/scratch/fit-redesign-quiz-current.jpg` (1363 × 936)
- Desktop, inline question list: `/workspace/scratch/fit-redesign-quiz-sidebar.jpg` (1363 × 936)

## Visual review

- 色は既存のネイビー系を維持。
- 上部でモード名と問題番号チップをまとめ、中央に問題文、下部にコピー・解答・タイマーの丸いアイコン操作を配置。
- 一覧を開いた状態でも、モード名と進捗を一覧と問題の両方にまたがる上段へ置き、下段でサイドバーと問題を並べる。
- 前後移動矢印はプレイヤー領域内に置き、画面端まで離れすぎないように調整。
- デスクトップの問題一覧は、問題文を覆うモーダルではなくプレイヤー横のサイドバーとして表示。5問すべてを一覧に表示し、横方向のはみ出しがないことを確認。
- 参考画像との比較は画面幅・高さが一致しないため、配置と情報量の目視確認。

## Timer and calculation review

- Timer core (`calculateElapsedDelta`, `applyElapsedDelta`, `questionElapsedMs`) は既存実装を維持。
- 小テストは問題IDごとに時間を累積し、戻った問題も前回までの経過時間へ加算する。
- 個別計測は問題IDごとに独立した challenge scope を使い、別の問題の時間と混ざらない。
- 可視状態の `performance.now()` 差分を計上し、タブ非表示・一時停止・一覧表示・問題移動時に精算してから計測を止める。
- 差分が負値、非有限値、24時間超の場合は加算しない。完了結果には問題ごとの時間を保存する。
- 元実装は [PR #127: timed quiz challenges](https://github.com/kotarotaniguchi0523/fit-redesign/pull/127)。現在の challenge core とそのテストに差分はなく、UI側では個別計測の切替や表示を追加している。

## Verification

- ブラウザ: 個別計測の再開状態、解答表示、5問の一覧、デスクトップで一覧と問題を並べる表示を確認。
- `pnpm check`, `pnpm typecheck`, `pnpm test:run` (28 files / 209 tests), `pnpm build`: pass。
- Biome は CSS descending-specificity の警告を出すが、check は成功。
- Mobile visual screenshot and browser E2E were not run in this environment.

## Result

Desktop view and timer implementation reviewed. Mobile visual verification remains pending.
