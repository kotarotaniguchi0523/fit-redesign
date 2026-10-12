# テスト移行の残り（mock 依存）

以下は `vi.fn()` / `vi.spyOn()` に依存するテスト。`remix test` では `t.mock.fn` / `t.mock.method`
へ書き換える必要がある。移行までの間ここに退避している。

- clipboard.test.ts（Clipboard API のモック）
- storageSubscription.test.ts（storage イベントのモック）
