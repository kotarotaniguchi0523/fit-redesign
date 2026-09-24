import { useState } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { AnswerSheetIcon } from "../../components/icons";
import type { QuestionId, UnitTabId } from "../../types";
import { useSolutionReveal } from "./useSolutionReveal";

interface SolutionRevealProps {
	questionId: QuestionId;
	unitId: UnitTabId;
	answerHtml: string;
	explanationHtml?: string;
}

export default function SolutionReveal({
	questionId,
	unitId,
	answerHtml,
	explanationHtml,
}: SolutionRevealProps): JSX.Element {
	const onToggle = useSolutionReveal(questionId, unitId);
	const [isOpen, setIsOpen] = useState(false);
	const answerId = `answer-${questionId}`;

	return (
		<div class="q-answer-group">
			<button
				type="button"
				class="q-btn-primary q-answer-toggle"
				aria-label={isOpen ? "解答を隠す" : "解答を表示"}
				title={isOpen ? "解答を隠す" : "解答を表示"}
				aria-expanded={isOpen ? "true" : "false"}
				aria-controls={isOpen ? answerId : undefined}
				onClick={(): void => {
					const nextOpen = !isOpen;
					setIsOpen(nextOpen);
					onToggle(nextOpen);
				}}
			>
				<AnswerSheetIcon />
				<span class="sr-only">{isOpen ? "解答を隠す" : "解答を表示"}</span>
			</button>
			{isOpen ? (
				<section class="q-solution q-answer-panel" id={answerId} aria-live="polite">
					<h3 class="q-solution__title">解答</h3>
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overline 変換済み HTML の注入（旧 set:html と同等） */}
					<p dangerouslySetInnerHTML={{ __html: answerHtml }} />
					{explanationHtml ? (
						<>
							<h3 class="q-solution__title">解説</h3>
							{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overline 変換済み HTML の注入（旧 set:html と同等） */}
							<p dangerouslySetInnerHTML={{ __html: explanationHtml }} />
						</>
					) : null}
				</section>
			) : null}
		</div>
	);
}
