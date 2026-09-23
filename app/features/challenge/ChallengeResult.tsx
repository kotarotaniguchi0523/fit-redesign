import { useMemo } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import type { DeepReadonly } from "../../lib/immutable";
import type { Question } from "../../types";
import {
	aggregateChallengeResults,
	formatAccuracy,
	formatDuration,
	summarizeChallenge,
} from "./challenge";
import type { CompletedChallengePayload } from "./types";

type Props = Readonly<{
	payload: CompletedChallengePayload;
	history: readonly CompletedChallengePayload[];
	questions: readonly DeepReadonly<Question>[];
	onRetry: () => void;
	onBack: () => void;
	syncMessage: string | null;
}>;

export function ChallengeResult({
	payload,
	history,
	questions,
	onRetry,
	onBack,
	syncMessage,
}: Props): JSX.Element {
	const current = summarizeChallenge(payload);
	const aggregate = useMemo(() => aggregateChallengeResults(history), [history]);
	return (
		<section class="exam-result" aria-live="polite">
			<div class="exam-result__heading">
				<p class="page-heading__eyebrow">結果</p>
				<h2>小テストの結果</h2>
				<p>今回の結果と、これまでの完了分を分けて表示しています。</p>
			</div>
			<div class="exam-result__summary">
				<div>
					<span>正解</span>
					<strong>
						{current.correctCount}
						<small> / {current.judgedCount}</small>
					</strong>
				</div>
				<div>
					<span>正解率</span>
					<strong>{formatAccuracy(current.accuracy)}</strong>
				</div>
				<div>
					<span>合計時間</span>
					<strong>{formatDuration(current.totalElapsedMs)}</strong>
				</div>
			</div>
			<section class="exam-result__panel">
				<h3>今回の問題別結果</h3>
				<ol class="exam-result__answers">
					{payload.answers.map((answer) => {
						const question = questions.find((item) => item.id === answer.questionId);
						return (
							<li>
								<span
									class={`exam-result__mark is-${answer.judgment}`}
									role="img"
									aria-label={answer.judgment === "correct" ? "正解" : "不正解"}
								>
									{answer.judgment === "correct" ? "○" : "×"}
								</span>
								<span>問{question?.number ?? answer.questionId}</span>
								<time>{formatDuration(answer.elapsedMs)}</time>
							</li>
						);
					})}
				</ol>
			</section>
			<section class="exam-result__panel">
				<h3>これまでの結果</h3>
				<div class="exam-result__summary exam-result__summary--aggregate">
					<div>
						<span>試行回数</span>
						<strong>{aggregate.challengeCount}</strong>
					</div>
					<div>
						<span>総合正解率</span>
						<strong>{formatAccuracy(aggregate.accuracy)}</strong>
					</div>
					<div>
						<span>合計学習時間</span>
						<strong>{formatDuration(aggregate.totalElapsedMs)}</strong>
					</div>
				</div>
				<ol class="exam-result__history">
					{history.map((item, index) => {
						const summary = summarizeChallenge(item);
						return (
							<li>
								<span>#{history.length - index}</span>
								<span>
									{summary.correctCount} / {summary.judgedCount}
								</span>
								<span>{formatAccuracy(summary.accuracy)}</span>
								<time>{formatDuration(summary.totalElapsedMs)}</time>
							</li>
						);
					})}
				</ol>
			</section>
			<div class="exam-player__footer exam-player__footer--result">
				<button type="button" class="exam-footer-button exam-footer-button--quiet" onClick={onBack}>
					問題一覧
				</button>
				<button
					type="button"
					class="exam-footer-button exam-footer-button--primary"
					onClick={onRetry}
				>
					もう一度挑戦
				</button>
			</div>
			{syncMessage ? (
				<p class="exam-sync-message" role="status">
					{syncMessage}
				</p>
			) : null}
		</section>
	);
}
