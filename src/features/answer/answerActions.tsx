import { useFormStatus } from "hono/jsx/dom";
import { readTimerDuration, saveAnswer } from "../../scripts/answerClient";

/**
 * 採点フォーム共有部品。self-grade / answer-selector の両方が使う Async React の pending 表示と、
 * 「最初の採点だけサーバー記録する」非同期保存ヘルパー。
 */

/** form 内で保存中インジケータを useFormStatus で購読する（form action の await 中 true）。 */
export function SavingIndicator({ label }: { label: string }) {
	const { pending } = useFormStatus();
	return pending ? (
		<span data-pending class="q-saving">
			{label}
		</span>
	) : null;
}

/** 採点結果をサーバーへ記録する。成功で true（記録済み）、失敗で false（再試行可能）を返す。 */
export async function recordAnswer(
	questionId: string,
	card: Element | null,
	selectedLabel: string,
	isCorrect: boolean,
): Promise<boolean> {
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
	}
}
