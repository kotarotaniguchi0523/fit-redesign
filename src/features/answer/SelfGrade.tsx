import { render, useActionState } from "hono/jsx/dom";
import { recordAnswer, SavingIndicator } from "./answerActions";
import { fetchAnswerStatuses } from "./answerClient";
import { clearStatusChip, hideSolution, revealSolution, setStatusChip } from "./questionCardUi";

/**
 * 記述式（選択肢なし）問題の自己採点。旧 self-grade Web Component の hono/jsx/dom 版。
 *
 * 純粋 Async React（React 19 フォームアクション）。useState / useRef を使わず、状態は唯一
 * useActionState が保持する。各 phase の UI は discriminated union（phase を判別子）から
 * 宣言的に導出し、遷移は `<form action={dispatch}>` の submit で起こす。採点の非同期保存中は
 * useFormStatus().pending が true になる。カードの解説/チップは外部 DOM なので命令的に同期する。
 *
 * 可変 state（recorded）は hono の stale-prev を避けるため hidden input から読む（AnswerSelector と同様）。
 * selectedLabel に "self-correct" / "self-incorrect" を入れ、既存集計（isCorrect ベース）と整合させる。
 */

type Phase = "initial" | "revealed" | "graded";

// 状態は discriminated union（phase が判別子）。recorded は最初の採点だけ記録するためのフラグ。
type State = { phase: Phase; recorded: boolean };

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

function SelfGradePanel(props: { questionId: string; card: Element | null; initial: State }) {
	const { questionId, card } = props;

	const [state, dispatch] = useActionState(
		async (prev: State, formData: FormData): Promise<State> => {
			const recorded = formData.get("recorded") === "true";
			switch (formData.get("event") as Event) {
				case "reveal":
					revealSolution(card);
					return { phase: "revealed", recorded };
				case "retry":
					hideSolution(card);
					clearStatusChip(card);
					return { phase: "initial", recorded };
				case "correct":
				case "review": {
					const isCorrect = formData.get("event") === "correct";
					setStatusChip(card, isCorrect ? "correct" : "review");
					const next =
						recorded ||
						(await recordAnswer(
							questionId,
							card,
							isCorrect ? "self-correct" : "self-incorrect",
							isCorrect,
						));
					return { phase: "graded", recorded: next };
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
					<input type="hidden" name="recorded" value={String(state.recorded)} />
					<button type="submit" class={action.btnClass}>
						{action.label}
					</button>
					{action.pending ? <SavingIndicator label="保存中…" /> : null}
				</form>
			))}
		</div>
	);
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
