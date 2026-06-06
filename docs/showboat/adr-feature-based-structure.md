# Astro 向け Feature ベース構成への移行方針

*2026-06-06T14:37:34Z by Showboat 0.6.1*
<!-- showboat-id: 6a951f8f-30b4-4ef9-af16-9e15b01ca14e -->

## 概要

本 ADR は、`src/` のコード構成を **技術タイプ別（Package by Type）** から **機能別（Package by Feature）** へ移行する方針を記録する。Astro の制約（`src/pages` のみ予約）を前提に、横断機能は `src/features/<機能>/` へ集約し、特定ルート専用のものだけ `src/pages/<route>/` 配下に `_` プレフィックスで co-location する。

実装はまだ行わない。本 ADR は「採用する構成・配置ルール・却下した代替案」を確定させ、後続の段階的移行（timer → 全機能）の判断基準を固定することが目的。

## 背景・課題

現状は `components/ scripts/ server/ utils/ types/ data/ lib/` という **技術タイプ別レイヤー構成**。関心の分離はできているが、1つの機能を構成するファイルが複数ディレクトリに散り、**凝集度（cohesion）が低い**。

代表例が timer 機能で、6 ディレクトリにまたがる（次の exec で実証）。「timer を直す」たびに 6 箇所を開く必要があり、変更の影響範囲が掴みづらい。answer / srs / dashboard も同様。

```bash
echo "=== timer 機能を構成するファイル（git 追跡分）の散在 ==="
git ls-files 'src/*' | grep -iE 'timer|timeFormat' | sort
echo
echo "=== 散在しているディレクトリ数 ==="
git ls-files 'src/*' | grep -iE 'timer|timeFormat' | xargs -n1 dirname | sort -u

```

```output
=== timer 機能を構成するファイル（git 追跡分）の散在 ===
src/pages/api/timer/clear.ts
src/pages/api/timer/load.ts
src/pages/api/timer/sync.ts
src/scripts/question-timer.test.ts
src/scripts/question-timer.ts
src/server/timerRepository.ts
src/types/timer.ts
src/utils/timeFormat.test.ts
src/utils/timeFormat.ts
src/utils/timerStorage.test.ts
src/utils/timerStorage.ts
src/utils/timerSync.ts

=== 散在しているディレクトリ数 ===
src/pages/api/timer
src/scripts
src/server
src/types
src/utils
```

## ADR-1: コード構成アーキテクチャの選定

### 決定: Package by Feature（`src/features/`）＋ ルート専用は `_` co-location

横断的に使われるドメインコードは `src/features/<機能>/` に集約する。Astro が予約するのは `src/pages` だけで、それ以外（components/layouts/scripts/utils 等）は「慣習であって必須ではない」ため、`src/features/` の新設は Astro 公式の制約に反しない。

### 検討した選択肢

| 案 | 内容 | 判定 | 理由 |
|---|---|---|---|
| 現状維持（Package by Type） | 技術タイプ別レイヤー | ❌ | 機能散在（timer 5 ディレクトリ）が解消されない |
| `_` co-location 単独 | ルート配下に全部同居 | ❌ | timer/answer/srs は複数ルート横断で使われ、単一ルートに置けない |
| Feature-Sliced Design (FSD) | app/pages/widgets/features/entities/shared の厳密階層 | ❌ | 階層規約が重く、この規模で layers フォルダが肥大化。「ファイルを増やさない」制約に反する |
| Clean / Hexagonal | port/adapter・同心円 | ❌ | プロジェクト初期に明示的に却下済み（ファイル爆発） |
| **Package by Feature ＋ `_` co-location** | 横断=features/・ルート専用=`_`同居 | ✅ **採用** | ファイル数は不変（再配置のみ）。凝集度が上がり、Astro 公式機構だけで実現できる |

## ADR-2: 配置ルール（どこに置くか）

### 決定: 「単一ルート専用 → co-location / それ以外 → features」を唯一の判断基準とする

| 区分 | 置き場所 | 根拠 |
|---|---|---|
| **特定ルートでしか使わないもの** | そのルート配下に `_` プレフィックスで co-location（例: `src/pages/dashboard/_components/`） | Astro 公式: `src/pages/**/_*` はルーティング除外。ルートと部品が同居でき、発見が容易 |
| **複数ルート横断 / ドメインロジック** | `src/features/<機能>/`（client script・repository・型・集計を同居） | 凝集度を上げる主目的。pages 以外は自由配置 |
| **真に汎用なヘルパー** | `src/shared/`（logger / zod / overline など） | 機能に属さないものだけ。「とりあえず utils」を禁止 |
| **API ルートの薄い基盤** | `src/server/http.ts` に残す | 全 API 横断の `route()`/`json()` は機能に属さない |
| **複数 feature が共有する D1 / KV リポジトリ** | `src/server/<domain>Repository.ts` | feature→feature 依存（ADR-4 で禁止）を避けつつ横断データアクセスを集約。thin infra（`http.ts`）とは別ファイルに分離。例: `users` テーブルの `userRepository` |

### Astro 固定で動かせないもの（制約）

- `src/pages/` … ファイルベースルーティング。ルートは薄く保ち `features` を import するだけ。
- `src/content/` + `src/content.config.ts` … Content Collections 専用・src 直下固定。exams の JSON 本体と設定はここに残し、`features/exams/` には loader/assemble/schema（ロジック）だけ置く。
- `src/layouts/` `src/components/` … 全画面共有の Layout / Header 等はここに残す。機能専用 UI は features か co-location へ移す。

### client script の扱い（Astro 固有）

クライアント用 TS（Web Component 等）は `features/<機能>/` に置き、`.astro` の `<script>` から相対 import すれば Astro が通常通りバンドルする。`src/scripts/` という技術タイプ別の置き場は解消する。

## ADR-3: 移行方針

### 決定: 2 機能で先行検証してから全面移行

1. **先行（timer → answer）**: 最も散っている timer を `features/timer/` 化し、`<script>` の import 経路と co-location の挙動を 1 機能で確認。続けて answer。
2. **全面**: srs / dashboard / exams / figures を順次移行。
3. 各ステップで以下を不変条件として検証する。
   - **API レスポンスはバイト不変**（既存挙動を壊さない）。
   - `pnpm typecheck:full` 0 エラー / `pnpm test` 全通過 / `pnpm build` 成功。
   - ファイル移動は `git mv` で**履歴を保持**する。

### 影響範囲

- import パスの一斉書き換えが発生する
  - 移動先に追従して全参照を更新する
  - 残存参照は `pnpm typecheck:full` で検出する
- `src/scripts/` `src/lib/` `src/utils/`（汎用以外）は段階的に空になる
  - 空になった時点で削除する

## ADR-4: 依存方向の不変条件（feature 展開の前提）

### 決定: `features/` への逆 import を禁止する一方向ルール

- `features/<x>` → `types/` / `server/` / `utils/` の import は許可。
- `types/` / `server/` / `utils/` → `features/` の import は**禁止**。
- 共有バレル（`types/index.ts` 等）に機能固有の型を**再エクスポートしない**。
- 機能固有の型は `features/<x>/types.ts` から各 feature が直接 import する。

### 背景

timer 移行時、`types/index.ts` が `features/timer/types` を再エクスポートする逆依存が一度発生した。共有型バレルが各 feature を逆参照すると、全機能を移行した後にバレルが全 slice を指すハブとなり、Feature 分割の意図（依存の局所化）が崩れる。timer のバレル再エクスポートは消費者ゼロ（dead）だったため削除済み。answer 以降はこのルールを前提に展開する。

