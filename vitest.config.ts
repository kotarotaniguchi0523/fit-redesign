import { islandComponents } from "honox/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// honox の island 変換を vitest にも適用し、app/islands/* を本番同様 <honox-island>
	// プレースホルダとして SSR する（島の DOM フック useActionState 等を server 描画しない）。
	plugins: [islandComponents()],
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
