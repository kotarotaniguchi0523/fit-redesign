import { useEffect, useState } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { overlineToHtml } from "../../../lib/overline";
import type { Judgment } from "../../../types";
import type { PlayerQuestion } from "./types";

export function AnswerPanel({
	question,
	isOpen,
	judgment,
	onJudge,
}: Readonly<{
	question: PlayerQuestion;
	isOpen: boolean;
	judgment: Judgment | undefined;
	onJudge: (judgment: Judgment) => void;
}>): JSX.Element | null {
	const [hasEntered, setHasEntered] = useState(false);
	useEffect((): (() => void) | undefined => {
		if (!isOpen) {
			setHasEntered(false);
			return;
		}

		const frame = requestAnimationFrame(() => setHasEntered(true));
		return () => cancelAnimationFrame(frame);
	}, [isOpen]);

	if (!isOpen) {
		return null;
	}
	return (
		<section
			class={`exam-answer${hasEntered ? " exam-answer--entered" : ""}`}
			id="exam-answer"
			aria-labelledby="exam-answer-heading"
			aria-live="polite"
		>
			<div class="exam-answer__body" aria-live="polite">
				<h3 class="exam-answer__label" id="exam-answer-heading">
					解答
				</h3>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */}
				<p dangerouslySetInnerHTML={{ __html: overlineToHtml(question.answer) }} />
				{question.explanation ? (
					<>
						<p class="exam-answer__label">解説</p>
						{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */}
						<p dangerouslySetInnerHTML={{ __html: overlineToHtml(question.explanation) }} />
					</>
				) : null}
				<fieldset class="exam-judgment">
					<legend class="sr-only">自己判定</legend>
					<button
						type="button"
						class={`judgment-button judgment-button--correct ${judgment === "correct" ? "is-selected" : ""}`}
						aria-label="正解として記録"
						aria-pressed={judgment === "correct" ? "true" : "false"}
						disabled={judgment !== undefined}
						onClick={(): void => onJudge("correct")}
					>
						○
					</button>
					<button
						type="button"
						class={`judgment-button judgment-button--incorrect ${judgment === "incorrect" ? "is-selected" : ""}`}
						aria-label="不正解として記録"
						aria-pressed={judgment === "incorrect" ? "true" : "false"}
						disabled={judgment !== undefined}
						onClick={(): void => onJudge("incorrect")}
					>
						×
					</button>
				</fieldset>
			</div>
		</section>
	);
}
