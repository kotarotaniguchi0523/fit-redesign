---
name: cloudflare-workers-node-compat
description: Cloudflare Workers（workerd）で Node.js の組み込みモジュールがどこまで動くかを判定する。node:fs / node:sqlite / child_process などの対応状況、compatibility_date と compatibility_flag による有効化条件、unenv ポリフィルの挙動を知りたいときに使う。Workers 上で Node 前提のライブラリ（Remix の remix/assets や remix/middleware/static、data-table/sqlite など）を使えるか判断する場面で参照する。
---

# Cloudflare Workers の Node.js 互換判定

Workers は Node ではない。`nodejs_compat` を有効にすると、一部の `node:*` モジュールは
**workerd がネイティブ実装**し、それ以外は **unenv のポリフィル**（多くは `notImplemented`）で
置き換えられる。どちらになるかは `compatibility_date` と `compatibility_flags` で決まる。

このプロジェクトの Worker ツールチェーンは `@cloudflare/unenv-preset` を同梱しており、
**どのモジュールがいつからネイティブになるか**はそのソースに定義されている。
推測せず、必ずローカルで再導出して確認する。

## 判定手順

1. `cloudflare.config.ts` の `compatibilityDate` と `compatibilityFlags` を確認する。
2. 下のマトリクス（または `scripts/derive-matrix.mjs` の出力）で対象モジュールの
   `native since` が `compatibilityDate` 以下かを比較する。
3. ネイティブなら workerd 実装、そうでなければ unenv ポリフィル（多くは例外を投げる）。

マトリクスは導入済み `@cloudflare/unenv-preset` のバージョンに依存する。更新したら再導出する。

## マトリクス導出

```bash
node scripts/derive-matrix.mjs
```

`node_modules/@cloudflare/unenv-preset/dist/index.mjs` の `get*Overrides` を解析し、
各モジュールがネイティブになる `compatibility_date` と必須フラグを出力する。
詳細は [reference/node-compat-matrix.md](reference/node-compat-matrix.md) を参照。

## 重要ポイント

- **`node:fs` / `node:fs/promises`**: `compatibilityDate >= 2025-09-15`（または
  `enable_nodejs_fs_module`）でネイティブ。それ未満では unenv ポリフィルになり、
  `readFileSync` / `readdirSync` / `statSync` / `readFile` / `readdir` などは
  `notImplemented` を投げ、`existsSync()` は常に `false` を返す。
- **`node:sqlite`**: `compatibilityDate >= 2026-01-29` でネイティブ。
- **`node:child_process` / `node:worker_threads` / `node:perf_hooks` / `node:readline`**:
  `>= 2026-03-17` でネイティブ。
- **実行時ポリフィル（inject）** は最小限: `Buffer`, `global`, `process`, `setImmediate`,
  `clearImmediate`。`compatibilityDate` により `process` / `console` はネイティブと
  ポリフィルのハイブリッドになる。
- **ネイティブ`node:fs` でも「任意のローカルファイル」は読めない**。Workers に永続
  ファイルシステムは無く、読めるのは Worker バンドルに含めたファイル等に限られる。
  正確な意味論は Cloudflare 公式ドキュメント
  （`developers.cloudflare.com/workers/runtime-apis/nodejs/fs/`）を必ず確認する。
  このリポジトリのサンドボックスでは当該ドメインがネットワークポリシーでブロックされる
  ことがあるため、承認できない場合はツールチェーンのソースを根拠にする。

## このプロジェクトへの含意

| 使いたいもの | Node 依存 | Workers での可否 |
| --- | --- | --- |
| `remix/assets`（`createAssetServer`） | `node:fs` でソース探索・watch | 実行時は不可（開発サーバー専用）。ビルド時のみ使う |
| `remix/middleware/static` | `node:fs` | 不可。Workers Assets（`env.ASSETS`）へ委譲する |
| `remix/data-table/sqlite` | `node:sqlite` | ネイティブ `node:sqlite` はあるが永続 fs が無い。永続化は D1 を使う |
| `remix/data-table` + D1 | なし | D1 用ドライバが必要（`DatabaseDriver` 拡張点） |

## 注意

- 互換性の最終的な正は Cloudflare 公式ドキュメントと実際の workerd バージョン。
  このマトリクスは同梱ツールチェーンから機械的に導出した補助資料。
- `node:*` モジュールはプレフィックス付きで import する（`node:fs`）。プレフィックス
  無しの import はバンドラの解決規則に依存し、挙動が一定しない。
