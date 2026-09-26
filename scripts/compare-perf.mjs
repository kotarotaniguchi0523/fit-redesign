import { readFile } from "node:fs/promises";

const [baselinePath, candidatePath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
	throw new Error("Usage: node scripts/compare-perf.mjs <baseline.json> <candidate.json>");
}

const [baseline, candidate] = await Promise.all(
	[baselinePath, candidatePath].map(async (file) => JSON.parse(await readFile(file, "utf8"))),
);
const change = (before, after) => {
	if (typeof before !== "number" || before === 0 || typeof after !== "number") return "n/a";
	const percentage = ((after - before) / before) * 100;
	return `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`;
};

console.log(`Baseline ${baseline.metadata.branch} ${baseline.metadata.commit} (${baseline.metadata.node})`);
console.log(`Candidate ${candidate.metadata.branch} ${candidate.metadata.commit} (${candidate.metadata.node})`);
console.log("Positive deltas are increases; timing deltas are informational, with no pass/fail threshold.");
console.log("\nRoute                          p50       p95       HTML      HTML br   route JS br");
for (const current of candidate.routes) {
	const previous = baseline.routes.find((route) => route.name === current.name);
	if (!previous) {
		console.log(`${current.name.padEnd(30)} no baseline route`);
		continue;
	}
	console.log(
		`${current.name.padEnd(30)} ${change(previous.ssrAppRequestMs.p50, current.ssrAppRequestMs.p50).padEnd(9)} ${change(previous.ssrAppRequestMs.p95, current.ssrAppRequestMs.p95).padEnd(9)} ${change(previous.html.bytes, current.html.bytes).padEnd(9)} ${change(previous.html.brotliBytes, current.html.brotliBytes).padEnd(9)} ${change(previous.clientAssets.brotliBytes, current.clientAssets.brotliBytes)}`,
	);
}

for (const [label, select] of [
	["Client JS raw bytes", (report) => report.build.clientJs.reduce((sum, item) => sum + item.bytes, 0)],
	["Client JS Brotli bytes", (report) => report.build.clientJs.reduce((sum, item) => sum + item.brotliBytes, 0)],
	["CSS Brotli bytes", (report) => report.build.css.reduce((sum, item) => sum + item.brotliBytes, 0)],
	["Worker bundle bytes", (report) => report.build.workerBundleBytes],
]) {
	console.log(`${label}: ${change(select(baseline), select(candidate))}`);
}
