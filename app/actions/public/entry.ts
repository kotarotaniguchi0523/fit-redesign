// clientEntry を hydrate するため、島モジュールを「再エクスポート」して
// ブラウザー入口のモジュールグラフに含める。
//
// 副作用 import だけだとコンパイラはコンポーネントの export を残さず、
// 実行時の loadModule が `mod[exportName]` を見つけられない（Unknown component）。

export { ContinueLearning } from "../../features/answer/ui/continue-learning.tsx";
export { ExamPlayer } from "../../features/challenge/ui/exam-player.tsx";
export { RecordsView } from "../../features/progress/ui/records-view.tsx";
export { CopyButton } from "../../ui/copy-button.tsx";
export { Header } from "../../ui/header.tsx";
export { UnitAccordion } from "../../ui/unit-accordion.tsx";

import { run } from "remix/component";

/**
 * ブラウザーエントリ。`run()` が clientEntry を hydrate する。
 *
 * Cloudflare Workers では `remix/assets` の実行時アセットサーバー（oxc の
 * ネイティブバインディング・fs・chokidar 前提）が動かないため、
 * `scripts/build-assets.mjs` が同じアセットサーバーを Node 上で回し、
 * コンパイル済みモジュールを `public/assets/**` へ出力する。Workers Assets が
 * それを配信し、Document が import map と modulepreload を描画する。
 */
const app = run({
	async loadModule(moduleUrl, exportName) {
		const mod = (await import(/* @vite-ignore */ moduleUrl)) as Record<string, unknown>;
		const component = mod[exportName];
		if (typeof component !== "function") {
			throw new Error(`Unknown component: ${moduleUrl}#${exportName}`);
		}
		return component as never;
	},
});

await app.ready();
