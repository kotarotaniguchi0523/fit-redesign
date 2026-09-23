import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "retain-on-failure",
		...devices["Desktop Chrome"],
	},
	webServer: {
		command: "pnpm exec wrangler dev --ip 127.0.0.1 --port 4173 --log-level error",
		url: "http://127.0.0.1:4173",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
