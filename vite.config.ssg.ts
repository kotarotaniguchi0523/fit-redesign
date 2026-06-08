import ssg from "@hono/vite-ssg";
import honox from "honox/vite";
import { defineConfig } from "vite";

export default defineConfig({
	esbuild: { jsxImportSource: "hono/jsx" },
	build: { emptyOutDir: false },
	plugins: [honox(), ssg({ entry: "./app/server.ts" })],
});
