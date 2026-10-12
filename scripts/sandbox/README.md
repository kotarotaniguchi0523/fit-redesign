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
