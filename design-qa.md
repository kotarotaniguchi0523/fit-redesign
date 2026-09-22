# Design QA

- reference: `docs/images/quiz-mode-ui-proposal.png`
- target states: 問題一覧 → 小テスト開始、プレイヤー、解答表示、自己判定、問題一覧、結果画面
- target viewports: desktop and mobile
- status: blocked

## Blocker

Product Design のブラウザ確認手順に従い、ローカルプレビューを `terminal.local:4173` で起動して Cloud Browser から開こうとしたが、ブラウザ環境が `ERR_BLOCKED_BY_CLIENT` を返してページを表示できなかった。`localhost:5173` と開発サーバーのネットワークアドレスでも同じ結果だったため、スクリーンショット取得、操作確認、コンソール確認は実施できていない。

静的な代替確認として、SSRを含む本番ビルド、Biome、型チェック、全テスト、KNIPは別途実行している。ブラウザ接続が可能な環境で、同じ対象状態を再確認する必要がある。

final result: blocked
