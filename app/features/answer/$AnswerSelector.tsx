import { useActionState, useEffect, useRef, useState } from "hono/jsx";
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
 * カード（[data-question-card]）とその解説/チップは island の subtree 外にあるため island の DOM が
 * 持てない。外側の AnswerSelector が closest() で親カードを解決し、回答済み状態を 1 回だけ取得して
 * 初期 phase を確定させてから、内側 Panel（useActionState を持つ）をマウントする。これで
 * useActionState の initial（マウント時にキャプチャされる）が確定値になり、復元と整合する。
 */

interface Option {
	label: string;
	html: string; // サーバー描画済みの選択肢内容（overline 等を含む）
}

// 状態は discriminated union。recorded は最初の採点だけ記録するためのフラグ。
type State =
	| { phase: "selecting"; selected: string | null; recorded: boolean }
	| { phase: "submitted"; selected: string; isCorrect: boolean; recorded: boolean };

type Event = "select" | "submit" | "peek" | "retry";

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
 * 選択肢ボタン。サーバー生成済みの選択肢 HTML（overline 等）を ref で innerHTML に設定する
 * （dangerouslySetInnerHTML を避け、内容はマウント時 1 回だけ流し込む）。
 */
function OptionButton(props: { html: string; className: string; disabled: boolean }) {
	const setHtml = (el: HTMLButtonElement | null) => {
		if (el && el.innerHTML !== props.html) el.innerHTML = props.html;
	};
	return <button type="submit" class={props.className} disabled={props.disabled} ref={setHtml} />;
}

function AnswerSelectorPanel(props: {
	questionId: string;
	correctLabel: string;
	options: Option[];
	card: Element | null;
	initial: State;
}) {
	const { questionId, correctLabel, options, card } = props;

	const [state, dispatch] = useActionState(
		async (prev: State, formData: FormData): Promise<State> => {
			const recorded = formData.get("recorded") === "true";
			switch (formData.get("event") as Event) {
				case "select":
					return { phase: "selecting", selected: String(formData.get("label")), recorded };
				case "submit": {
					const selected = String(formData.get("selected"));
					if (!selected) return prev;
					const isCorrect = selected === correctLabel;
					revealSolution(card);
					setStatusChip(card, isCorrect ? "correct" : "review");
					const next = recorded || (await recordAnswer(questionId, card, selected, isCorrect));
					return { phase: "submitted", selected, isCorrect, recorded: next };
				}
				case "peek": {
					// 「わからない」= 解けなかったとして正直に扱う。
					revealSolution(card);
					setStatusChip(card, "review");
					const next = recorded || (await recordAnswer(questionId, card, "peek", false));
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
		props.initial,
	);

	const submitted = state.phase === "submitted";

	return (
		<>
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
		</>
	);
}

export interface AnswerSelectorProps {
	questionId: string;
	correctLabel: string;
	options: Option[];
}

export default function AnswerSelector(props: AnswerSelectorProps) {
	const { questionId, correctLabel, options } = props;

	const rootRef = useRef<HTMLDivElement | null>(null);
	// card 解決 + 回答済み状態取得が完了するまで Panel をマウントしない（initial を確定させるため）。
	const [resolved, setResolved] = useState<{ card: Element | null; initial: State } | null>(null);

	useEffect(() => {
		const card = rootRef.current?.closest("[data-question-card]") ?? null;
		let cancelled = false;
		fetchAnswerStatuses().then((statuses) => {
			if (cancelled) return;
			const saved = statuses[questionId];
			if (saved) {
				revealSolution(card);
				setStatusChip(card, saved.isCorrect ? "correct" : "review");
				setResolved({
					card,
					initial: {
						phase: "submitted",
						selected: saved.label,
						isCorrect: saved.isCorrect,
						recorded: true,
					},
				});
			} else {
				setResolved({ card, initial: { phase: "selecting", selected: null, recorded: false } });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [questionId]);

	return (
		<div ref={rootRef} class="contents">
			{resolved ? (
				<AnswerSelectorPanel
					questionId={questionId}
					correctLabel={correctLabel}
					options={options}
					card={resolved.card}
					initial={resolved.initial}
				/>
			) : null}
		</div>
	);
}
