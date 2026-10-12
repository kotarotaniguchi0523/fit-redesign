# サンドボックス（virtiofs / symlink 禁止）向けツール

このワークスペースは virtiofs で **symlink が作れない**。pnpm は `node_modules/.bin` に
シンボリックリンクを張るため、導入の最後だけが `EPERM (os error 1)` で失敗する
（パッケージ本体は導入済み）。

## 対応

1. 通常のインストール
   ```sh
   pnpm install
   node scripts/fix-bin-shims.mjs   # .bin をシム（通常ファイル）として張り直す
   ```
2. `cf` のように自分で `pnpm install` を呼ぶツールを使う場合
   ```sh
   export PATH="$PWD/scripts/sandbox:$PWD/node_modules/.bin:$PATH"
   cf dev
   ```
   `scripts/sandbox/pnpm` は hoisted で導入し、`.bin` の失敗を無視してシムを張り直す。

## なぜ依存を変えないのか

失敗しているのは「bin のリンク」だけで、依存パッケージ自体は問題なく動く。
pnpm に bin リンクを無効化する設定は無く（`bin-links` は npm 専用）、
依存を差し替えても解決しない。
