# 既存システム 完全QAチェックリスト（実機 agent-browser 検証 結果）

凡例: ✅ 合格 / ⚠️ 要判断（仕様乖離）/ 🟡 環境制約（実機では正常）

---

## A. ホーム `/`
- ✅ A1 ヒーロー・メーター・CTA・単元リスト描画
- ✅ A2 新規0%、今日やる分=対象単元の件数（6問）
- ✅ A3 CTA が正しい `/today/[unit]` に向く（今日の道を始める→base-conversion）
- ✅ A4 単元9件・習熟度バー・今日N問バッジ
- ✅ A5 「講義資料だけ見る」→ `/slide-only`
- ✅ A6 ヘッダー 進捗→dashboard / 使い方→guide
- ✅ A7 クリーンコンテキストでコンソールエラーなし

## B. 単元ページ `/[unit]/[year]`
- ✅ B1 単元タブ実クリックで当該単元へ遷移（→/unit-automaton/2013）
- ✅ B2 単元ヘッダ
- ✅ B3 「このページの量」実データ一致
- ✅ B4 問題へ進む/先に資料を見る アンカー
- ✅ B5 講義スライドPDFリンク（/pdf/*.pdf, 別タブ）
- ✅ B6 小テスト一覧 実クリックで #exam-N へスクロール（scrollY 0→3194）
- ✅ B7 統合試験の注意（set-prob/2015 で表示）
- ✅ B8 記述式 答え合わせ→解説→自己採点（実タップ）
- ✅ B9 MCQ 選択→確認→正誤色→解説（実タップ）
- ✅ B10 覗き見=解説表示＋復習記録＋採点ロック（実タップ）
- ✅ B11 もう一度解く リセット・二重記録なし（DB 2件で実証）
- ✅ B12 各小テストPDF（200）
- ✅ B13 図表 全10タイプ描画（logicCircuit/truthTable/stateDiagram/binaryTree/parityCheck/flowchart/huffmanTable/dataTable/linkedListTable/normalDistributionTable）
- ✅ B14 figureDescriptionフォールバック（overline対応込み）
- （B15 準備中表示=該当データなし）

## ★C. 年度切替（最重点）★ 全PASS
- ✅ C1-C9 全9単元 × 利用可能年度 **40組合せすべて**、当該年度の問題のみ表示（他年度混入0）
- ✅ C3 float 2014/2016 は disabled span（snapshotにリンクとして出ない）
- ✅ C9 sort 2015/2016/2017 は disabled span
- ✅ C10 表示問題IDが当該年度（exam{n}-{year}-q{m}）
- ✅ C11 選択年度ハイライト
- ✅ C12 年度間で回答状態が分離・復元（2013採点→2014未回答→2013で復元）
- ✅ 実クリック遷移（2013→2014年度ボタン）でも2014問題が出る

## D. 今日の道 `/today/[unit]`
- ✅ D1 全9単元ページ開ける
- ✅ D2 SRSで1問ずつ（new capped 6）
- ✅ D3 進捗バー・次の問題へ・採点で緑強調
- ✅ D4 最終→サマリ（正解数/理解度）
- ✅ D5 空状態（全future-dueでseed→「今日のぶんは完了！」）
- ✅ D6 ★SRSゲート 過去due=出る/未来due=出ない/既習=新規扱いしない（seed検証）
- ✅ D7 複数年度混在（sort: queue1=2013×5+2014×1）
- ✅ D8 採点が D1 と localStorage SRS に記録

## E. ダッシュボード
- ✅ E1 `/dashboard/` userIdなし=空状態＋CTA
- ✅ E2 `/dashboard/` userIdあり=`/dashboard/{id}/`へリダイレクト
- ✅ E3 統計（解いた数/正答率50%/平均時間）
- ✅ E4 chart.js 2キャンバス描画
- ✅ E5 単元別集計
- ✅ E6 共有リンク

## F. その他/API
- ✅ F1 /guide markdown 読込
- ✅ F2 /slide-only 描画
- ✅ F3 /api/markdown/{unit}/{year} がMarkdown返却（200）
- ✅ F4 /api/answer/status|submit|history（200）
- ✅ F5 /api/timer/load（200）
- ⚠️ F6 旧日本語パス `/論理演算/2013` → **現状404**（CLAUDE.md は「トップへリダイレクト」と記載＝乖離。リダイレクト実装は存在しない）→ 要判断
- ✅ F7 存在しないパス → 404
- ✅ F8 robots.txt / llms-full.txt（200）。sitemap-index は本番ビルド生成（devは404=正常）

## G. 横断
- ✅ G1 全ルート期待ステータス
- ✅ G2 主要7ページ コンソールJSエラーなし（クリーンコンテキスト）
- ✅ G3 devserver ログに新規SSRエラーなし
- ✅ G4 モバイル390pxで主要画面が崩れない

## 追加修正（このQAで発見・対応）
- ✅ 論理否定の結合オーバーライン(U+0305 ×69 / U+0304 ×2)が実機Noto Sans JPで□に化ける問題 → `overlineToHtml` でCSS overline化。テスト8件追加、実機で上線描画を確認。

## 環境制約（実機では正常・コード不具合ではない）
- 🟡 コピーボタン: ヘッドレスで `navigator.clipboard.writeText` が NotAllowedError。実機（ユーザー操作＋secure context）では動作。成功/失敗ハンドラ完備。
- 🟡 単元ラベル等の絵文字(🔢🔀): ヘッドレスに絵文字フォント無し。実機では表示。
- 🟡 タイマー: 実機で正常（開始→「停止」化、00:02までカウント実証）。
