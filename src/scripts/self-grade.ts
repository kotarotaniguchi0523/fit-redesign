import { createLogger } from "../utils/logger";
import { fetchAnswerStatuses, readTimerDuration, saveAnswer } from "./answerClient";
import { clearStatusChip, hideSolution, revealSolution, setStatusChip } from "./questionCardUi";

const logger = createLogger("[SelfGrade]");

/**
 * 記述式（選択肢のない）問題の自己採点フロー。
 * 「答え合わせをする」→ 解き方を表示 →「合ってた / もう一度」で自己採点し記録する。
 *
 * selectedLabel には "self-correct" / "self-incorrect" を入れて
 * ダッシュボード等の既存集計（isCorrect ベース）と整合させる。
 */
class SelfGrade extends HTMLElement {
	private questionId = "";
	private card: Element | null = null;
	private revealButton: HTMLButtonElement | null = null;
	private gradeWrap: HTMLDivElement | null = null;
	private isGraded = false;
	// SRS/サーバー記録は最初の自己採点だけ（retry後の再採点は反映しない）
	private hasRecorded = false;

	connectedCallback() {
		this.questionId = this.dataset.questionId ?? "";
		if (!this.questionId) {
			logger.warn("Missing data-question-id");
			return;
		}
		this.card = this.closest("[data-question-card]");
		this.revealButton = this.querySelector<HTMLButtonElement>("[data-reveal]");

		this.revealButton?.addEventListener("click", () => this.handleReveal());
		this.loadSavedStatus();
	}

	private handleReveal() {
		revealSolution(this.card);
		if (this.revealButton) this.revealButton.hidden = true;
		this.renderGradeButtons();
	}

	private renderGradeButtons() {
		if (this.gradeWrap) {
			this.gradeWrap.hidden = false;
			return;
		}
		const wrap = document.createElement("div");
		wrap.className = "q-grade-row";

		const gotIt = document.createElement("button");
		gotIt.type = "button";
		gotIt.className = "q-btn-emerald";
		gotIt.textContent = "合ってた";
		gotIt.addEventListener("click", () => this.handleGrade(true));

		const review = document.createElement("button");
		review.type = "button";
		review.className = "q-btn-amber";
		review.textContent = "もう一度やる";
		review.addEventListener("click", () => this.handleGrade(false));

		wrap.appendChild(gotIt);
		wrap.appendChild(review);
		this.gradeWrap = wrap;
		this.appendChild(wrap);
	}

	private handleGrade(isCorrect: boolean) {
		this.isGraded = true;
		setStatusChip(this.card, isCorrect ? "correct" : "review");
		if (this.gradeWrap) this.gradeWrap.hidden = true;

		this.renderRetry();

		if (!this.hasRecorded) {
			this.hasRecorded = true;
			saveAnswer({
				questionId: this.questionId,
				selectedLabel: isCorrect ? "self-correct" : "self-incorrect",
				isCorrect,
				duration: readTimerDuration(this.card),
			});
		}
		logger.info(`Self graded: ${isCorrect ? "correct" : "review"}`);
	}

	private retryButton: HTMLButtonElement | null = null;
	private renderRetry() {
		if (this.retryButton) {
			this.retryButton.hidden = false;
			return;
		}
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "q-btn-ghost";
		btn.textContent = "もう一度この問題を解く";
		btn.addEventListener("click", () => this.handleRetry());
		this.retryButton = btn;
		this.appendChild(btn);
	}

	private handleRetry() {
		this.isGraded = false;
		hideSolution(this.card);
		clearStatusChip(this.card);
		if (this.gradeWrap) this.gradeWrap.hidden = true;
		if (this.retryButton) this.retryButton.hidden = true;
		if (this.revealButton) this.revealButton.hidden = false;
	}

	private async loadSavedStatus() {
		try {
			const statuses = await fetchAnswerStatuses();
			const status = statuses[this.questionId];
			if (!status || this.isGraded) return;

			this.hasRecorded = true; // サーバー記録済みの状態を復元しているだけ
			revealSolution(this.card);
			if (this.revealButton) this.revealButton.hidden = true;
			setStatusChip(this.card, status.isCorrect ? "correct" : "review");
			this.renderRetry();
		} catch {
			// ステータス取得失敗は無視
		}
	}
}

customElements.define("self-grade", SelfGrade);
