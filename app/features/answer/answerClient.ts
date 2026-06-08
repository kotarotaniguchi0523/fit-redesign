import { QUESTION_GRADED_EVENT } from "../../constants";
import { createLogger } from "../../lib/logger";
import { getUserId } from "../../lib/userId";

const logger = createLogger("[AnswerClient]");

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

	const userId = getUserId();
	if (userId === "anonymous") {
		statusPromise = Promise.resolve({});
		return statusPromise;
	}

	statusPromise = fetch(`/api/answer/status?userId=${encodeURIComponent(userId)}`)
		.then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
		.then((data) =>
			data && typeof data === "object" && "statuses" in data
				? ((data as { statuses: AnswerStatusMap }).statuses ?? {})
				: {},
		)
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

	const userId = getUserId();
	if (userId === "anonymous") return;

	try {
		await fetch("/api/answer/submit", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				userId,
				questionId: params.questionId,
				selectedLabel: params.selectedLabel,
				isCorrect: params.isCorrect,
				duration: params.duration,
				timestamp: Date.now(),
			}),
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
