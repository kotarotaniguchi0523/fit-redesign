import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium-desktop",
			use: { ...devices["Desktop Chrome"], browserName: "chromium" },
		},
		{
			name: "chromium-mobile",
			use: { ...devices["Pixel 7"], browserName: "chromium" },
		},
		{
			name: "webkit-desktop",
			use: { ...devices["Desktop Safari"], browserName: "webkit" },
		},
		{
			name: "webkit-mobile",
			use: { ...devices["iPhone 14"], browserName: "webkit" },
		},
		{
			name: "firefox-desktop",
			use: { ...devices["Desktop Firefox"], browserName: "firefox" },
		},
	],
	webServer: {
		command: "pnpm exec wrangler dev --ip 127.0.0.1 --port 4173 --log-level error",
		url: "http://127.0.0.1:4173",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
