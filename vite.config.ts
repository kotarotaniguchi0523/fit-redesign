import mdx from "@mdx-js/rollup";
import build from "@hono/vite-build/cloudflare-workers";
import adapter from "@hono/vite-dev-server/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import remarkGfm from "remark-gfm";
import { defineConfig, type Plugin } from "vite";

const clientInput = ["/app/client.ts", "/app/style.css"];
const honoxPlugins = honox({ devServer: { adapter }, client: { input: clientInput } });
const clientPlugin: Plugin = {
	name: "honox-vite-client-oxc",
	apply: (_config, { command, mode }) => command === "build" && mode === "client",
	config: () => ({
		build: {
			rollupOptions: { input: clientInput },
			assetsDir: "static",
			manifest: true,
		},
		oxc: { jsx: { runtime: "automatic", importSource: "hono/jsx/dom" } },
	}),
};

export default defineConfig({
	// server 側 JSX は hono/jsx（islands は honox が hono/jsx/dom へ変換）。
	oxc: { jsx: { importSource: "hono/jsx" } },
	plugins: [
		// .mdx を hono/jsx の JSX コンポーネントへコンパイル（GFM テーブル対応）。honox より前に置く。
		mdx({ jsxImportSource: "hono/jsx", remarkPlugins: [remarkGfm] }),
		tailwindcss(),
		...honoxPlugins.slice(0, -1),
		clientPlugin,
		build(),
	],
});
