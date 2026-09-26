---
lat:
  require-code-mention: true
---

# Request logging

リクエストログはHonoXルート越しに検証する。状態を持つテストはstorage、DOM、D1、spyをテスト単位で準備・後片付けし、Playwright全シナリオは5つすべてのブラウザー・端末プロジェクトで実行する。

## Query redaction and request correlation

構造化ログにはrequest ID・HTTP method・queryを除いたpath・最終statusを含め、query内の同期キーを含めない。これにより障害調査と秘密値の保護を両立する。

## Redirect status

末尾スラッシュのリダイレクトも、構造化ログのstatusとHTTP応答のstatusが一致することを維持する。設計は[[architecture#Request pipeline]]を参照する。

## Challenge client and player

小テストの同期、プレイヤー状態、結果表示、保存状態の復元が、画面やAPIの境界を越えて一貫することを守る。

### Client sync returns local and server results together

クライアント同期はローカル結果を失わず、サーバーに保存済みの結果も取り込んで統合する。

### Exam and single-question player scopes

試験モードと一問モードで開始位置、対象問題、履歴フィルター、ナビゲーション範囲を正しく分ける。

### Timer reset clears sampling and changes the active question

問題切り替え時にタイマーの計測状態を止め、次の問題のサンプル開始へ移る。

### Result views show mode-specific summaries and actions

小テストとタイムアタックで正しい集計、空履歴表示、再挑戦・一覧復帰の操作を示す。

### Active attempts become restorable completed history

保存中の試行を復元でき、完了時には進行中記録から履歴へ移して結果を再構成する。

### Timer locks remain owner-scoped until their heartbeat expires

同時実行ロックは所有者だけが更新でき、heartbeat期限後は別端末が取得できる。
