// clientEntry を hydrate するため、島モジュールを「再エクスポート」してバンドルへ含める。
//
// 副作用 import だけだと esbuild はコンポーネントの export を残さず、
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
 * Workers では Remix のアセットサーバー（Node 前提）を実行時に使えないため、
 * このモジュールを esbuild で `public/assets/client.js` へバンドルし、
 * Workers Assets が配信する。clientEntry の entryId は公開 URL
 * （`/assets/client.js#ExportName`）を使う。
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
