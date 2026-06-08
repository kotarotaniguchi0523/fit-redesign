import build from "@hono/vite-build/cloudflare-workers";
import adapter from "@hono/vite-dev-server/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import { defineConfig } from "vite";

export default defineConfig({
	// server 側 JSX は hono/jsx（islands は honox が hono/jsx/dom へ変換）。
	esbuild: { jsxImportSource: "hono/jsx" },
	plugins: [
		tailwindcss(),
		honox({
			devServer: { adapter },
			client: { input: ["/app/client.ts", "/app/style.css"] },
		}),
		build(),
	],
});
