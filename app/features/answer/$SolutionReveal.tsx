import { useState } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import type { QuestionId, UnitTabId } from "../../types";
import { recordReveal, syncProgressEntry } from "./progressClient";

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
	const [revealed, setRevealed] = useState(false);

	if (!revealed) {
		return (
			<button
				type="button"
				class="q-primary-action"
				onClick={(): void => {
					setRevealed(true);
					const entry = { questionId, unitId, revealedAt: Date.now() };
					recordReveal(entry);
					syncProgressEntry(entry).catch(() => undefined);
				}}
			>
				答えを確認する
			</button>
		);
	}

	return (
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
	);
}
