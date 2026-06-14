import { useActionState, useEffect } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { recordAnswer, SavingIndicator } from "./answerActions";
import { fetchAnswerStatuses } from "./answerClient";
import { SolutionPanel } from "./SolutionPanel";

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
 * 回答済み状態は useEffect で 1 回取得し、saved があれば "restore" を dispatch して
 * submitted へ「格下げ」する（記録はしない）。解答時間はページ唯一のラップ式ストップウォッチ
 * （[data-lap-stopwatch]）から recordAnswer が読むため、カード要素への参照は持たない。
 */

interface Option {
	label: string;
	html: string; // サーバー描画済みの選択肢内容（overline 等を含む）
}

// 状態は discriminated union。recorded は最初の採点だけ記録するためのフラグ。
type State =
	| { phase: "selecting"; selected: string | null; recorded: boolean }
	| { phase: "submitted"; selected: string; isCorrect: boolean; recorded: boolean };

type Chip = "correct" | "review";

interface CardView {
	solution: boolean;
	chip: Chip | null;
}

const CHIP_TEXT: Record<Chip, string> = {
	correct: "✓ できた",
	review: "あとで復習",
};

/** 選択肢ボタンの状態クラスを状態から宣言的に導出する。 */
function optionClass(label: string, state: State, correctLabel: string): string {
	if (state.phase === "selecting") {
		return state.selected === label ? "q-option is-selected" : "q-option";
	}
	if (label === correctLabel) {
		return "q-option is-correct";
	}
	if (label === state.selected && !state.isCorrect) {
		return "q-option is-wrong";
	}
	return "q-option is-muted";
}

/** 状態から採点チップと解説パネルの表示を導出する。 */
function cardView(state: State): CardView {
	if (state.phase === "selecting") {
		return { solution: false, chip: null };
	}
	return { solution: true, chip: state.isCorrect ? "correct" : "review" };
}

/**
 * 選択肢ボタン。サーバー生成済みの選択肢 HTML（overline 等）を SSR HTML に直接描画する
 * （ref-innerHTML 注入をやめ SSR-first にしてチラつきを防ぐ）。
 */
function OptionButton(props: { html: string; className: string; disabled: boolean }): JSX.Element {
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
	answerHtml: string;
	explanationHtml?: string;
}

export default function AnswerSelector(props: AnswerSelectorProps): JSX.Element {
	const { questionId, correctLabel, options, answerHtml, explanationHtml } = props;

	const [state, dispatch] = useActionState(
		async (prev: State, formData: FormData): Promise<State> => {
			const recorded = formData.get("recorded") === "true";
			// FormData の値（string | File | null）を直接 switch する。case のリテラルで型が絞られ、
			// 不正値・null は default（prev 維持）へ落ちるため as キャストは不要。
			switch (formData.get("event")) {
				case "restore": {
					// fetch 後の格下げ: saved を submitted へ反映する（記録はしない＝既存挙動）。
					const next: State = {
						phase: "submitted",
						selected: String(formData.get("selected")),
						isCorrect: formData.get("isCorrect") === "true",
						recorded: true,
					};
					return next;
				}
				case "select": {
					const next: State = {
						phase: "selecting",
						selected: String(formData.get("label")),
						recorded,
					};
					return next;
				}
				case "submit": {
					const selected = String(formData.get("selected"));
					if (!selected) {
						return prev;
					}
					const next: State = {
						phase: "submitted",
						selected,
						isCorrect: selected === correctLabel,
						recorded,
					};
					return {
						...next,
						recorded:
							recorded ||
							(await recordAnswer({
								questionId,
								selectedLabel: selected,
								isCorrect: next.isCorrect,
							})),
					};
				}
				case "peek": {
					// 「わからない」= 解けなかったとして正直に扱う。
					const next: State = { phase: "submitted", selected: "", isCorrect: false, recorded };
					return {
						...next,
						recorded:
							recorded ||
							(await recordAnswer({ questionId, selectedLabel: "peek", isCorrect: false })),
					};
				}
				case "retry": {
					const next: State = { phase: "selecting", selected: null, recorded };
					return next;
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
					return; // 未回答なら selecting のまま（SSR-first）。
				}
				// 回答済みは "restore" で submitted へ格下げ（記録はしない）。
				const formData = new FormData();
				formData.set("event", "restore");
				formData.set("selected", saved.label);
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

	const submitted = state.phase === "submitted";
	const view = cardView(state);

	return (
		<div class="contents">
			{view.chip ? (
				<div class={`q-chip ${view.chip === "correct" ? "q-chip--correct" : "q-chip--review"}`}>
					{CHIP_TEXT[view.chip]}
				</div>
			) : null}

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

			{view.solution ? (
				<SolutionPanel answerHtml={answerHtml} explanationHtml={explanationHtml} />
			) : null}
		</div>
	);
}
