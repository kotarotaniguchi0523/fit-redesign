import { useActionState, useEffect } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { recordAnswer, SavingIndicator } from "./answerActions";
import { fetchAnswerStatuses } from "./answerClient";
import { SolutionPanel } from "./SolutionPanel";

/**
 * 記述式（選択肢なし）問題の自己採点 island。
 *
 * AnswerSelector island と同じ構造（SSR-first）: Panel を最初から initial 状態で即マウントし、
 * 回答済み状態は useEffect で 1 回取得して saved があれば "restore" を dispatch し graded へ「格下げ」する
 * （記録はしない）。これで SSR 出力と client 初期描画が一致しチラつかない。
 *
 * 解答時間はページ唯一のラップ式ストップウォッチ（[data-lap-stopwatch]）から recordAnswer が
 * 読むため、カード要素への参照は持たない。
 *
 * 純粋 Async React（discriminated union）。各 phase の UI は phase から宣言的に導出し、遷移は
 * <form action={dispatch}> の submit で起こす。採点の非同期保存中は useFormStatus().pending。
 * selectedLabel に "self-correct" / "self-incorrect" を入れ、既存集計（isCorrect ベース）と整合させる。
 */

type Phase = "initial" | "revealed" | "graded";

// 状態は discriminated union（phase が判別子）。recorded は最初の採点だけ記録するためのフラグ。
// graded は採点結果（isCorrect）を保持し、チップ表示を状態から純粋に導出できるようにする。
type State =
	| { phase: "initial"; recorded: boolean }
	| { phase: "revealed"; recorded: boolean }
	| { phase: "graded"; isCorrect: boolean; recorded: boolean };

// 採点イベント（form の hidden input で渡す）。hono の form は submit ボタンの value を
// FormData に含めないため、value ではなく hidden input で event を渡す。
type SelfGradeEvent = "restore" | "reveal" | "correct" | "review" | "retry";
type Chip = "correct" | "review";

interface CardView {
	solution: boolean;
	chip: Chip | null;
}

const CHIP_TEXT: Record<Chip, string> = {
	correct: "✓ できた",
	review: "あとで復習",
};

/** 各 phase に表示するアクションフォームの宣言的定義（条件分岐の代わりに DU からの導出）。 */
interface ActionDef {
	event: SelfGradeEvent;
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

/** 状態から採点チップと解説パネルの表示を導出する。 */
function cardView(state: State): CardView {
	if (state.phase === "initial") {
		return { solution: false, chip: null };
	}
	if (state.phase === "revealed") {
		return { solution: true, chip: null };
	}
	return { solution: true, chip: state.isCorrect ? "correct" : "review" };
}

export interface SelfGradeProps {
	questionId: string;
	answerHtml: string;
	explanationHtml?: string;
}

export default function SelfGrade(props: SelfGradeProps): JSX.Element {
	const { questionId, answerHtml, explanationHtml } = props;

	const [state, dispatch] = useActionState(
		async (prev: State, formData: FormData): Promise<State> => {
			const recorded = formData.get("recorded") === "true";
			// FormData の値（string | File | null）を直接 switch する。case のリテラルで型が絞られ、
			// 不正値・null は default（prev 維持）へ落ちるため as キャストは不要。
			switch (formData.get("event")) {
				case "restore": {
					// fetch 後の格下げ: saved を graded へ反映する（記録はしない＝既存挙動）。
					const next: State = {
						phase: "graded",
						isCorrect: formData.get("isCorrect") === "true",
						recorded: true,
					};
					return next;
				}
				case "reveal": {
					const next: State = { phase: "revealed", recorded };
					return next;
				}
				case "retry": {
					const next: State = { phase: "initial", recorded };
					return next;
				}
				case "correct":
				case "review": {
					const isCorrect = formData.get("event") === "correct";
					const next: State = { phase: "graded", isCorrect, recorded };
					return {
						...next,
						recorded:
							recorded ||
							(await recordAnswer({
								questionId,
								selectedLabel: isCorrect ? "self-correct" : "self-incorrect",
								isCorrect,
							})),
					};
				}
				default:
					return prev;
			}
		},
		INITIAL_STATE,
	);

	useEffect(() => {
		let cancelled = false;
		fetchAnswerStatuses()
			.then((statuses) => {
				if (cancelled) {
					return;
				}
				const saved = statuses[questionId];
				if (!saved) {
					return; // 未回答なら initial のまま（SSR-first）。
				}
				// 回答済みは "restore" で graded へ格下げ（記録はしない）。
				const formData = new FormData();
				formData.set("event", "restore");
				formData.set("isCorrect", String(saved.isCorrect));
				dispatch(formData);
			})
			.catch(() => {
				/* SSR-first: 取得失敗時は初期状態のまま */
			});
		return (): void => {
			cancelled = true;
		};
		// マウント時に 1 回だけ回答済み状態を取得して復元する。
	}, [questionId]);

	const ui = PHASE_UI[state.phase];
	const view = cardView(state);
	return (
		<div class="contents">
			{view.chip ? (
				<div class={`q-chip ${view.chip === "correct" ? "q-chip--correct" : "q-chip--review"}`}>
					{CHIP_TEXT[view.chip]}
				</div>
			) : null}

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
			{view.solution ? (
				<SolutionPanel answerHtml={answerHtml} explanationHtml={explanationHtml} />
			) : null}
		</div>
	);
}
