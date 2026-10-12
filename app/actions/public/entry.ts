// clientEntry を解決するため、島モジュールをバンドルへ含める（副作用 import）。
import "../../ui/copy-button.tsx";
import "../../ui/header.tsx";
import "../../features/challenge/ui/exam-player.tsx";
import "../../features/progress/ui/records-view.tsx";
import "../../features/answer/ui/continue-learning.tsx";

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
