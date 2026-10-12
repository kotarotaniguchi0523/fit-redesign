# symlink が作れない環境向けの pnpm 設定（公式解）

pnpm v12 の公式設定で解決する。`node_modules` の構造に関わる設定は `.npmrc` ではなく
**`pnpm-workspace.yaml`** に書く（v12 は `.npmrc` から auth/registry しか読まない）。

```yaml
# pnpm-workspace.yaml
nodeLinker: hoisted
preferSymlinkedExecutables: false
```

公式ドキュメント（pnpm.io/settings）の記述:

- `nodeLinker: hoisted` — 「a flat node_modules **without symlinks** is created. …
  Legitimate reasons: 1. Your tooling doesn't work well with symlinks.
  2. Your project is deployed to a serverless hosting provider（AWS Lambda 等は symlink 不可）」
- `preferSymlinkedExecutables` — Default **true**（node-linker が hoisted かつ POSIX のとき）。
  「Create symlinks to executables in `node_modules/.bin` instead of **command shims**」。
  `false` にすると `.bin` がシム（通常ファイル）になる。

## 補足

- ストア（`storeDir`）は既定でホーム配下（Linux: `~/.local/share/pnpm/store`）。
  プロジェクト内に置くと、このワークスペースのような特殊 FS では失敗することがある。
  `pnpm install --store-dir <path>` で切り替えられる。
- `nodeLinker: hoisted` は既存 `node_modules` を再構成するため、壊れた `node_modules` が
  残っていると swap に失敗する。クリーンな状態でインストールすること。
- `scripts/fix-bin-shims.mjs` は、上記設定を使えない場合のフォールバック（`.bin` を
  通常ファイルとして張り直す）。設定が効いていれば不要。

## node_modules が壊れた場合の復旧

構造変更（hoisted 切り替え）の途中で失敗すると、一部パッケージが欠落することがある
（このワークスペースで実際に発生）。その場合は該当パッケージをレジストリから取り直す:

```sh
npm pack @remix-run/<name>@1.0.0
tar -xzf remix-run-<name>-1.0.0.tgz
cp -r package/. node_modules/@remix-run/<name>/
```

参考: `remix` の `dependencies` にある `@remix-run/*` を照合すると欠落を検出できる。
