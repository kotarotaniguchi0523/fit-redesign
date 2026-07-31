import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	PROGRESS_STORAGE_KEY,
	readProgress,
	recordReveal,
	syncProgressEntry,
} from "./progressClient";

const entry = {
	questionId: "exam1-2013-q1" as never,
	unitId: "unit-base-conversion" as never,
	revealedAt: 123,
};

describe("progressClient", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});
	it("問題ごとの最新確認記録を保存する", () => {
		recordReveal(entry);
		recordReveal({ ...entry, revealedAt: 456 });
		expect(readProgress()[entry.questionId]?.revealedAt).toBe(456);
		expect(Object.keys(readProgress())).toHaveLength(1);
	});
	it("壊れたlocalStorageを空の記録として扱う", () => {
		localStorage.setItem(PROGRESS_STORAGE_KEY, "broken");
		expect(readProgress()).toEqual({});
	});
	it("同期キーがなければAPIを呼ばない", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		await syncProgressEntry(entry);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
