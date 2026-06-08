import mdx from "@mdx-js/rollup";
import { islandComponents } from "honox/vite";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// .mdx（使い方ガイド本文）を hono/jsx へコンパイル（本番 vite.config と同条件）。
	// honox の island 変換を vitest にも適用し、app/islands/* を本番同様 <honox-island>
	// プレースホルダとして SSR する（島の DOM フック useActionState 等を server 描画しない）。
	plugins: [mdx({ jsxImportSource: "hono/jsx", remarkPlugins: [remarkGfm] }), islandComponents()],
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "hono/jsx",
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./app/types/test/setup.ts"],
		include: ["app/**/*.test.{ts,tsx}"],
	},
});
