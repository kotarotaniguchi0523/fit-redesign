import { run } from "remix/component";

/**
 * ブラウザーエントリ（`run()` で島を hydrate するだけの薄い入口）。
 *
 * Cloudflare Workers では `remix/assets` の実行時アセットサーバー（oxc の
 * ネイティブバインディング・fs・chokidar 前提）が動かないため、
 * `scripts/build-assets.mjs` が同じアセットサーバーを Node 上で回し、
 * アンバンドル ESM と import map / modulepreload を `public/assets/**` へ出力する。
 * Workers Assets が配信し、Document が import map と preload を描画する。
 *
 * 島（clientEntry）はそれぞれ自分のモジュールを入口にするため、ここで
 * 再エクスポートしない。ページが必要とする島のモジュールだけが読み込まれる。
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
