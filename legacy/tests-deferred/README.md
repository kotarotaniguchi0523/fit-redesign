# テスト移行の残り（vi モック依存）

`vi.fn()` / `vi.spyOn()` / `expect(...).toHaveBeenCalled*` に依存するテスト。
`remix test` の `mock.fn` / `mock.method` へ書き換える必要がある。

- challengeStorage.test.ts（localStorage の setItem をモックして容量超過を再現）
- progressPersistence.test.ts（同上）
