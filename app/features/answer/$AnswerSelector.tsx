import { useActionState, useEffect, useRef } from "hono/jsx";
import { recordAnswer, SavingIndicator } from "./answerActions";
import { fetchAnswerStatuses } from "./answerClient";
import { clearStatusChip, hideSolution, revealSolution, setStatusChip } from "./questionCardUi";

/**
 * 選択式（MCQ）問題の回答 island。
 *
 * 旧 AnswerSelector（src/features/answer）が握っていた「サーバー DOM のスクレイプ + 手動 render +
 * init 関数」は honox のオートハイドレーションに置き換わるため持ち込まない。代わりに island は
 * JSON シリアライズ可能な props（questionId / correctLabel / options）をルート JSX から受け取る。
 *
 * チラつき対策（SSR-first）: Panel を最初から selecting 状態で即マウントし、選択肢内容は
 * dangerouslySetInnerHTML で SSR HTML に直接描画する（ref-innerHTML 注入をやめる）。これで SSR 出力と
 * client 初期描画が一致しハイドレーションがズレない。
 *
 * カード（[data-question-card]）とその解説/チップは island の subtree 外にあるため rootRef（安定 ref）
 * から dispatch 時点で closest() で解決する。回答済み状態は useEffect で 1 回取得し、saved があれば
 * "restore" を dispatch して submitted へ「格下げ」する（記録はしない）。
 */

interface Option {
	label: string;
	html: string; // サーバー描画済みの選択肢内容（overline 等を含む）
}

// 状態は discriminated union。recorded は最初の採点だけ記録するためのフラグ。
type State =
	| { phase: "selecting"; selected: string | null; recorded: boolean }
	| { phase: "submitted"; selected: string; isCorrect: boolean; recorded: boolean };

type Event = "restore" | "select" | "submit" | "peek" | "retry";

/** 選択肢ボタンの状態クラスを状態から宣言的に導出する。 */
function optionClass(label: string, state: State, correctLabel: string): string {
	if (state.phase === "selecting") {
		return state.selected === label ? "q-option is-selected" : "q-option";
	}
	if (label === correctLabel) return "q-option is-correct";
	if (label === state.selected && !state.isCorrect) return "q-option is-wrong";
	return "q-option is-muted";
}

/**
 * 選択肢ボタン。サーバー生成済みの選択肢 HTML（overline 等）を SSR HTML に直接描画する
 * （ref-innerHTML 注入をやめ SSR-first にしてチラつきを防ぐ）。
 */
function OptionButton(props: { html: string; className: string; disabled: boolean }) {
	return (
		<button
			type="submit"
			class={props.className}
			disabled={props.disabled}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: サーバー生成済みの信頼済み選択肢HTML(overline等)を SSR-first で描画
			dangerouslySetInnerHTML={{ __html: props.html }}
		/>
	);
}

const INITIAL_STATE: State = { phase: "selecting", selected: null, recorded: false };

export interface AnswerSelectorProps {
	questionId: string;
	correctLabel: string;
	options: Option[];
}

export default function AnswerSelector(props: AnswerSelectorProps) {
	const { questionId, correctLabel, options } = props;
	// rootRef は安定参照。reducer は dispatch 時に rootRef から closest() で親カードを解決する。
	const rootRef = useRef<HTMLDivElement | null>(null);

	const [state, dispatch] = useActionState(
		async (prev: State, formData: FormData): Promise<State> => {
			const card = rootRef.current?.closest("[data-question-card]") ?? null;
			const recorded = formData.get("recorded") === "true";
			switch (formData.get("event") as Event) {
				case "restore": {
					// fetch 後の格下げ: saved を submitted へ反映する（記録はしない＝既存挙動）。
					const selected = String(formData.get("selected"));
					const isCorrect = formData.get("isCorrect") === "true";
					revealSolution(card);
					setStatusChip(card, isCorrect ? "correct" : "review");
					return { phase: "submitted", selected, isCorrect, recorded: true };
				}
				case "select":
					return { phase: "selecting", selected: String(formData.get("label")), recorded };
				case "submit": {
					const selected = String(formData.get("selected"));
					if (!selected) return prev;
					const isCorrect = selected === correctLabel;
					revealSolution(card);
					setStatusChip(card, isCorrect ? "correct" : "review");
					const next =
						recorded ||
						(await recordAnswer({ questionId, card, selectedLabel: selected, isCorrect }));
					return { phase: "submitted", selected, isCorrect, recorded: next };
				}
				case "peek": {
					// 「わからない」= 解けなかったとして正直に扱う。
					revealSolution(card);
					setStatusChip(card, "review");
					const next =
						recorded ||
						(await recordAnswer({ questionId, card, selectedLabel: "peek", isCorrect: false }));
					return { phase: "submitted", selected: "", isCorrect: false, recorded: next };
				}
				case "retry":
					hideSolution(card);
					clearStatusChip(card);
					return { phase: "selecting", selected: null, recorded };
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
			if (!saved) return; // 未回答なら selecting のまま（SSR-first）。
			// 回答済みは "restore" で submitted へ格下げ（記録はしない）。
			const formData = new FormData();
			formData.set("event", "restore");
			formData.set("selected", saved.label);
			formData.set("isCorrect", String(saved.isCorrect));
			dispatch(formData);
		});
		return () => {
			cancelled = true;
		};
		// マウント時に 1 回だけ回答済み状態を取得して復元する。
	}, [questionId]);

	const submitted = state.phase === "submitted";

	return (
		<div ref={rootRef} class="contents">
			{options.map((option) => (
				<form action={dispatch} class="q-answer-option-form">
					<input type="hidden" name="event" value="select" />
					<input type="hidden" name="label" value={option.label} />
					<input type="hidden" name="recorded" value={String(state.recorded)} />
					<OptionButton
						html={option.html}
						className={optionClass(option.label, state, correctLabel)}
						disabled={submitted}
					/>
				</form>
			))}

			{submitted ? (
				<div
					class={`q-feedback ${state.isCorrect ? "is-correct" : "is-review"}`}
					aria-live="polite"
				>
					{state.isCorrect
						? "正解！ この調子でいこう。"
						: "おしい。正解はこれ。解き方を見れば次は解ける。"}
				</div>
			) : null}

			{state.phase === "selecting" && state.selected ? (
				<form action={dispatch} class="q-answer-action">
					<input type="hidden" name="event" value="submit" />
					<input type="hidden" name="selected" value={state.selected} />
					<input type="hidden" name="recorded" value={String(state.recorded)} />
					<button type="submit" class="q-btn-primary mt-3">
						この答えで確かめる
					</button>
					<SavingIndicator label="採点中…" />
				</form>
			) : null}

			{state.phase === "selecting" ? (
				<form action={dispatch} class="q-answer-action">
					<input type="hidden" name="event" value="peek" />
					<input type="hidden" name="recorded" value={String(state.recorded)} />
					<button type="submit" class="q-btn-peek">
						わからない… 解き方を見る
					</button>
					<SavingIndicator label="採点中…" />
				</form>
			) : null}

			{submitted ? (
				<form action={dispatch} class="q-answer-action">
					<input type="hidden" name="event" value="retry" />
					<input type="hidden" name="recorded" value={String(state.recorded)} />
					<button type="submit" class="q-btn-outline">
						もう一度解く
					</button>
				</form>
			) : null}
		</div>
	);
}
