import { render, useActionState, useFormStatus } from "hono/jsx/dom";
import { fetchAnswerStatuses, readTimerDuration, saveAnswer } from "../../scripts/answerClient";
import {
	clearStatusChip,
	hideSolution,
	revealSolution,
	setStatusChip,
} from "../../scripts/questionCardUi";

/**
 * 記述式（選択肢なし）問題の自己採点。旧 self-grade Web Component の hono/jsx/dom 版。
 *
 * 純粋 Async React（React 19 フォームアクション）。useState / useRef を使わず、状態は唯一
 * useActionState が保持する。各 phase の UI は discriminated union（phase を判別子）から
 * 宣言的に導出し、遷移は `<form action={dispatch}>` の submit で起こす。採点の非同期保存中は
 * useFormStatus().pending が true になる。カードの解説/チップは外部 DOM なので命令的に同期する。
 *
 * selectedLabel に "self-correct" / "self-incorrect" を入れ、既存集計（isCorrect ベース）と整合させる。
 */

type Phase = "initial" | "revealed" | "graded";

// 状態は discriminated union（phase が判別子）。recorded は最初の採点だけ記録するためのフラグ。
type State =
	| { phase: "initial"; recorded: boolean }
	| { phase: "revealed"; recorded: boolean }
	| { phase: "graded"; recorded: boolean };

// 採点イベント（form の hidden input で渡す）。hono の form は submit ボタンの value を
// FormData に含めないため、value ではなく hidden input で event を渡す。
type Event = "reveal" | "correct" | "review" | "retry";

/** 各 phase に表示するアクションフォームの宣言的定義（条件分岐の代わりに DU からの導出）。 */
interface ActionDef {
	event: Event;
	btnClass: string;
	label: string;
	pending?: boolean; // 非同期保存中に「保存中…」を出すか
}
const PHASE_UI: Record<Phase, { wrapClass: string; actions: ActionDef[] }> = {
	initial: {
		wrapClass: "q-self-grade",
		actions: [{ event: "reveal", btnClass: "q-btn-primary", label: "答え合わせをする" }],
	},
	revealed: {
		wrapClass: "q-grade-row",
		actions: [
			{ event: "correct", btnClass: "q-btn-emerald", label: "合ってた", pending: true },
			{ event: "review", btnClass: "q-btn-amber", label: "もう一度やる", pending: true },
		],
	},
	graded: {
		wrapClass: "q-self-grade",
		actions: [{ event: "retry", btnClass: "q-btn-ghost", label: "もう一度この問題を解く" }],
	},
};

/** form 内で保存中インジケータを useFormStatus で購読する（Async React の pending）。 */
function SavingIndicator() {
	const { pending } = useFormStatus();
	return pending ? (
		<span data-pending class="q-saving">
			保存中…
		</span>
	) : null;
}

function SelfGradePanel(props: { questionId: string; card: Element | null; initial: State }) {
	const { questionId, card } = props;

	const [state, dispatch] = useActionState(
		async (prev: State, formData: FormData): Promise<State> => {
			switch (formData.get("event") as Event) {
				case "reveal":
					revealSolution(card);
					return { phase: "revealed", recorded: prev.recorded };
				case "retry":
					hideSolution(card);
					clearStatusChip(card);
					return { phase: "initial", recorded: prev.recorded };
				case "correct":
				case "review": {
					const isCorrect = formData.get("event") === "correct";
					setStatusChip(card, isCorrect ? "correct" : "review");
					const recorded = prev.recorded || (await record(questionId, card, isCorrect));
					return { phase: "graded", recorded };
				}
				default:
					return prev;
			}
		},
		props.initial,
	);

	const ui = PHASE_UI[state.phase];
	return (
		<div class={ui.wrapClass}>
			{ui.actions.map((action) => (
				<form action={dispatch} class="q-self-grade-form">
					<input type="hidden" name="event" value={action.event} />
					<button type="submit" class={action.btnClass}>
						{action.label}
					</button>
					{action.pending ? <SavingIndicator /> : null}
				</form>
			))}
		</div>
	);
}

/** 最初の採点をサーバーへ記録する。成功で true（記録済み）、失敗で false（再試行可能）を返す。 */
async function record(
	questionId: string,
	card: Element | null,
	isCorrect: boolean,
): Promise<boolean> {
	try {
		await saveAnswer({
			questionId,
			selectedLabel: isCorrect ? "self-correct" : "self-incorrect",
			isCorrect,
			duration: readTimerDuration(card),
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * `[data-self-grade]` 要素すべてに自己採点コンポーネントをマウントする。
 * 回答済み状態は 1 回だけ取得し、saved があるカードは DOM を命令的に復元してから graded で開始する。
 */
export async function initSelfGrade(): Promise<void> {
	const mounts = Array.from(document.querySelectorAll<HTMLElement>("[data-self-grade]"));
	if (mounts.length === 0) return;

	const statuses = await fetchAnswerStatuses();

	for (const el of mounts) {
		const questionId = el.dataset.questionId;
		if (!questionId) continue;
		const card = el.closest("[data-question-card]");
		const saved = statuses[questionId];

		if (saved) {
			revealSolution(card);
			setStatusChip(card, saved.isCorrect ? "correct" : "review");
		}

		const initial: State = saved
			? { phase: "graded", recorded: true }
			: { phase: "initial", recorded: false };
		render(<SelfGradePanel questionId={questionId} card={card} initial={initial} />, el);
	}
}
