import { useActionState, useEffect, useRef } from "hono/jsx";
import { recordAnswer, SavingIndicator } from "./answerActions";
import { fetchAnswerStatuses } from "./answerClient";
import { clearStatusChip, hideSolution, revealSolution, setStatusChip } from "./questionCardUi";

/**
 * 記述式（選択肢なし）問題の自己採点 island。
 *
 * AnswerSelector island と同じ構造（SSR-first）: Panel を最初から initial 状態で即マウントし、
 * 回答済み状態は useEffect で 1 回取得して saved があれば "restore" を dispatch し graded へ「格下げ」する
 * （記録はしない）。これで SSR 出力と client 初期描画が一致しチラつかない。
 *
 * カード（[data-question-card]）とその解説/チップは island の subtree 外にあるため rootRef（安定 ref）
 * から dispatch 時点で closest() で解決する。
 *
 * 純粋 Async React（discriminated union）。各 phase の UI は phase から宣言的に導出し、遷移は
 * <form action={dispatch}> の submit で起こす。採点の非同期保存中は useFormStatus().pending。
 * selectedLabel に "self-correct" / "self-incorrect" を入れ、既存集計（isCorrect ベース）と整合させる。
 */

type Phase = "initial" | "revealed" | "graded";

// 状態は discriminated union（phase が判別子）。recorded は最初の採点だけ記録するためのフラグ。
type State = { phase: Phase; recorded: boolean };

// 採点イベント（form の hidden input で渡す）。hono の form は submit ボタンの value を
// FormData に含めないため、value ではなく hidden input で event を渡す。
type Event = "restore" | "reveal" | "correct" | "review" | "retry";

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

const INITIAL_STATE: State = { phase: "initial", recorded: false };

export interface SelfGradeProps {
	questionId: string;
}

export default function SelfGrade(props: SelfGradeProps) {
	const { questionId } = props;
	// rootRef は安定参照。reducer は dispatch 時に rootRef から closest() で親カードを解決する。
	const rootRef = useRef<HTMLDivElement | null>(null);

	const [state, dispatch] = useActionState(
		async (prev: State, formData: FormData): Promise<State> => {
			const card = rootRef.current?.closest("[data-question-card]") ?? null;
			const recorded = formData.get("recorded") === "true";
			switch (formData.get("event") as Event) {
				case "restore": {
					// fetch 後の格下げ: saved を graded へ反映する（記録はしない＝既存挙動）。
					const isCorrect = formData.get("isCorrect") === "true";
					revealSolution(card);
					setStatusChip(card, isCorrect ? "correct" : "review");
					return { phase: "graded", recorded: true };
				}
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
						(await recordAnswer({
							questionId,
							card,
							selectedLabel: isCorrect ? "self-correct" : "self-incorrect",
							isCorrect,
						}));
					return { phase: "graded", recorded: next };
				}
				default:
					return prev;
			}
		},
		INITIAL_STATE,
	);

	useEffect(() => {
		let cancelled = false;
		fetchAnswerStatuses().then((statuses) => {
			if (cancelled) return;
			const saved = statuses[questionId];
			if (!saved) return; // 未回答なら initial のまま（SSR-first）。
			// 回答済みは "restore" で graded へ格下げ（記録はしない）。
			const formData = new FormData();
			formData.set("event", "restore");
			formData.set("isCorrect", String(saved.isCorrect));
			dispatch(formData);
		});
		return () => {
			cancelled = true;
		};
		// マウント時に 1 回だけ回答済み状態を取得して復元する。
	}, [questionId]);

	const ui = PHASE_UI[state.phase];
	return (
		<div ref={rootRef} class="contents">
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
		</div>
	);
}
