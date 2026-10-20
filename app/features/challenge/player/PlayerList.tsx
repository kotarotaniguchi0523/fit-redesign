import type { JSX } from "hono/jsx/jsx-runtime";
import { CloseIcon } from "../../../components/icons";
import type { QuestionId } from "../../../types";
import { formatDuration } from "../challenge";
import type { ChallengeState } from "../types";
import type { PlayerMode, PlayerQuestion } from "./types";

function PlayerListItem({
	question,
	index,
	mode,
	state,
	currentQuestionId,
	onSelect,
}: Readonly<{
	question: PlayerQuestion;
	index: number;
	mode: PlayerMode;
	state: ChallengeState;
	currentQuestionId: QuestionId | undefined;
	onSelect: (index: number) => void;
}>): JSX.Element {
	const judgment = state.judgments[question.id];
	const isCurrent = question.id === currentQuestionId;
	return (
		<li>
			<button
				type="button"
				class={`exam-question-list__item ${mode === "question" ? "exam-question-list__item--focus" : ""} ${isCurrent ? "is-current" : ""}`}
				aria-label={`問${question.number ?? index + 1} ${question.text}`}
				aria-current={isCurrent ? "true" : undefined}
				onClick={(): void => onSelect(index)}
			>
				<span>問{question.number ?? index + 1}</span>
				{mode === "exam" ? (
					<span class="exam-question-list__time">
						{formatDuration(state.questionElapsedMs[question.id] ?? 0)}
					</span>
				) : null}
				{mode === "exam" && judgment ? (
					<span class={`exam-question-list__judgment is-${judgment}`}>
						{judgment === "correct" ? "○" : "×"}
					</span>
				) : null}
				<span class="exam-question-list__prompt">{question.text}</span>
			</button>
		</li>
	);
}

export function PlayerList({
	state,
	questions,
	mode,
	open,
	onSelect,
	onClose,
}: Readonly<{
	state: ChallengeState;
	questions: readonly PlayerQuestion[];
	mode: PlayerMode;
	open: boolean;
	onSelect: (index: number) => void;
	onClose: () => void;
}>): JSX.Element | null {
	if (!open) {
		return null;
	}
	const currentQuestionId = state.questionIds[state.currentIndex];
	const listedQuestions =
		mode === "question"
			? questions
			: state.questionIds
					.map((questionId) => questions.find((item) => item.id === questionId))
					.filter((question): question is PlayerQuestion => question !== undefined);
	const totalElapsedMs = Object.values(state.questionElapsedMs).reduce<number>(
		(sum, value) => sum + (value ?? 0),
		0,
	);
	return (
		<>
			<button
				class="exam-question-list__backdrop"
				type="button"
				aria-label="問題一覧を閉じる"
				onClick={onClose}
			/>
			<aside class="exam-question-list" aria-label="問題一覧">
				<div class="exam-question-list__toolbar">
					<div class="exam-question-list__header">
						<h2>問題一覧</h2>
					</div>
					<div class="exam-question-list__actions">
						{mode === "exam" ? (
							<p>
								<span>全体</span>
								<strong>{formatDuration(totalElapsedMs)}</strong>
							</p>
						) : null}
						<button
							type="button"
							class="exam-action"
							aria-label="問題一覧を閉じる"
							title="問題一覧を閉じる"
							onClick={onClose}
						>
							<CloseIcon />
						</button>
					</div>
				</div>
				<ol>
					{listedQuestions.map((question, index) => (
						<PlayerListItem
							key={question.id}
							question={question}
							index={index}
							mode={mode}
							state={state}
							currentQuestionId={currentQuestionId}
							onSelect={onSelect}
						/>
					))}
				</ol>
			</aside>
		</>
	);
}
