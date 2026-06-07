import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// .tsx を hono/jsx/dom ランタイムで変換する（astro.config.mjs の vite.esbuild と揃える）
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "hono/jsx/dom",
	},
	resolve: {
		alias: {
			// astro:content（仮想モジュール）は vitest で解決できないためスタブに差し替える
			"astro:content": fileURLToPath(
				new URL("./src/types/test/astroContentStub.ts", import.meta.url),
			),
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/types/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
