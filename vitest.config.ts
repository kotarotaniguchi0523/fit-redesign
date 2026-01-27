import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/types/test/setup.ts"],
		include: ["src/**/*.test.ts"],
	},
});
