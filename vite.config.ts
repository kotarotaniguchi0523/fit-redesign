import build from "@hono/vite-build/cloudflare-workers";
import adapter from "@hono/vite-dev-server/cloudflare";
import honox from "honox/vite";
import { defineConfig } from "vite";

export default defineConfig({
	// server 側 JSX は hono/jsx（honox 標準）。islands は honox が hono/jsx/dom へ変換する。
	esbuild: {
		jsxImportSource: "hono/jsx",
	},
	plugins: [honox({ devServer: { adapter } }), build()],
});
