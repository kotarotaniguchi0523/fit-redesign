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
	if (statusPromise) {
		return statusPromise;
	}

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
	setId?: string;
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
				setId: params.setId,
			},
		});
	} catch {
		logger.warn("Failed to save answer to server");
	}
}

/**
 * ページ唯一のラップ式ストップウォッチ（[data-lap-stopwatch]）の現在状態を 1 度に読む。
 * recordAnswer は採点（QUESTION_GRADED_EVENT 発火）前に呼ぶため、その問題のラップ値とセットIDが取れる。
 * - durationSeconds: 島は進行中ラップが無い場合（idle/done）と 10 分超の外れ値を空文字で出す。空文字・非数値・0 以下は undefined。
 * - setId: data-set-id が空文字・未定義（セット未開始）なら undefined。
 */
export function readStopwatchSnapshot(): { durationSeconds?: number; setId?: string } {
	const widget = document.querySelector<HTMLElement>("[data-lap-stopwatch]");
	const seconds = Number(widget?.dataset.currentLapSeconds);
	return {
		durationSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
		setId: widget?.dataset.setId || undefined,
	};
}
