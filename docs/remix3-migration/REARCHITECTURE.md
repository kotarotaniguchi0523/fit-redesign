# Remix 3 リアーキテクチャ方針

現在の実装は HonoX からの移植であり、次の問題を抱えている。この文書は再設計の判断基準と
作業計画（TODO）を定める。`TODO.md` と合わせて更新する。

## 1. 現状の問題

| 問題 | 具体 |
| --- | --- |
| 関心の混在 | ページ/コントローラー/島/ドメインが同じ階層に散在。ルートが UI とデータを同時に持つ |
| クライアント状態の肥大 | `ExamPlayer` がタイマー・判定・永続化・同期・URL 更新をすべて抱える |
| 分割の不統一 | `ui/` と `player/ui/` と `actions/` に表示コンポーネントが分散 |
| グローバル CSS 依存 | 旧 `style.css`（Tailwind 展開）のクラス名に依存。`css()` 併置になっていない |
| 独自 UI | ドロワ・タブ・トグル・アニメーションを自作。`@remix-run/ui` のプリミティブ未使用 |
| ナビゲーション設計なし | すべてフルロード。Frame による領域ごとの再読込を使っておらず、JS 無効時の導線が弱い |

## 2. 基本原則

### 2.1 責務分離（凝集を優先、必要なら分散）

```
app/
  routes.ts            # URL とメソッドの契約のみ
  router.ts            # ミドルウェア連結と context 型
  worker.ts            # Workers エントリ
  actions/             # ルートコントローラー（薄い: データ取得 + render だけ）
  pages/               # ページ組成（サーバー描画。Document を含む）
  features/<domain>/   # ドメイン単位で閉じる
    model.ts           # 純関数（副作用なし）
    server.ts          # そのドメインのサーバー処理（あれば）
    ui/                # そのドメインの表示コンポーネント（他ドメインから参照しない）
  ui/                  # 複数ドメインで共有する表示プリミティブだけ
  lib/                 # フレームワーク非依存ヘルパー
```

- ルートは「URL・検証・データ取得・描画」の順に並べ、条件分岐以外のロジックを持たない。
- ドメイン規則は `model.ts` の純関数に置き、テストはここに対して書く。
- 表示はそのドメインの `ui/` に閉じる。複数ドメインで使うものだけ `app/ui/` へ昇格する。

### 2.2 クライアント状態は最小の島へ

- 状態を持つのは `clientEntry` の **1 コンポーネントだけ**。子は props を受けるだけの無状態。
- 状態は UI 都合（開閉・入力・タイマー表示）に限定し、ドメイン状態は純モデルの値として持つ。
- 永続化・同期は島から直接呼ばず、`features/<domain>/storage.ts` / `api.ts` を経由する。
- サーバーへ渡す props は serializable に限る（関数・クラスを持ち込まない）。

### 2.3 Request を先に、JS は後から（progressive enhancement）

- まず `<a href>` と `<form action method>` で完結する導線を描く。
- JS はその上に重ねる（enhance）。JS 無効でも問題閲覧・採点前の確認ができること。

## 3. SPA と Frame の使い分け（本件の結論）

`remix/spa` は「全ルートをブラウザで動かす場合」のもの。本件はコンテンツ配信が主体で、
SSR した HTML を配信する方が初期表示・SEO・JS 無効耐性のいずれでも有利。**SPA は採用しない。**

代わりに **`<Frame>` を「ルート所有の領域」に使う**。採用条件（Remix ガイド準拠）:

- その領域が周囲のページより後に到着してよい
- 変更後にその領域だけを再読込したい
- 複数ページで同じ領域を使う
- データとエラーが独立した Request に属する

| ルート/領域 | 採用 | 理由 |
| --- | --- | --- |
| `/:unit/:year/exam/:exam/question/:question`（問題本体） | **Frame** | 1 問 = 1 リソース。JS 無しで前後移動でき、判定後もその領域だけ更新できる |
| `/:unit/:year`（小テスト一覧） | Frame | 年度タブ切替で一覧だけ差し替え |
| `/records`（進捗・小テスト履歴） | Frame にしない | localStorage 由来。サーバー Request が無く、島の clientEntry が所有する |
| `/`（単元×年度表） | なし | 静的な一覧。比較とリンクのみ |
| `/markdown/*`, `/llms*` | なし | 非 HTML 応答 |

実装メモ:
- Frame ソースは領域だけを返す（`Document` を含めない）。ページ用ルートと領域用ルートを分ける
  （例: ページ `.../question/:question`、領域 `.../question/:question/region`）か、
  `context.render` の frame 判定で `Document` を出し分ける。
- 島は Frame の外側（プレイヤー chrome）に置き、問題領域の再読込に影響されないようにする。

## 4. CSS は `mix` に併置する

- **グローバルに残すのは**: デザイントークン（`--color-*` / `--font-*`）、フォント読込、
  `body`/`html` の基本、リセット相当、`.sr-only` のみ（`public/style.css` を縮小）。
- それ以外は各コンポーネントで `css({...})` を定義し `mix={...}` で付ける。
- 旧クラス名（`.study-shell`, `.exam-player__*` 等）はコンポーネントへ移し、`style.css` から削除。
- 動的な値（進捗幅・座標）は `style={{...}}` を使う。

## 5. `@remix-run/ui` のプリミティブを基底に使う

独自実装をやめ、`mix={[ownStyle, primitive.xxx({...})]}` の形で振る舞いだけ借り、見た目は `css()`
で当てる（"headless + app-owned styles" が同ライブラリの設計）。

| 現状の自作 | 置換先 |
| --- | --- |
| 問題一覧ドロワ（`exam-question-list`） | `@remix-run/ui/popover`（anchor/surface/focus） |
| ○/× 判定ボタン（押下済み状態） | `@remix-run/ui/toggle`（controlled/uncontrolled） |
| ヘッダーのモバイルメニュー（`<details>`） | `@remix-run/ui/menu` |
| 年度/単元のタブ切替 | `@remix-run/ui/tabs` |
| 解答の開閉アニメーション（CSS クラス） | `@remix-run/ui/animation`（`animateEntrance`/`animateExit`） |
| ホームの単元リスト（`<details>`） | `@remix-run/ui/accordion` |
| 同期リンクの選択 UI（将来） | `@remix-run/ui/select` / `combobox` |

アイコンは `@remix-run/ui` に無いため、`app/ui/icons.tsx` を純表示コンポーネントとして維持する。

## 6. 命名・分割の規約

- ファイル名は kebab-case（`player-controls.tsx`）。型は PascalCase。
- 1 ファイル 1 関心。目安 200 行。超えたら機能単位で分割する。
- `actions/` はルート単位（`actions/<domain>/controller.tsx`）。`pages/` は描画のみ。
- テストは対象と同じディレクトリに `*.test.ts`。ドメインは純関数、UI は e2e。

## 7. 進め方

1. 方針確定（本文書 + `TODO.md`）
2. グローバル CSS の縮小とトークン化
3. `features/*` の再分割（model/storage/api/ui を明示）
4. `pages/` と `actions/` の分離、Document の整理
5. Frame 導入（question region → unit-year region）
6. `@remix-run/ui` への置換
7. テスト・ドキュメント更新

各段階で `pnpm typecheck` / `pnpm test` / `pnpm check` / SSR スモークを通す。
