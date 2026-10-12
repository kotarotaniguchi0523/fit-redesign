/**
 * クライアント（ブラウザー）バンドルを esbuild でビルドする。
 *
 * Remix のアセットサーバーは Node 前提で Workers 実行時には使えないため、
 * ここで `app/actions/public/entry.ts` を自己完結バンドルへ変換し、
 * Workers Assets が配信する `public/assets/client.js` を生成する。
 * remix/component もバンドルに含めるため import map は不要。
 *
 * 使い方: node scripts/build-client.mjs
 */
import { build } from 'esbuild'

await build({
	entryPoints: ['app/actions/public/entry.ts'],
	outfile: 'public/assets/client.js',
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: 'es2022',
	jsx: 'automatic',
	jsxImportSource: 'remix/component',
	conditions: ['browser', 'import', 'default'],
	define: { 'process.env.NODE_ENV': '"production"' },
	minify: false,
	sourcemap: false,
	logLevel: 'info',
})
