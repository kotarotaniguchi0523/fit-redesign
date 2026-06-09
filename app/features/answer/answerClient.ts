import { hc } from "hono/client";
import { QUESTION_GRADED_EVENT } from "../../constants";
import { createLogger } from "../../lib/logger";
import type { AnswerApp } from "../../routes/answer";

const logger = createLogger("[AnswerClient]");

// hc RPC クライアント（型は import type で取り込むため zod 等の server コードはバンドルされない）。
const client = hc<AnswerApp>("/answer");

export interface AnswerStatus {
	label: string;
	isCorrect: boolean;
}

export interface AnswerStatusMap {
	[questionId: string]: AnswerStatus;
}

// ページ全体で1回だけ回答済み状態を取得（カードごとの重複fetchを防ぐ）
let statusPromise: Promise<AnswerStatusMap> | null = null;

export function fetchAnswerStatuses(): Promise<AnswerStatusMap> {
	if (statusPromise) return statusPromise;

	// res.ok は全レスポンスで boolean のため .json() を成功型へ絞れない。status===200 で判別する。
	statusPromise = client.status
		.$get()
		.then(async (res) => (res.status === 200 ? (await res.json()).statuses : {}))
		.catch(() => ({}));

	return statusPromise;
}

/**
 * 回答をサーバーに保存（fire-and-forget）。失敗しても学習体験は止めない。
 */
export async function saveAnswer(params: {
	questionId: string;
	selectedLabel: string;
	isCorrect: boolean;
	duration?: number;
}): Promise<void> {
	// 採点イベントを発火（SRS / セッション / ホームが購読）。サーバー保存可否に関わらず常に通知する。
	document.dispatchEvent(
		new CustomEvent(QUESTION_GRADED_EVENT, {
			detail: { questionId: params.questionId, isCorrect: params.isCorrect },
		}),
	);

	try {
		await client.submit.$post({
			json: {
				questionId: params.questionId,
				selectedLabel: params.selectedLabel,
				isCorrect: params.isCorrect,
				duration: params.duration,
				timestamp: Date.now(),
			},
		});
	} catch {
		logger.warn("Failed to save answer to server");
	}
}

/**
 * 同じカード内の question-timer（[data-question-timer]）が露出する解答時間（秒）を読み取る。
 */
export function readTimerDuration(card: Element | null): number | undefined {
	const timer = card?.querySelector<HTMLElement>("[data-question-timer]");
	const elapsed = Number(timer?.dataset.elapsed);
	return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : undefined;
}
