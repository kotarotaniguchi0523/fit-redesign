import { render, useActionState } from "hono/jsx/dom";
import { recordAnswer, SavingIndicator } from "./answerActions";
import { fetchAnswerStatuses } from "./answerClient";
import { clearStatusChip, hideSolution, revealSolution, setStatusChip } from "./questionCardUi";

/**
 * 選択式（MCQ）問題の回答。旧 answer-selector Web Component の hono/jsx/dom 版。
 *
 * 純粋 Async React（React 19 フォームアクション）。useState / useRef を使わず、状態は唯一
 * useActionState が保持する。状態は discriminated union（phase 判別子）。選択肢のスタイルと
 * フィードバックは状態から宣言的に導出する。採点/peek の非同期保存中は useFormStatus().pending。
 * カードの解説/チップは外部 DOM なので questionCardUi で命令的に同期する。
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

	// hono の form action は onSubmit がマウント時の dispatch をキャプチャするため、
	// useActionState の accumulated state（prev）は stale になりうる。可変データは
	// 各 form の hidden input から（= 描画時点の現 state を）読み、prev に依存しない。
	// state は setState 結果なので描画には正しく反映される（hidden input に現値を埋める）。
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

/** サーバー描画済みの `[data-option]` から選択肢データを読む。 */
function readOptions(el: HTMLElement): Option[] {
	return Array.from(el.querySelectorAll<HTMLElement>(":scope > [data-option]")).map((div) => ({
		label: div.querySelector("span:first-child")?.textContent?.trim() ?? "",
		html: div.innerHTML,
	}));
}

/** `[data-answer-selector]` 要素すべてに MCQ コンポーネントをマウントする。 */
export async function initAnswerSelector(): Promise<void> {
	const mounts = Array.from(document.querySelectorAll<HTMLElement>("[data-answer-selector]"));
	if (mounts.length === 0) return;

	const statuses = await fetchAnswerStatuses();

	for (const el of mounts) {
		const questionId = el.dataset.questionId;
		const correctLabel = el.dataset.correctLabel;
		if (!questionId || !correctLabel) continue;
		const card = el.closest("[data-question-card]");
		const options = readOptions(el);
		const saved = statuses[questionId];

		let initial: State;
		if (saved) {
			revealSolution(card);
			setStatusChip(card, saved.isCorrect ? "correct" : "review");
			initial = {
				phase: "submitted",
				selected: saved.label,
				isCorrect: saved.isCorrect,
				recorded: true,
			};
		} else {
			initial = { phase: "selecting", selected: null, recorded: false };
		}

		render(
			<AnswerSelectorPanel
				questionId={questionId}
				correctLabel={correctLabel}
				options={options}
				card={card}
				initial={initial}
			/>,
			el,
		);
	}
}
