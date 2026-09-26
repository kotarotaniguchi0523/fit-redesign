import { brotliCompressSync, gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const dist = path.join(root, "dist");
const iterations = Number(process.env.PERF_ITERATIONS ?? 15);
const warmups = Number(process.env.PERF_WARMUPS ?? 3);
const routes = [
	{ name: "home", path: "/" },
	{ name: "guide", path: "/guide" },
	{ name: "unit-year", path: "/unit-base-conversion/2013" },
	{ name: "exam-player", path: "/unit-base-conversion/2013/exam?exam=1" },
	{ name: "records", path: "/records" },
];

if (!Number.isInteger(iterations) || iterations < 1 || !Number.isInteger(warmups) || warmups < 0) {
	throw new Error("PERF_ITERATIONS must be >= 1 and PERF_WARMUPS must be >= 0");
}

function sizes(buffer) {
	return {
		bytes: buffer.byteLength,
		gzipBytes: gzipSync(buffer).byteLength,
		brotliBytes: brotliCompressSync(buffer).byteLength,
	};
}

function percentile(samples, fraction) {
	const sorted = [...samples].sort((left, right) => left - right);
	return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function islandNames(html) {
	return [...html.matchAll(/<honox-island\b([^>]*)>/g)]
		.map(([, attributes]) => attributes.match(/component-name="([^"]+)"/)?.[1])
		.filter((name) => name !== undefined);
}

function manifestEntryForIsland(manifest, componentName) {
	const normalized = componentName.replace(/^\//, "");
	return Object.entries(manifest).find(([key, entry]) => {
		const source = entry.src?.replace(/^\//, "");
		return key === normalized || source === normalized;
	})?.[0];
}

function assetClosure(manifest, entryNames) {
	const found = new Set();
	const visit = (name) => {
		if (found.has(name) || !manifest[name]) return;
		found.add(name);
		for (const dependency of manifest[name].imports ?? []) visit(dependency);
	};
	for (const name of entryNames) visit(name);
	return [...found];
}

async function assetSizes(manifest, entryNames) {
	const keys = assetClosure(manifest, entryNames);
	const assets = await Promise.all(
		keys.map(async (key) => {
			const file = manifest[key].file;
			const contents = await readFile(path.join(dist, file));
			return { file, ...sizes(contents) };
		}),
	);
	return {
		assets,
		bytes: assets.reduce((total, asset) => total + asset.bytes, 0),
		gzipBytes: assets.reduce((total, asset) => total + asset.gzipBytes, 0),
		brotliBytes: assets.reduce((total, asset) => total + asset.brotliBytes, 0),
	};
}

const manifest = JSON.parse(await readFile(path.join(dist, ".vite/manifest.json"), "utf8"));
const vite = await createServer({
	configFile: path.join(root, "vite.config.ts"),
	logLevel: "error",
	server: { middlewareMode: true },
});
const originalInfo = console.info;
console.info = () => {};

try {
	const { default: app } = await vite.ssrLoadModule("/app/server.ts");
	const results = [];
	for (const route of routes) {
		const timings = [];
		let responseBody = "";
		let status = 0;
		for (let sample = 0; sample < warmups + iterations; sample += 1) {
			const startedAt = performance.now();
			const response = await app.request(`http://localhost${route.path}`);
			responseBody = await response.text();
			const elapsedMs = performance.now() - startedAt;
			status = response.status;
			if (sample >= warmups) timings.push(elapsedMs);
		}
		const htmlBuffer = Buffer.from(responseBody);
		const componentNames = islandNames(responseBody);
		const islandEntries = componentNames
			.map((name) => manifestEntryForIsland(manifest, name))
			.filter((name) => name !== undefined);
		const routeAssets = await assetSizes(manifest, ["app/client.ts", "app/style.css", ...islandEntries]);
		results.push({
			name: route.name,
			path: route.path,
			status,
			html: sizes(htmlBuffer),
			ssrAppRequestMs: {
				p50: Number(percentile(timings, 0.5).toFixed(2)),
				p95: Number(percentile(timings, 0.95).toFixed(2)),
				samples: timings.length,
			},
			islands: componentNames,
			clientAssets: routeAssets,
		});
	}

	const clientJs = Object.values(manifest)
		.filter((entry) => entry.file.endsWith(".js") && entry.file.startsWith("static/"))
		.map((entry) => entry.file);
	const css = Object.values(manifest)
		.filter((entry) => entry.file.endsWith(".css"))
		.map((entry) => entry.file);
	const result = {
		metadata: {
			generatedAt: new Date().toISOString(),
			node: process.version,
			commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
			branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
			workingTreeDirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
			iterations,
			warmups,
			measurement: "local Node.js + Vite SSR app.request; not production Workers CPU or browser UX",
		},
		build: {
			clientJs: await Promise.all(
				clientJs.map(async (file) => ({ file, ...sizes(await readFile(path.join(dist, file))) })),
			),
			css: await Promise.all(
				css.map(async (file) => ({ file, ...sizes(await readFile(path.join(dist, file))) })),
			),
			workerBundleBytes: (await stat(path.join(dist, "index.js"))).size,
		},
		routes: results,
	};

	const output = process.argv.indexOf("--output");
	if (output >= 0 && process.argv[output + 1]) {
		const outputPath = path.resolve(process.argv[output + 1]);
		const { mkdir, writeFile } = await import("node:fs/promises");
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
	}

	console.log(JSON.stringify(result, null, 2));
} finally {
	console.info = originalInfo;
	await vite.close();
}
