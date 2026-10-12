import * as assert from "remix/assert";
import { afterEach, describe, it } from "remix/test";

import { installBrowserShims } from "../../test/browser-shims.ts";

installBrowserShims();

import { ProgressEntrySchema, SyncKeySchema } from "../../types/index.ts";
import { syncProgress } from "./api.ts";
import {
	PROGRESS_STORAGE_KEY,
	parseProgressSnapshot,
	readProgress,
	recordReveal,
	removeSyncKey,
	SYNC_KEY_STORAGE_KEY,
	saveProgressEntries,
	saveSyncKey,
} from "./storage.ts";

const entry = ProgressEntrySchema.parse({
	questionId: "exam1-2013-q1",
	unitId: "unit-base-conversion",
	createdAt: 123,
	updatedAt: 123,
});
const syncKey = SyncKeySchema.parse("a".repeat(43));

function partialMatch(actual: unknown, expected: Record<string, unknown>, label: string): void {
	assert.ok(actual !== null && typeof actual === "object", label);
	for (const [key, value] of Object.entries(expected)) {
		assert.deepEqual((actual as Record<string, unknown>)[key], value, `${label}: ${key}`);
	}
}

/** `localStorage[method]` を一度だけ失敗させて実行する。 */
function withOnceFailingStorage(method: "setItem" | "removeItem", run: () => void): void {
	const store = localStorage as Storage;
	const original = (store[method] as (key: string, value?: string) => void).bind(store);
	let thrown = false;
	store[method] = ((key: string, value?: string) => {
		if (!thrown) {
			thrown = true;
			throw new Error("storage unavailable");
		}
		original(key, value);
	}) as never;
	try {
		run();
	} finally {
		store[method] = original as never;
	}
}

/** `globalThis.fetch` を差し替えて実行する。 */
async function withFetch(
	stub: (...args: unknown[]) => Promise<Response>,
	run: () => Promise<void>,
): Promise<void> {
	const realFetch = globalThis.fetch;
	globalThis.fetch = stub as typeof fetch;
	try {
		await run();
	} finally {
		globalThis.fetch = realFetch;
	}
}

afterEach(() => {
	localStorage.clear();
});

describe("progress persistence", () => {
	it("問題ごとの最新確認記録を保存する", () => {
		recordReveal(entry);
		recordReveal(ProgressEntrySchema.parse({ ...entry, createdAt: 123, updatedAt: 456 }));
		assert.equal(readProgress()[entry.questionId]?.updatedAt, 456);
		assert.equal(Object.keys(readProgress()).length, 1);
	});

	it("壊れたlocalStorageを空の記録として扱う", () => {
		localStorage.setItem(PROGRESS_STORAGE_KEY, "broken");
		assert.deepEqual(readProgress(), {});
	});

	it("旧形式の開示時刻を現在の進捗形式へ移行する", () => {
		const migrated = parseProgressSnapshot(
			JSON.stringify({
				[entry.questionId]: {
					questionId: entry.questionId,
					unitId: entry.unitId,
					revealedAt: entry.createdAt,
				},
			}),
		);

		assert.deepEqual(migrated, { [entry.questionId]: entry });
	});

	it("同期キーの保存と削除に失敗したらResultで返す", () => {
		withOnceFailingStorage("setItem", () => {
			partialMatch(
				saveSyncKey(syncKey),
				{
					kind: "StorageMutationError",
					operation: "SaveSyncKey",
				},
				"saveSyncKey",
			);
		});

		withOnceFailingStorage("removeItem", () => {
			partialMatch(
				removeSyncKey(),
				{
					kind: "StorageMutationError",
					operation: "RemoveSyncKey",
				},
				"removeSyncKey",
			);
		});
	});

	it("同期成功時にサーバーで統合された最新記録をローカルへ反映する", async () => {
		localStorage.setItem(SYNC_KEY_STORAGE_KEY, syncKey);
		recordReveal(entry);
		const remoteEntry = ProgressEntrySchema.parse({
			questionId: "exam1-2014-q2",
			unitId: "unit-base-conversion",
			createdAt: 789,
			updatedAt: 789,
		});

		await withFetch(
			async () =>
				new Response(JSON.stringify({ entries: [{ ...entry, updatedAt: 100 }, remoteEntry] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			async () => {
				const result = await syncProgress(syncKey, [entry]);
				result.map(saveProgressEntries);

				assert.deepEqual(readProgress(), {
					[entry.questionId]: entry,
					[remoteEntry.questionId]: remoteEntry,
				});
			},
		);
	});

	it("同期失敗または不正な応答ではローカル記録を変更しない", async () => {
		localStorage.setItem(SYNC_KEY_STORAGE_KEY, syncKey);
		recordReveal(entry);

		const responses = [
			new Response("not found", { status: 404 }),
			new Response(JSON.stringify({ entries: [{ questionId: 42 }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		];
		let index = 0;

		await withFetch(
			async () => responses[index++] as Response,
			async () => {
				await syncProgress(syncKey, [entry]);
				await syncProgress(syncKey, [entry]);
			},
		);

		assert.deepEqual(readProgress(), { [entry.questionId]: entry });
	});
});
