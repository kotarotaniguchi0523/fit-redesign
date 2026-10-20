import type { JSX } from "hono/jsx/jsx-runtime";
import type { DeepReadonly } from "../lib/immutable";
import { overlineToHtml } from "../lib/overline";
import type { Question } from "../types";
import { Figure } from "./figures/Figure";

type QuestionContentVariant = "question-set" | "exam-player";

const classesByVariant = {
	"question-set": {
		text: "q-text",
		figure: "q-figure-wrap",
		figureFallback: "q-figure-fallback",
		options: "q-options",
		option: "q-option",
		optionLabel: "q-option__label",
	},
	"exam-player": {
		text: "exam-question__text",
		figure: "exam-question__figure",
		figureFallback: "exam-question__figure-fallback",
		options: "exam-question__options",
		option: "exam-question__option",
		optionLabel: "exam-question__option-label",
	},
} as const;

interface QuestionContentProps {
	question: DeepReadonly<Question>;
	variant: QuestionContentVariant;
}

/** 問題文・図表・選択肢の共通描画。配置や操作は呼び出し元の画面が担う。 */
export function QuestionContent({ question, variant }: QuestionContentProps): JSX.Element {
	const classes = classesByVariant[variant];
	const questionText = (
		<div
			class={classes.text}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML
			dangerouslySetInnerHTML={{ __html: overlineToHtml(question.text) }}
		/>
	);
	const prompt =
		variant === "question-set" ? (
			<div class="q-prompt">
				<h2 class="sr-only">問{question.number}</h2>
				<div class="q-text-wrap">{questionText}</div>
			</div>
		) : (
			<>
				<h3 class="sr-only">問{question.number}</h3>
				{questionText}
			</>
		);
	const figure = question.figureData ? (
		<div class={classes.figure}>
			<Figure data={question.figureData as NonNullable<Question["figureData"]>} />
		</div>
	) : null;
	const figureFallback =
		!question.figureData && question.figureDescription ? (
			<div class={classes.figureFallback}>
				<strong>図:</strong>{" "}
				<span
					// biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML
					dangerouslySetInnerHTML={{ __html: overlineToHtml(question.figureDescription) }}
				/>
			</div>
		) : null;

	return (
		<>
			{prompt}
			{figure ?? figureFallback}
			{question.options?.length ? (
				<ol class={classes.options} aria-label="選択肢">
					{question.options.map((option) => (
						<li class={classes.option}>
							<span class={classes.optionLabel}>{option.label}</span>
							<span
								// biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML
								dangerouslySetInnerHTML={{
									__html: overlineToHtml(option.value || "(選択肢未入力)"),
								}}
							/>
						</li>
					))}
				</ol>
			) : null}
		</>
	);
}
