/** @jsxImportSource hono/jsx */

import type { JSX } from "hono/jsx/jsx-runtime";
import CopyButton from "../../components/$CopyButton";
import { TimerIcon } from "../../components/icons";
import { QuestionContent } from "../../components/QuestionContent";
import SolutionReveal from "../../features/answer/$SolutionReveal";
import { questionToMarkdown } from "../../features/markdown/questionToMarkdown";
import { overlineToHtml } from "../../lib/overline";
import type { ExamNumber, Question, UnitTabId, Year } from "../../types";

/** 問題、図表、答え確認、Markdownコピーをまとめて表示する。 */

interface Props {
	question: Question;
	unitId: UnitTabId;
	year: Year;
	examNumber: ExamNumber;
}

interface QuestionView {
	markdownText: string;
	aiMarkdownText: string;
	answerHtml: string;
	explanationHtml: string | undefined;
}

function buildQuestionView(question: Question): QuestionView {
	const answerHtml = overlineToHtml(question.answer);
	const explanationHtml = question.explanation ? overlineToHtml(question.explanation) : undefined;

	return {
		markdownText: questionToMarkdown(question),
		aiMarkdownText: questionToMarkdown(question, { includeSolution: false }),
		answerHtml,
		explanationHtml,
	};
}

export function QuestionCard({ question, unitId, year, examNumber }: Props): JSX.Element {
	const view = buildQuestionView(question);

	return (
		<article
			id={`question-${question.id}`}
			data-question-card
			data-question-id={question.id}
			class="q-card scroll-mt-20"
		>
			<div class="q-card__body">
				<div class="q-card__layout">
					<QuestionContent question={question} variant="question-set" />
				</div>

				<fieldset class="q-card__actions">
					<legend class="sr-only">問題の操作</legend>
					<CopyButton
						text={view.markdownText}
						askText={view.aiMarkdownText}
						className="q-tool"
						ariaLabel="問題文をコピー"
						title="問題文をコピー"
						idleLabel="コピー済み"
					/>
					<SolutionReveal
						questionId={question.id}
						unitId={unitId}
						answerHtml={view.answerHtml}
						explanationHtml={view.explanationHtml}
					/>
					<a
						href={`/${unitId}/${year}/exam?exam=${examNumber}&question=${question.id}`}
						class="question-timer-link"
						aria-label="タイムアタック"
						title="タイムアタック"
					>
						<TimerIcon />
						<span class="sr-only">タイムアタック</span>
					</a>
				</fieldset>
			</div>
		</article>
	);
}
