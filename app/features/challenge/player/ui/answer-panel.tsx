import type { Handle } from "remix/component";
import { on, unsafeHTML } from "remix/component";

import { overlineToHtml } from "../../../../lib/overline.ts";
import type { Judgment } from "../../../../types/index.ts";
import type { PlayerQuestion } from "../types.ts";

/**
 * 解答・解説と自己判定。
 * 解答本文は `overlineToHtml` が生成した限定 HTML のみを許可して描画する。
 */
export function AnswerPanel(
	handle: Handle<{
		question: PlayerQuestion;
		isOpen: boolean;
		judgment: Judgment | undefined;
		onJudge: (judgment: Judgment) => void;
	}>,
) {
	return () => {
		const { question, isOpen, judgment, onJudge } = handle.props;
		if (!isOpen) {
			return null;
		}

		return (
			<section
				class="exam-answer exam-answer--entered"
				id="exam-answer"
				aria-labelledby="exam-answer-heading"
				aria-live="polite"
			>
				<div class="exam-answer__body" aria-live="polite">
					<h3 class="exam-answer__label" id="exam-answer-heading">
						解答
					</h3>
					<p innerHTML={unsafeHTML(overlineToHtml(question.answer))} />
					{question.explanation ? (
						<>
							<p class="exam-answer__label">解説</p>
							<p innerHTML={unsafeHTML(overlineToHtml(question.explanation))} />
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
							mix={on("click", () => onJudge("correct"))}
						>
							○
						</button>
						<button
							type="button"
							class={`judgment-button judgment-button--incorrect ${judgment === "incorrect" ? "is-selected" : ""}`}
							aria-label="不正解として記録"
							aria-pressed={judgment === "incorrect" ? "true" : "false"}
							disabled={judgment !== undefined}
							mix={on("click", () => onJudge("incorrect"))}
						>
							×
						</button>
					</fieldset>
				</div>
			</section>
		);
	};
}
