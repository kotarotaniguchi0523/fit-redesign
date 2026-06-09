import { hc } from "hono/client";
import { createLogger } from "../../lib/logger";
import type { TimerApp } from "../../routes/timer";
import type { QuestionId } from "../../types";
import type { TimerStorageData } from "./types";

const logger = createLogger("[TimerSync]");

// hc RPC クライアント（型は import type で取り込むため zod 等の server コードはバンドルされない）。
const client = hc<TimerApp>("/timer");

/**
 * サーバーにタイマーデータを同期（fire-and-forget）
 */
export function syncToServer(data: TimerStorageData): void {
	// Partial<Record<QuestionId, ...>> から undefined 値を除いて RPC 入力型に合わせる
	const records = Object.fromEntries(
		Object.entries(data.records).flatMap(([qid, record]) => (record ? [[qid, record]] : [])),
	);
	client.sync
		.$post({ json: { records } })
		.then((res) => {
			if (res.ok) {
				logger.info("Synced to server successfully");
			} else {
				logger.warn(`Sync failed with status ${res.status}`);
			}
		})
		.catch((err) => {
			logger.warn("Sync to server failed (offline?)", { error: err });
		});
}

/**
 * サーバーからタイマーデータを取得
 */
export async function loadFromServer(): Promise<TimerStorageData | null> {
	try {
		const res = await client.load.$get();
		// status===200 で成功型に絞り、records をキャスト無しで取り出す。
		if (res.status !== 200) {
			logger.warn(`Load from server failed with status ${res.status}`);
			return null;
		}
		const { records } = await res.json();
		return { version: 1, records };
	} catch (err) {
		logger.warn("Load from server failed (offline?)", { error: err });
		return null;
	}
}

/**
 * ローカルとリモートのデータをマージ（additive merge）
 * 同一 questionId + timestamp の attempt は重複排除
 */
export function mergeData(local: TimerStorageData, remote: TimerStorageData): TimerStorageData {
	const allQuestionIds = new Set([...Object.keys(local.records), ...Object.keys(remote.records)]);

	const records = Object.fromEntries(
		Array.from(allQuestionIds).map((qid) => {
			const questionId = qid as QuestionId;
			const localAttempts = local.records[questionId]?.attempts ?? [];
			const remoteAttempts = remote.records[questionId]?.attempts ?? [];

			// timestamp をキーにして重複排除。旧実装と同じく先に見つかった試行を採用する。
			const attemptsByTimestamp = [...localAttempts, ...remoteAttempts].reduce(
				(seenAttempts, attempt) => {
					if (!seenAttempts.has(attempt.timestamp)) {
						seenAttempts.set(attempt.timestamp, attempt);
					}
					return seenAttempts;
				},
				new Map<number, (typeof localAttempts)[number]>(),
			);
			const combined = Array.from(attemptsByTimestamp.values()).sort(
				(a, b) => a.timestamp - b.timestamp,
			);

			return [qid, { questionId, attempts: combined }];
		}),
	) as TimerStorageData["records"];

	return { version: 1, records };
}

/**
 * サーバーから特定問題の履歴をクリア
 */
export function clearOnServer(questionId: string): void {
	client.clear
		.$delete({ query: { questionId } })
		.then((res) => {
			if (!res.ok) {
				logger.warn(`Clear on server failed with status ${res.status}`);
			}
		})
		.catch((err) => {
			logger.warn("Clear on server failed (offline?)", { error: err });
		});
}
