import { QUESTION_GRADED_EVENT } from "../../constants";
import { apiClient } from "../../utils/apiClient";
import { createLogger } from "../../utils/logger";
import { getUserId } from "../../utils/userId";

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

	statusPromise = apiClient.api.answer.status
		.$get({ query: { userId } })
		.then((res) => (res.ok ? res.json() : null))
		.then((data) => (data && "statuses" in data ? data.statuses : {}))
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
		await apiClient.api.answer.submit.$post({
			json: {
				userId,
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
 * 同じカード内の question-timer から経過秒数を読み取る。
 */
export function readTimerDuration(card: Element | null): number | undefined {
	const timer = card?.querySelector("question-timer");
	if (!timer) return undefined;

	const display =
		timer.shadowRoot?.querySelector("[data-elapsed]") ?? timer.querySelector("[data-elapsed]");
	if (display) {
		const elapsed = Number(display.getAttribute("data-elapsed"));
		if (Number.isFinite(elapsed) && elapsed > 0) return elapsed;
	}
	return undefined;
}
