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
	const [recorded, setRecorded] = useState(false);

	return (
		<details
			class="q-answer"
			onToggle={(event: Event): void => {
				if ((event.currentTarget as HTMLDetailsElement).open && !recorded) {
					setRecorded(true);
					const entry = { questionId, unitId, revealedAt: Date.now() };
					recordReveal(entry);
					syncProgressEntry(entry).catch(() => undefined);
				}
			}}
		>
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
