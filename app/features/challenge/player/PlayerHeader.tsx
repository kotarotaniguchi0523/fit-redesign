import type { JSX } from "hono/jsx/jsx-runtime";
import { MenuIcon } from "../../../components/icons";
import type { PlayerQuestion } from "./types";

export function PlayerHeader({
	playerTitle,
	questions,
	currentQuestionIndex,
	onOpenQuestionList,
	onSelectQuestion,
}: Readonly<{
	playerTitle: string;
	questions: readonly PlayerQuestion[];
	currentQuestionIndex: number;
	onOpenQuestionList: () => void;
	onSelectQuestion: (index: number) => void;
}>): JSX.Element {
	return (
		<header class="exam-player__header">
			<div class="exam-player__identity">
				{questions.length > 1 ? (
					<button
						type="button"
						class="exam-action exam-player__list-toggle"
						aria-label="問題一覧を開く"
						title="問題一覧を開く"
						onClick={onOpenQuestionList}
					>
						<MenuIcon />
					</button>
				) : null}
				<h2>{playerTitle}</h2>
			</div>
			<nav class="exam-player__progress" aria-label="問題番号">
				<div class="exam-player__progress-steps">
					<ol>
						{questions.map((question, index) => (
							<li key={question.id}>
								<button
									type="button"
									aria-label={`問${index + 1}`}
									aria-current={index === currentQuestionIndex ? "step" : undefined}
									class={index === currentQuestionIndex ? "is-current" : ""}
									onClick={(): void => onSelectQuestion(index)}
								>
									{index + 1}
								</button>
							</li>
						))}
					</ol>
					<div
						class="exam-player__progress-track"
						role="progressbar"
						aria-label="問題の進捗"
						aria-valuemin={0}
						aria-valuemax={questions.length}
						aria-valuenow={currentQuestionIndex + 1}
						aria-valuetext={`問${currentQuestionIndex + 1} / ${questions.length}`}
					>
						<span style={`width: ${((currentQuestionIndex + 1) / questions.length) * 100}%;`} />
					</div>
				</div>
				<span>
					{currentQuestionIndex + 1} / {questions.length}
				</span>
			</nav>
		</header>
	);
}
