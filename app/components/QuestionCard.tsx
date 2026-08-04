/** @jsxImportSource hono/jsx */

import type { JSX } from "hono/jsx/jsx-runtime";
import SolutionReveal from "../features/answer/$SolutionReveal";
import { questionToMarkdown } from "../features/markdown/questionToMarkdown";
import { overlineToHtml } from "../lib/overline";
import type { Question, UnitTabId } from "../types";
import CopyButton from "./$CopyButton";
import { Figure } from "./figures/Figure";

/** 問題、図表、答え確認、Markdownコピーをまとめて表示する。 */

interface Props {
	question: Question;
	unitId: UnitTabId;
}

interface QuestionView {
	markdownText: string;
	hasOptions: boolean;
	figure: JSX.Element | null;
	answerHtml: string;
	explanationHtml: string | undefined;
	options: { label: string; html: string }[];
}

function buildQuestionView(question: Question): QuestionView {
	const hasOptions = (question.options?.length ?? 0) > 0;
	const answerHtml = overlineToHtml(question.answer);
	const explanationHtml = question.explanation ? overlineToHtml(question.explanation) : undefined;
	const options = (question.options ?? []).map((option) => ({
		label: option.label,
		html: overlineToHtml(option.value || "(選択肢未入力)"),
	}));

	return {
		markdownText: questionToMarkdown(question),
		hasOptions,
		figure: question.figureData ? <Figure data={question.figureData} /> : null,
		answerHtml,
		explanationHtml,
		options,
	};
}

export function QuestionCard({ question, unitId }: Props): JSX.Element {
	const view = buildQuestionView(question);
	const figureData = question.figureData;

	return (
		<article
			id={`question-${question.id}`}
			data-question-card
			data-question-id={question.id}
			class="q-card scroll-mt-20"
		>
			<div class="q-card__body">
				{/* 問題番号 */}
				<header class="q-head">
					<span class="q-num">
						<span class="sr-only">問題</span>
						{question.number}
					</span>
					{view.hasOptions ? <p class="q-hint">選択肢から確認</p> : null}
				</header>

				{/* 2. 問題文 */}
				<div class="q-text-wrap">
					<p
						class="q-text"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: overline 変換済み HTML の注入（旧 set:html と同等）
						dangerouslySetInnerHTML={{ __html: overlineToHtml(question.text) }}
					/>
				</div>

				{/* 3. 図表 */}
				{figureData ? <div class="q-figure-wrap">{view.figure}</div> : null}

				{!figureData && question.figureDescription ? (
					<div class="q-figure-fallback">
						<strong>図:</strong>{" "}
						<span
							// biome-ignore lint/security/noDangerouslySetInnerHtml: overline 変換済み HTML の注入（旧 set:html と同等）
							dangerouslySetInnerHTML={{ __html: overlineToHtml(question.figureDescription) }}
						/>
					</div>
				) : null}

				{view.hasOptions ? (
					<ol class="q-options" aria-label="選択肢">
						{view.options.map((option) => (
							<li class="q-option">
								<span class="q-option__label">{option.label}</span>
								{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */}
								<span dangerouslySetInnerHTML={{ __html: option.html }} />
							</li>
						))}
					</ol>
				) : null}

				<div class="mt-4 block">
					<SolutionReveal
						questionId={question.id}
						unitId={unitId}
						answerHtml={view.answerHtml}
						explanationHtml={view.explanationHtml}
					/>
				</div>

				{/* 6. ツール（控えめなフッター） */}
				<footer class="q-footer">
					<CopyButton
						text={view.markdownText}
						className="q-tool"
						ariaLabel="Markdownでコピー"
						title="Markdownでコピー"
					/>
				</footer>
			</div>
		</article>
	);
}
