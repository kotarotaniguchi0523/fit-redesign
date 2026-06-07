import type { AnswerStatus } from "../types/answer";
import { getLatestAnswers } from "./answerRepository";

/**
 * 回答済み状態の read-through キャッシュ（Cloudflare KV）。
 *
 * - キー `answer:{userId}` にユーザーの全 status マップ（questionId → AnswerStatus）を格納する。
 * - status 読み出しは KV ヒット時 D1 を読まず、ミス時のみ D1 から再構築して書き戻す。
 * - submit はマップが warm な場合のみ該当 question を上書きする（部分マップを作らず整合性を保つ）。
 * - D1 が信頼源。KV は TTL で自己修復させる。
 */

const TTL_SECONDS = 86400 * 30; // 30日

export function answerStatusKey(userId: string): string {
	return `answer:${userId}`;
}

type StatusMap = Record<string, AnswerStatus>;

/**
 * KV ヒット時は D1 不発火。ミス時は D1 フォールバック + 書き戻し。
 * KV 障害時（get/put が throw）は D1 にフォールバックする（D1 が信頼源）。
 */
export async function getAnswerStatuses(
	cache: KVNamespace,
	db: D1Database,
	userId: string,
): Promise<StatusMap> {
	const key = answerStatusKey(userId);

	try {
		const cached = await cache.get<StatusMap>(key, "json");
		if (cached) {
			return cached;
		}
	} catch {
		// KV 読み出し失敗 → D1 フォールバック（書き戻しもスキップ）
		return getLatestAnswers(db, userId);
	}

	const statuses = await getLatestAnswers(db, userId);
	try {
		await cache.put(key, JSON.stringify(statuses), { expirationTtl: TTL_SECONDS });
	} catch {
		// 書き戻し失敗は無視（D1 が信頼源）
	}
	return statuses;
}

/**
 * submit 後の KV 更新（write-invalidate）。
 * 該当ユーザーのキャッシュを無効化し、次の status 読み出しで D1 から全マップを再構築させる。
 * get→mutate→put だと別 question の並行 submit で取りこぼし（lost-update）が起きるため、
 * D1（信頼源）への再構築に委ねて整合性を保つ。
 */
export async function updateAnswerStatus(cache: KVNamespace, userId: string): Promise<void> {
	await cache.delete(answerStatusKey(userId));
}
