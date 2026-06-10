import { useFormStatus } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { readTimerDuration, saveAnswer } from "./answerClient";

/**
 * 採点フォーム共有部品。self-grade / answer-selector の両方が使う Async React の pending 表示と、
 * 「最初の採点だけサーバー記録する」非同期保存ヘルパー。
 */

/** form 内で保存中インジケータを useFormStatus で購読する（form action の await 中 true）。 */
export function SavingIndicator({ label }: { label: string }): JSX.Element | null {
	const { pending } = useFormStatus();
	return pending ? (
		<span data-pending class="q-saving">
			{label}
		</span>
	) : null;
}

// 同一 questionId への記録が進行中かを同期的に追跡する。useFormStatus().pending は描画専用で
// ボタンを disabled にしないため、別フォーム（採点/わからない）の二重 click を防げない。
// await の前に同期的にマークし、進行中なら skip して重複 INSERT / SRS の二重加算を防ぐ。
const inFlight = new Set<string>();

export interface RecordAnswerInput {
	questionId: string;
	card: Element | null;
	selectedLabel: string;
	isCorrect: boolean;
}

/** 採点結果をサーバーへ記録する。成功で true（記録済み）、失敗/重複 skip で false を返す。 */
export async function recordAnswer(input: RecordAnswerInput): Promise<boolean> {
	const { questionId, card, selectedLabel, isCorrect } = input;
	if (inFlight.has(questionId)) {
		return false;
	}
	inFlight.add(questionId);
	try {
		await saveAnswer({
			questionId,
			selectedLabel,
			isCorrect,
			duration: readTimerDuration(card),
		});
		return true;
	} catch {
		return false;
	} finally {
		inFlight.delete(questionId);
	}
}
