import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncProgress } from "./progressApi";
import {
	PROGRESS_STORAGE_KEY,
	readProgress,
	recordReveal,
	SYNC_KEY_STORAGE_KEY,
	saveProgressEntries,
} from "./progressStorage";

const entry = {
	questionId: "exam1-2013-q1" as never,
	unitId: "unit-base-conversion" as never,
	revealedAt: 123,
};

describe("progress persistence", () => {
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
	it("同期成功時にサーバーで統合された最新記録をローカルへ反映する", async () => {
		localStorage.setItem(SYNC_KEY_STORAGE_KEY, "sync-key");
		recordReveal(entry);
		const remoteEntry = {
			questionId: "exam1-2014-q2" as never,
			unitId: "unit-base-conversion" as never,
			revealedAt: 789,
		};
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ entries: [{ ...entry, revealedAt: 100 }, remoteEntry] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const result = await syncProgress("sync-key", [entry]);
		result.map(saveProgressEntries);

		expect(readProgress()).toEqual({
			[entry.questionId]: entry,
			[remoteEntry.questionId]: remoteEntry,
		});
	});
	it("同期失敗または不正な応答ではローカル記録を変更しない", async () => {
		localStorage.setItem(SYNC_KEY_STORAGE_KEY, "sync-key");
		recordReveal(entry);
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		fetchSpy.mockResolvedValueOnce(new Response("not found", { status: 404 }));
		await syncProgress("sync-key", [entry]);
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ entries: [{ questionId: 42 }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		await syncProgress("sync-key", [entry]);

		expect(readProgress()).toEqual({ [entry.questionId]: entry });
	});
});
