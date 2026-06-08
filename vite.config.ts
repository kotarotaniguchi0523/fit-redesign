import mdx from "@mdx-js/rollup";
import build from "@hono/vite-build/cloudflare-workers";
import adapter from "@hono/vite-dev-server/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

export default defineConfig({
	// server 側 JSX は hono/jsx（islands は honox が hono/jsx/dom へ変換）。
	esbuild: { jsxImportSource: "hono/jsx" },
	plugins: [
		// .mdx を hono/jsx の JSX コンポーネントへコンパイル（GFM テーブル対応）。honox より前に置く。
		mdx({ jsxImportSource: "hono/jsx", remarkPlugins: [remarkGfm] }),
		tailwindcss(),
		honox({
			devServer: { adapter },
			client: { input: ["/app/client.ts", "/app/style.css"] },
		}),
		build(),
	],
});
