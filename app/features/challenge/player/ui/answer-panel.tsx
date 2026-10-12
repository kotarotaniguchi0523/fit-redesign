import { animateEntrance, spring } from "@remix-run/ui/animation";
import * as toggle from "@remix-run/ui/toggle";
import type { Handle } from "remix/component";
import { css, unsafeHTML } from "remix/component";

import { overlineToHtml } from "../../../../lib/overline.ts";
import type { Judgment } from "../../../../types/index.ts";
import type { PlayerQuestion } from "../types.ts";

const panelStyle = css({
	marginTop: "1rem",
	padding: "1rem 1.25rem",
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderLeft: "3px solid var(--color-accent)",
	borderRadius: "var(--radius-card)",
});

const labelStyle = css({
	fontSize: "0.8rem",
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: "var(--color-text-muted)",
	margin: "0 0 0.25rem",
});

const bodyStyle = css({
	"& p": { whiteSpace: "pre-wrap", lineHeight: 1.9, margin: "0 0 0.75rem" },
});

const judgmentRowStyle = css({
	display: "flex",
	gap: "0.75rem",
	margin: "1rem 0 0",
	padding: 0,
	border: 0,
});

const judgmentButtonStyle = css({
	width: "3rem",
	height: "3rem",
	borderRadius: "999px",
	border: "1px solid var(--color-border)",
	background: "var(--color-bg-card)",
	fontSize: "1.25rem",
	cursor: "pointer",
	"&:disabled": { cursor: "default", opacity: 0.7 },
});

const correctSelectedStyle = css({
	borderColor: "var(--color-primary)",
	background: "var(--color-primary-soft)",
	color: "var(--color-primary)",
});

const incorrectSelectedStyle = css({
	borderColor: "#b91c1c",
	background: "#fee2e2",
	color: "#7f1d1d",
});

/**
 * 解答・解説と自己判定。
 * 開閉の進入は `@remix-run/ui/animation`、判定は `@remix-run/ui/toggle` の
 * 振る舞いを `mix` で借り、見た目は `css()` で当てる。
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
				id="exam-answer"
				aria-labelledby="exam-answer-heading"
				aria-live="polite"
				mix={[panelStyle, animateEntrance({ opacity: 0, ...spring("snappy") })]}
			>
				<div mix={bodyStyle}>
					<h3 mix={labelStyle} id="exam-answer-heading">
						解答
					</h3>
					<p innerHTML={unsafeHTML(overlineToHtml(question.answer))} />
					{question.explanation ? (
						<>
							<p mix={labelStyle}>解説</p>
							<p innerHTML={unsafeHTML(overlineToHtml(question.explanation))} />
						</>
					) : null}
					<fieldset mix={judgmentRowStyle}>
						<legend class="sr-only">自己判定</legend>
						<button
							type="button"
							mix={[
								judgmentButtonStyle,
								judgment === "correct" ? correctSelectedStyle : null,
								toggle.control({
									checked: judgment === "correct",
									onCheckedChange: () => onJudge("correct"),
									disabled: judgment !== undefined,
								}),
							]}
							aria-label="正解として記録"
						>
							○
						</button>
						<button
							type="button"
							mix={[
								judgmentButtonStyle,
								judgment === "incorrect" ? incorrectSelectedStyle : null,
								toggle.control({
									checked: judgment === "incorrect",
									onCheckedChange: () => onJudge("incorrect"),
									disabled: judgment !== undefined,
								}),
							]}
							aria-label="不正解として記録"
						>
							×
						</button>
					</fieldset>
				</div>
			</section>
		);
	};
}
