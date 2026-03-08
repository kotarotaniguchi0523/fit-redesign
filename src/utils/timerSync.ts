import type { TimerStorageData } from "../types/timer";
import { createLogger } from "./logger";

const logger = createLogger("[TimerSync]");

/**
 * サーバーにタイマーデータを同期（fire-and-forget）
 */
export function syncToServer(userId: string, data: TimerStorageData): void {
	fetch("/api/timer/sync", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId, records: data.records }),
	})
		.then((res) => {
			if (!res.ok) {
				logger.warn(`Sync failed with status ${res.status}`);
			} else {
				logger.info("Synced to server successfully");
			}
		})
		.catch((err) => {
			logger.warn("Sync to server failed (offline?)", { error: err });
		});
}

/**
 * サーバーからタイマーデータを取得
 */
export async function loadFromServer(
	userId: string,
): Promise<TimerStorageData | null> {
	try {
		const res = await fetch(`/api/timer/load?userId=${encodeURIComponent(userId)}`);
		if (!res.ok) {
			logger.warn(`Load from server failed with status ${res.status}`);
			return null;
		}
		const json = (await res.json()) as { records?: TimerStorageData["records"] };
		return { version: 1, records: json.records ?? {} };
	} catch (err) {
		logger.warn("Load from server failed (offline?)", { error: err });
		return null;
	}
}

/**
 * ローカルとリモートのデータをマージ（additive merge）
 * 同一 questionId + timestamp の attempt は重複排除
 */
export function mergeData(
	local: TimerStorageData,
	remote: TimerStorageData,
): TimerStorageData {
	const allQuestionIds = new Set([
		...Object.keys(local.records),
		...Object.keys(remote.records),
	]);

	const merged: TimerStorageData = { version: 1, records: {} };

	for (const qid of allQuestionIds) {
		const localAttempts = local.records[qid as keyof typeof local.records]?.attempts ?? [];
		const remoteAttempts = remote.records[qid as keyof typeof remote.records]?.attempts ?? [];

		// timestamp をキーにして重複排除
		const seen = new Set<number>();
		const combined = [];
		for (const a of [...localAttempts, ...remoteAttempts]) {
			if (!seen.has(a.timestamp)) {
				seen.add(a.timestamp);
				combined.push(a);
			}
		}

		// timestamp 昇順でソート
		combined.sort((a, b) => a.timestamp - b.timestamp);

		merged.records[qid as keyof typeof merged.records] = {
			questionId: qid as keyof typeof merged.records,
			attempts: combined,
		};
	}

	return merged;
}

/**
 * サーバーから特定問題の履歴をクリア
 */
export function clearOnServer(userId: string, questionId: string): void {
	fetch(
		`/api/timer/clear?userId=${encodeURIComponent(userId)}&questionId=${encodeURIComponent(questionId)}`,
		{ method: "DELETE" },
	)
		.then((res) => {
			if (!res.ok) {
				logger.warn(`Clear on server failed with status ${res.status}`);
			}
		})
		.catch((err) => {
			logger.warn("Clear on server failed (offline?)", { error: err });
		});
}
