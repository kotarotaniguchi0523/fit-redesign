import { describe, expect, it } from "vitest";
import { type ProgressEntry, ProgressEntrySchema } from "../types/browser";
import { hasPlausibleProgressTime, mergeLatestProgressEntries } from "./progress";

const q1 = "exam1-2013-q1";
const q2 = "exam1-2013-q2";

function entry(
	questionId: string,
	unitId: string,
	createdAt: number,
	updatedAt: number,
): ProgressEntry {
	return ProgressEntrySchema.parse({ questionId, unitId, createdAt, updatedAt });
}

describe("progress domain helpers", () => {
	it("最新確認時刻と最初の確認時刻を統合し、入力を変更しない", () => {
		const older = Object.freeze(entry(q1, "unit-base-conversion", 100, 200));
		const latest = Object.freeze(entry(q1, "unit-data", 150, 300));
		const other = Object.freeze(entry(q2, "unit-data", 250, 250));
		const input = Object.freeze([older, latest, other]);

		const merged = mergeLatestProgressEntries(input);

		expect(merged).toEqual([{ ...latest, createdAt: 100 }, other]);
		expect(mergeLatestProgressEntries([latest, older])).toEqual([{ ...latest, createdAt: 100 }]);
		expect(input).toEqual([older, latest, other]);
	});

	it("同じ更新時刻では作成時刻を最小化し、他の値は先の項目から保つ", () => {
		const first = entry(q1, "unit-base-conversion", 200, 300);
		const tied = entry(q1, "unit-data", 100, 300);

		expect(mergeLatestProgressEntries([first, tied])).toEqual([{ ...first, createdAt: 100 }]);
	});

	it("進捗時刻を未来許容幅と作成・更新順で検証する", () => {
		const valid = entry(q1, "unit-data", 100, 200);

		expect(hasPlausibleProgressTime(valid, 200)).toBe(true);
		expect(hasPlausibleProgressTime(valid, 200 - 5 * 60 * 1000 - 1)).toBe(false);
	});
});
