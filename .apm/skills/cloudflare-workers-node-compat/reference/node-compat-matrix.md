# Cloudflare Workers Node.js 互換マトリクス

`@cloudflare/unenv-preset` v2.16.2 から機械導出（`scripts/derive-matrix.mjs`）。
解釈: `compatibilityDate >= native since` なら workerd のネイティブ実装。それ未満は
unenv ポリフィルで、多くは呼び出すと `notImplemented` を投げる。

## ネイティブ化スケジュール

| native since | フラグ | ネイティブになるモジュール |
| --- | --- | --- |
| 2025-08-15 | - | `_http_agent` `_http_client` `_http_common` `_http_incoming` `_http_outgoing`（`_http_server` は server フラグ時のみ） |
| 2025-09-01 | - | `http2` |
| 2025-09-15 | `enable_nodejs_os_module` | `os` |
| 2025-09-15 | `enable_nodejs_fs_module` | `fs` `fs/promises` |
| 2025-09-15 | - | `process`（hybrid） |
| 2025-09-21 | - | `console`（hybrid） |
| 2025-10-01 | `enable_nodejs_vm_module` | `vm` |
| 2025-12-04 | - | `punycode` `cluster` `trace_events` `domain` `wasi` |
| 2026-01-29 | - | `inspector` `inspector/promises` `sqlite` `dgram` `_stream_wrap` |
| 2026-03-17 | - | `repl` `v8` `tty` `child_process` `worker_threads` `readline` `readline/promises` `perf_hooks` |
| 2026-03-17 | `enable_nodejs_v8_module` | `v8` |
| 2026-03-17 | `enable_nodejs_tty_module` | `tty` |

## このプロジェクトの設定

`cloudflare.config.ts`:

```ts
compatibilityDate: '2026-10-06',
compatibilityFlags: ['nodejs_compat'],
```

2026-10-06 は上表の全しきい値以上なので、**列挙された全モジュールがネイティブ**。

## 実行時ポリフィル（inject）

ネイティブでない部分を補うため、unenv がバンドルへ注入する最小セット:

```
Buffer, clearImmediate, global, process, setImmediate
```

（`process` はネイティブとのハイブリッド。）

## `node:fs` の挙動

- ネイティブ化条件: `compatibilityDate >= 2025-09-15` または `enable_nodejs_fs_module`。
- ネイティブでない場合の unenv 実装（`unenv/dist/runtime/node/internal/fs/*`）:
  - sync: `readFileSync` `readdirSync` `statSync` `writeFileSync` `mkdirSync` … は
    `notImplemented("fs.<name>")`、`existsSync()` は常に `false`。
  - promises: `readFile` `readdir` `stat` `open` … は `notImplemented("fs.<name>")`。
- ネイティブでも **Workers に永続ファイルシステムは無い**。読める対象は Worker
  バンドルに含めたファイル等に限られる。厳密な意味論は公式ドキュメントで確認する:
  <https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/>

## `node:sqlite` の挙動

- ネイティブ化: `compatibilityDate >= 2026-01-29`。
- ただし永続ファイルシステムが無いため、ファイル DB の永続化には使えない。
  永続化が必要な用途は D1 を使う。

## 再導出

```bash
node scripts/derive-matrix.mjs
COMPAT_DATE=2026-10-06 node scripts/derive-matrix.mjs
```

ツールチェーンを更新したら実行し、この表を更新する。
