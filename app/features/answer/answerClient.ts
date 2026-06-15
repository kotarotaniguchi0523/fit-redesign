import { hc } from "hono/client";
import { QUESTION_GRADED_EVENT } from "../../constants";
import { createLogger } from "../../lib/logger";
import type { AnswerApp } from "../../routes/answer";
import type { AnswerStatus } from "../../types/answer";
import type { QuestionGradedDetail } from "../srs/srs";

const logger = createLogger("[AnswerClient]");

// hc RPC クライアント（型は import type で取り込むため zod 等の server コードはバンドルされない）。
const client = hc<AnswerApp>("/answer");

// 回答済み状態は単一真実源 types/answer.ts の AnswerStatus を使う（client 側の再定義は撤廃）。
export interface AnswerStatusMap {
	[questionId: string]: AnswerStatus;
}

// ページ全体で1回だけ回答済み状態を取得（カードごとの重複fetchを防ぐ）
let statusPromise: Promise<AnswerStatusMap> | null = null;

export function fetchAnswerStatuses(): Promise<AnswerStatusMap> {
	if (statusPromise) {
		return statusPromise;
	}

	// response.ok は全レスポンスで boolean のため .json() を成功型へ絞れない。status===200 で判別する。
	statusPromise = client.status
		.$get()
		.then(async (response) => (response.status === 200 ? (await response.json()).statuses : {}))
		.catch(() => ({}));

	return statusPromise;
}

export interface SaveAnswerInput {
	questionId: string;
	selectedLabel: string;
	isCorrect: boolean;
	duration?: number;
	setId?: string;
}

/**
 * 回答をサーバーに保存（fire-and-forget）。失敗しても学習体験は止めない。
 */
export async function saveAnswer(input: SaveAnswerInput): Promise<void> {
	// 採点イベントを発火（SRS / セッション / ホームが購読）。サーバー保存可否に関わらず常に通知する。
	const detail: QuestionGradedDetail = { questionId: input.questionId, isCorrect: input.isCorrect };
	document.dispatchEvent(new CustomEvent(QUESTION_GRADED_EVENT, { detail }));

	try {
		await client.submit.$post({
			json: {
				questionId: input.questionId,
				selectedLabel: input.selectedLabel,
				isCorrect: input.isCorrect,
				duration: input.duration,
				setId: input.setId,
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
export interface StopwatchSnapshot {
	durationSeconds?: number;
	setId?: string;
}

export function readStopwatchSnapshot(): StopwatchSnapshot {
	const widget = document.querySelector<HTMLElement>("[data-lap-stopwatch]");
	const seconds = Number(widget?.dataset.currentLapSeconds);
	return {
		durationSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
		setId: widget?.dataset.setId || undefined,
	};
}
