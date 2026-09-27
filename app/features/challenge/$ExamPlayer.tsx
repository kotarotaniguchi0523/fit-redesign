import type { JSX } from "hono/jsx/jsx-runtime";
import { QuestionContent } from "../../components/QuestionContent";
import { questionToMarkdown } from "../markdown/questionToMarkdown";
import { ChallengeResult } from "./ChallengeResult";
import { AnswerPanel } from "./player/AnswerPanel";
import { navigateToExam } from "./player/navigation";
import {
	ChallengeTimerDisplay,
	PlayerEdgeNavigation,
	QuestionActions,
} from "./player/PlayerControls";
import { PlayerHeader } from "./player/PlayerHeader";
import { PlayerList } from "./player/PlayerList";
import type { ExamPlayerProps } from "./player/types";
import { useExamPlayerController } from "./player/useExamPlayerController";

export default function ExamPlayer(props: ExamPlayerProps): JSX.Element {
	const player = useExamPlayerController(props);
	const { state, phase, currentQuestionId, currentQuestion } = player;

	if (phase === "result" && player.resultPayload) {
		return (
			<ChallengeResult
				payload={player.resultPayload}
				history={player.resultHistory.length > 0 ? player.resultHistory : [player.resultPayload]}
				questions={props.questions}
				mode={props.mode}
				onRetry={player.startNewChallenge}
				onBack={(): void => navigateToExam(props.unitId, props.year)}
				syncMessage={player.syncMessage}
			/>
		);
	}
	if (phase === "missing") {
		return (
			<div class="exam-player-message">
				<p>この結果は端末内に見つかりませんでした。</p>
				<a
					class="exam-footer-button exam-footer-button--primary"
					href={`/${props.unitId}/${props.year}`}
				>
					問題一覧へ戻る
				</a>
			</div>
		);
	}
	if (phase === "locked") {
		return (
			<section class="exam-resume" aria-labelledby="exam-locked-title">
				<p class="page-heading__eyebrow">別のタブで編集中</p>
				<h2 id="exam-locked-title">この試行は読み取り専用です</h2>
				<p>同じ小テストを開いている別のタブを閉じると、ここから続けられます。</p>
				<div class="exam-resume__actions">
					<button
						type="button"
						class="exam-footer-button exam-footer-button--primary"
						onClick={player.resumeCurrentChallenge}
					>
						もう一度確認する
					</button>
					<a
						class="exam-footer-button exam-footer-button--quiet"
						href={`/${props.unitId}/${props.year}`}
					>
						問題一覧へ戻る
					</a>
				</div>
			</section>
		);
	}
	if (!state) {
		return <div class="exam-player-shell" aria-hidden="true" />;
	}
	if (phase === "resume") {
		return (
			<section class="exam-resume" aria-labelledby="exam-resume-title">
				<p class="page-heading__eyebrow">続きがあります</p>
				<h2 id="exam-resume-title">前回の試行をどうしますか？</h2>
				<div class="exam-resume__actions">
					<button
						type="button"
						class="exam-footer-button exam-footer-button--primary"
						onClick={player.resumeCurrentChallenge}
					>
						続きから
					</button>
					<button
						type="button"
						class="exam-footer-button exam-footer-button--quiet"
						onClick={player.restartCurrentChallenge}
					>
						最初から
					</button>
				</div>
			</section>
		);
	}
	if (!(currentQuestionId && currentQuestion)) {
		return <div class="exam-player-message">問題を表示できませんでした。</div>;
	}

	return (
		<section
			class="exam-player-shell"
			aria-label={props.mode === "exam" ? "小テストプレイヤー" : "タイムアタックプレイヤー"}
		>
			<PlayerHeader
				playerTitle={props.playerTitle}
				questions={props.questions}
				currentQuestionIndex={player.currentQuestionIndex}
				onOpenQuestionList={player.openQuestionList}
				onSelectQuestion={player.selectHeaderQuestion}
			/>
			<PlayerList
				state={state}
				questions={props.questions}
				mode={props.mode}
				open={player.questionListOpen}
				onClose={player.closeQuestionList}
				onSelect={player.selectListedQuestion}
			/>
			<div class="exam-player__workspace">
				<div
					class={`exam-player__question exam-player__question--${player.navigationDirection}`}
					data-mode-transition-target={player.modeEntryTarget ? "" : undefined}
					key={currentQuestionId}
				>
					<QuestionContent question={currentQuestion} variant="exam-player" />
					<ChallengeTimerDisplay
						mode={props.mode}
						totalElapsedMs={player.totalElapsedMs}
						questionElapsedMs={player.currentQuestionElapsedMs}
					/>
					<QuestionActions
						copyText={questionToMarkdown(currentQuestion)}
						askText={questionToMarkdown(currentQuestion, { includeSolution: false })}
						answerOpen={player.solutionOpen}
						onToggleAnswer={player.toggleAnswer}
						timerRunning={player.timerRunning}
						onToggleTimer={player.toggleTimer}
					/>
					<AnswerPanel
						question={currentQuestion}
						isOpen={player.solutionOpen}
						judgment={player.currentJudgment}
						onJudge={player.judgeCurrentQuestion}
					/>
				</div>
				<PlayerEdgeNavigation
					showPrevious={player.navigationLength > 1}
					isFirst={player.isFirst}
					isLast={player.isLast}
					canFinish={player.canFinish}
					onPrevious={player.movePrevious}
					onNext={player.moveNext}
					onFinish={player.finishChallenge}
				/>
			</div>
		</section>
	);
}
