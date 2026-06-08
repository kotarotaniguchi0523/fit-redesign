import { bench, describe } from "vitest";
import { unitBasedTabs } from "../../data/units";
import { buildUnitManifest, getUnitQuestions } from "./questionManifest";

/**
 * questionManifest の O(n) 線形探索 → Map 化 / メモ化の効果を計測するベンチ。
 * `getExamByNumber` の Map 化（data/exams）と `buildUnitManifest` のメモ化が
 * before/after でどれだけ効くかを数値で残す。
 *
 * 実行: pnpm exec vitest bench --run app/features/srs/questionManifest.bench.ts
 */

const firstUnit = unitBasedTabs[0];

describe("buildUnitManifest", () => {
	bench("buildUnitManifest()", async () => {
		await buildUnitManifest();
	});
});

describe("getUnitQuestions", () => {
	bench("getUnitQuestions(firstUnit)", async () => {
		await getUnitQuestions(firstUnit);
	});
});
