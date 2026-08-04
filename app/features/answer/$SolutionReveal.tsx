import type { JSX } from "hono/jsx/jsx-runtime";
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

	return (
		<details class="q-answer" onToggle={onToggle}>
			<summary class="q-btn-primary cursor-pointer list-none text-center">答えを確認する</summary>
			<section class="q-solution" aria-live="polite">
				<h3 class="q-solution__title">解答</h3>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */}
				<p dangerouslySetInnerHTML={{ __html: answerHtml }} />
				{explanationHtml ? (
					<>
						<h3 class="q-solution__title">解説</h3>
						{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */}
						<p dangerouslySetInnerHTML={{ __html: explanationHtml }} />
					</>
				) : null}
			</section>
		</details>
	);
}
