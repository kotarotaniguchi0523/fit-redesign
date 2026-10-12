# リアーキテクチャ TODO

`REARCHITECTURE.md` の方針に沿って進める。完了したら `[x]`、方針変更は本方針を更新してから反映する。

## P0: 方針と地図

- [x] 方針文書を作成（REARCHITECTURE.md）
- [x] SPA 不採用 / Frame 採用箇所の決定
- [x] `@remix-run/ui` 置換マップの決定
- [ ] 現状ファイルの棚卸しと移動先の確定（下の「移行マップ」）
- [ ] グローバル CSS に残す項目の確定（tokens / font / base / sr-only）

## P1: グローバル CSS の縮小

- [ ] `scripts/build-css.mjs` を「トークン + base + sr-only」のみ出力に変更
- [ ] 各コンポーネントのクラス指定を `css()` 併置へ移行（ドメインごと）
- [ ] `public/style.css` から旧コンポーネントクラスを削除
- [ ] 旧 `legacy/index.css` への依存を完全に切る

## P2: features の再分割

- [ ] `features/challenge/` を `model.ts`（純ロジック）/ `storage.ts` / `api.ts` / `ui/` に整理
- [ ] `features/progress/` を同様に整理
- [ ] `features/answer/` の型・モデルを challenge と重複しないよう統合
- [ ] `features/*/ui` は他ドメインから参照しない（共有は `app/ui` へ昇格）

## P3: pages と actions の分離

- [ ] `app/pages/` を新設し、`actions/*-page.tsx` を移動
- [ ] `actions/` は「検証 + データ取得 + `context.render(<Page/>)`」だけにする
- [ ] `Document` をページ側へ移し、frame 応答では Document を出さない

## P4: Frame 導入

- [ ] 問題領域ルート（`.../question/:question/region`）を追加し、領域描画を `Document` なしで返す
- [ ] exam ページのプレイヤー chrome を島、問題本体を `<Frame>` に分離
- [ ] `/:unit/:year` の小テスト一覧を年度タブの `<Frame>` 化
- [ ] JS 無効で前後移動・問題閲覧が成立することを確認

## P5: `@remix-run/ui` への置換

- [ ] 問題一覧ドロワ → `popover`
- [ ] ○/× 判定 → `toggle`
- [ ] ヘッダーのモバイルメニュー → `menu`
- [ ] 年度/単元タブ → `tabs`
- [ ] 解答開閉・結果表示のアニメーション → `animation`
- [ ] ホームの単元リスト → `accordion`
- [ ] アイコンは `app/ui/icons.tsx` に集約（`@remix-run/ui` に無いため自作を維持）

## P6: 検証とドキュメント

- [ ] `pnpm typecheck` / `pnpm test` / `pnpm check` / SSR スモークを各段階で実行
- [ ] SSR スモークに Frame 領域の検証を追加
- [ ] E2E に Frame の JS 有効/無効の分岐を追加
- [ ] README / AGENTS.md / lat.md を新構造へ更新
- [ ] `origin/remix3-migration` の履歴を整理（必要なら）

## 移行マップ（現状 → 目標）

| 現状 | 目標 |
| --- | --- |
| `app/actions/controller.tsx`（ページ多く） | `app/actions/<domain>/controller.tsx` + `app/pages/<page>.tsx` |
| `app/actions/{home,guide,slide-only,records,unit-year,exam-player}-page.tsx` | `app/pages/` |
| `app/actions/document.tsx` | `app/pages/document.tsx`（frame 応答では使わない） |
| `app/features/challenge/{challenge,challengeStorage,challengeApi,challengeWire}.ts` | `features/challenge/{model,storage,api,wire}.ts` |
| `app/features/challenge/player/{model,timerRuntime,initialPlayerSession,initialView,navigation,id,types}.ts` | `features/challenge/player/` に整理（session/view は `model` へ統合検討） |
| `app/features/challenge/player/ui/*` | `features/challenge/ui/*`（player 専用はそのまま維持可） |
| `app/features/progress/*` | `features/progress/{model,storage,api,ui}/` |
| `app/ui/{Header,PageHeading,figures,copy-button}` | `app/ui/`（共有のみ）+ ドメイン固有は features へ |
| `public/style.css`（2671 行） | トークン/base のみ（数十行）+ コンポーネント `css()` |
