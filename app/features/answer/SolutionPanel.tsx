import type { JSX } from "hono/jsx/jsx-runtime";

// answer ドメインの解答表示パネル（$AnswerSelector / $SelfGrade が共有する presentational）。
// 島の状態は持たず、サーバー生成済みの信頼済み HTML を描画するだけ。
export function SolutionPanel(props: {
	answerHtml: string;
	explanationHtml?: string;
}): JSX.Element {
	return (
		<div class="q-solution solution-reveal">
			<p class="q-solution__title">解き方</p>
			<div class="q-solution__answer">
				<span class="q-solution__answer-label">答え</span>
				<span
					class="q-solution__answer-value"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: サーバー生成済みの信頼済みHTML(overline等)を描画
					dangerouslySetInnerHTML={{ __html: props.answerHtml }}
				/>
			</div>
			{props.explanationHtml ? (
				<p
					class="q-solution__explanation"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: サーバー生成済みの信頼済みHTML(overline等)を描画
					dangerouslySetInnerHTML={{ __html: props.explanationHtml }}
				/>
			) : null}
		</div>
	);
}
