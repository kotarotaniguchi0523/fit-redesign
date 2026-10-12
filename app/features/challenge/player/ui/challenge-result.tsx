import type { Handle } from "remix/component";
import { css, on } from "remix/component";

import {
	aggregateChallengeResults,
	formatAccuracy,
	formatDuration,
	summarizeChallenge,
} from "../../challenge.ts";
import type { CompletedChallengePayload } from "../../types.ts";
import type { PlayerMode, PlayerQuestion } from "../types.ts";

const SUCCESS_THRESHOLD = 0.8;

const sectionStyle = css({
	maxWidth: "36rem",
	margin: "0 auto",
	padding: "1.5rem",
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-card)",
});

const eyebrowStyle = css({
	margin: "0 0 0.25rem",
	fontSize: "0.8rem",
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: "var(--color-text-muted)",
});

const statsStyle = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
	gap: "0.75rem",
	margin: "1rem 0",
	"& dt": { fontSize: "0.8rem", color: "var(--color-text-muted)" },
	"& dd": { margin: 0, fontFamily: "var(--font-mono)", fontSize: "1.1rem" },
});

const listStyle = css({
	listStyle: "none",
	margin: "0 0 1rem",
	padding: 0,
	"& li": {
		display: "flex",
		justifyContent: "space-between",
		gap: "0.75rem",
		padding: "0.375rem 0",
		borderBottom: "1px solid var(--color-border)",
	},
});

const actionsStyle = css({
	display: "flex",
	gap: "0.75rem",
	flexWrap: "wrap",
});

const primaryButtonStyle = css({
	padding: "0.625rem 1.25rem",
	borderRadius: "var(--radius-control)",
	border: "1px solid var(--color-primary)",
	background: "var(--color-primary)",
	color: "#fff",
	font: "inherit",
	cursor: "pointer",
});

const quietLinkStyle = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "0.625rem 1.25rem",
	borderRadius: "var(--radius-control)",
	border: "1px solid var(--color-border)",
	color: "var(--color-primary)",
	textDecoration: "none",
});

/** 完了した試行の結果画面。 */
export function ChallengeResultView(
	handle: Handle<{
		payload: CompletedChallengePayload;
		history: readonly CompletedChallengePayload[];
		questions: readonly PlayerQuestion[];
		mode: PlayerMode;
		unitId: string;
		year: string;
		syncMessage: string | null;
		onRetry: () => void;
	}>,
) {
	return () => {
		const { payload, history, questions, mode, unitId, year, syncMessage, onRetry } = handle.props;
		const summary = summarizeChallenge(payload);
		const aggregate = aggregateChallengeResults(history);
		const questionById = new Map(questions.map((question) => [question.id, question]));
		const accuracy = mode === "exam" ? aggregate.accuracy : summary.accuracy;
		const isSuccess = accuracy !== null && accuracy >= SUCCESS_THRESHOLD;

		return (
			<section aria-labelledby="exam-result-title" mix={sectionStyle}>
				<p mix={eyebrowStyle}>結果</p>
				<h2 id="exam-result-title">{isSuccess ? "よくできました" : "おつかれさまでした"}</h2>

				<dl mix={statsStyle}>
					<div>
						<dt>正答率</dt>
						<dd>{formatAccuracy(accuracy)}</dd>
					</div>
					<div>
						<dt>正解</dt>
						<dd>{summary.correctCount}</dd>
					</div>
					<div>
						<dt>不正解</dt>
						<dd>{summary.incorrectCount}</dd>
					</div>
					<div>
						<dt>合計時間</dt>
						<dd>{formatDuration(summary.totalElapsedMs)}</dd>
					</div>
					{mode === "exam" && aggregate.challengeCount > 1 ? (
						<div>
							<dt>これまでの試行</dt>
							<dd>{aggregate.challengeCount}回</dd>
						</div>
					) : null}
				</dl>

				<ol mix={listStyle}>
					{payload.answers.map((answer) => {
						const question = questionById.get(answer.questionId);
						return (
							<li key={answer.questionId}>
								<span>{question ? `問${question.number}` : answer.questionId}</span>
								<span>{answer.judgment === "correct" ? "○" : "×"}</span>
								<span>{formatDuration(answer.elapsedMs)}</span>
							</li>
						);
					})}
				</ol>

				{syncMessage ? <p role="status">{syncMessage}</p> : null}

				<div mix={actionsStyle}>
					<button type="button" mix={[primaryButtonStyle, on("click", onRetry)]}>
						もう一度挑戦する
					</button>
					<a mix={quietLinkStyle} href={`/${unitId}/${year}`}>
						問題一覧へ戻る
					</a>
				</div>
			</section>
		);
	};
}
