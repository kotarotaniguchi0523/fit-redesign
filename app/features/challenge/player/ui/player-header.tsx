import type { Handle } from "remix/component";
import { on } from "remix/component";
import type { PlayerQuestion } from "../types.ts";
import { MenuIcon } from "./icons.tsx";

/**
 * プレイヤーのヘッダー。タイトルと問題の進捗（番号ボタン + プログレスバー）を描く。
 * 状態は持たず、操作は親（ExamPlayer）から受け取る。
 */
export function PlayerHeader(
	handle: Handle<{
		playerTitle: string;
		questions: readonly PlayerQuestion[];
		currentQuestionIndex: number;
		onOpenQuestionList: () => void;
		onSelectQuestion: (index: number) => void;
		disabled?: boolean;
	}>,
) {
	return () => {
		const {
			playerTitle,
			questions,
			currentQuestionIndex,
			onOpenQuestionList,
			onSelectQuestion,
			disabled = false,
		} = handle.props;

		return (
			<header class="exam-player__header">
				<div class="exam-player__identity">
					{questions.length > 1 ? (
						<button
							type="button"
							class="exam-action exam-player__list-toggle"
							aria-label="問題一覧を開く"
							title="問題一覧を開く"
							disabled={disabled}
							mix={on("click", onOpenQuestionList)}
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
										disabled={disabled}
										mix={on("click", () => onSelectQuestion(index))}
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
							<span
								style={{
									width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
								}}
							/>
						</div>
					</div>
				</nav>
			</header>
		);
	};
}
