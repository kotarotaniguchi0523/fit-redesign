import { createLogger } from "../utils/logger";
import { fetchAnswerStatuses, readTimerDuration, saveAnswer } from "./answerClient";
import { clearStatusChip, hideSolution, revealSolution, setStatusChip } from "./questionCardUi";

const logger = createLogger("[AnswerSelector]");

const OPTION_STATE_CLASSES = ["is-selected", "is-correct", "is-wrong", "is-muted"];

class AnswerSelector extends HTMLElement {
	private questionId = "";
	private correctLabel = "";
	private selectedLabel: string | null = null;
	private isSubmitted = false;
	// SRS/サーバーへの記録は「最初の採点」だけ（retryは練習であり再記録しない）
	private hasRecorded = false;
	private optionButtons: HTMLButtonElement[] = [];
	private submitButton: HTMLButtonElement | null = null;
	private retryButton: HTMLButtonElement | null = null;
	private feedbackEl: HTMLDivElement | null = null;
	private peekButton: HTMLButtonElement | null = null;
	private card: Element | null = null;

	connectedCallback() {
		this.questionId = this.dataset.questionId ?? "";
		this.correctLabel = this.dataset.correctLabel ?? "";

		if (!this.questionId || !this.correctLabel) {
			logger.warn("Missing data-question-id or data-correct-label");
			return;
		}

		this.card = this.closest("[data-question-card]");

		this.transformOptions();
		this.createFeedback();
		this.createSubmitButton();
		this.createPeekButton();
		this.createRetryButton();
		this.loadSavedStatus();
	}

	private transformOptions() {
		const optionDivs = this.querySelectorAll<HTMLDivElement>(":scope > [data-option]");

		for (const div of optionDivs) {
			const labelSpan = div.querySelector("span:first-child");
			const label = labelSpan?.textContent?.trim() ?? "";

			const button = document.createElement("button");
			button.type = "button";
			button.className = div.className; // .q-option（hover等はCSS側で button.q-option に定義）
			button.innerHTML = div.innerHTML;
			button.dataset.label = label;

			button.addEventListener("click", () => this.handleSelect(label));

			div.replaceWith(button);
			this.optionButtons.push(button);
		}
	}

	private createFeedback() {
		this.feedbackEl = document.createElement("div");
		this.feedbackEl.className = "q-feedback hidden";
		this.feedbackEl.setAttribute("aria-live", "polite");
		this.appendChild(this.feedbackEl);
	}

	private createButton(className: string, text: string, onClick: () => void): HTMLButtonElement {
		const button = document.createElement("button");
		button.type = "button";
		button.className = className;
		button.textContent = text;
		button.addEventListener("click", onClick);
		this.appendChild(button);
		return button;
	}

	private createSubmitButton() {
		this.submitButton = this.createButton("q-btn-primary mt-3 hidden", "この答えで確かめる", () =>
			this.handleSubmit(),
		);
	}

	private createPeekButton() {
		this.peekButton = this.createButton("q-btn-peek", "わからない… 解き方を見る", () =>
			this.handlePeek(),
		);
	}

	private createRetryButton() {
		this.retryButton = this.createButton("q-btn-outline hidden", "もう一度解く", () =>
			this.handleRetry(),
		);
	}

	private handleSelect(label: string) {
		if (this.isSubmitted) return;

		this.selectedLabel = label;

		for (const btn of this.optionButtons) {
			btn.classList.remove(...OPTION_STATE_CLASSES);
			if (btn.dataset.label === label) btn.classList.add("is-selected");
		}

		this.submitButton?.classList.remove("hidden");
		this.feedbackEl?.classList.add("hidden");
	}

	private handleSubmit() {
		if (!this.selectedLabel || this.isSubmitted) return;

		this.isSubmitted = true;
		const isCorrect = this.selectedLabel === this.correctLabel;

		this.submitButton?.classList.add("hidden");
		this.peekButton?.classList.add("hidden");

		this.showFeedback(isCorrect);
		revealSolution(this.card);
		setStatusChip(this.card, isCorrect ? "correct" : "review");
		this.retryButton?.classList.remove("hidden");
		this.record(this.selectedLabel, isCorrect);

		logger.info(`Answer submitted: ${isCorrect ? "correct" : "incorrect"}`);
	}

	/** 最初の採点だけ記録する（retry後の再採点はSRS/サーバーに反映しない） */
	private record(selectedLabel: string, isCorrect: boolean) {
		if (this.hasRecorded) return;
		this.hasRecorded = true;
		saveAnswer({
			questionId: this.questionId,
			selectedLabel,
			isCorrect,
			duration: readTimerDuration(this.card),
		});
	}

	private handlePeek() {
		// 「わからない」= 解けなかった、として正直に扱う。解き方を見せ、復習対象として記録し採点を締める。
		this.isSubmitted = true;
		revealSolution(this.card);
		setStatusChip(this.card, "review");
		for (const btn of this.optionButtons) {
			btn.disabled = true;
		}
		this.submitButton?.classList.add("hidden");
		this.peekButton?.classList.add("hidden");
		this.retryButton?.classList.remove("hidden");
		this.record("peek", false);
	}

	private showFeedback(isCorrect: boolean) {
		if (this.feedbackEl) {
			this.feedbackEl.classList.remove("hidden", "is-correct", "is-review");
			if (isCorrect) {
				this.feedbackEl.classList.add("is-correct");
				this.feedbackEl.textContent = "正解！ この調子でいこう。";
			} else {
				this.feedbackEl.classList.add("is-review");
				this.feedbackEl.textContent = "おしい。正解はこれ。解き方を見れば次は解ける。";
			}
		}

		for (const btn of this.optionButtons) {
			const label = btn.dataset.label ?? "";
			btn.disabled = true;
			btn.classList.remove(...OPTION_STATE_CLASSES);

			if (label === this.correctLabel) {
				btn.classList.add("is-correct");
			} else if (label === this.selectedLabel && !isCorrect) {
				btn.classList.add("is-wrong");
			} else {
				btn.classList.add("is-muted");
			}
		}
	}

	private handleRetry() {
		this.isSubmitted = false;
		this.selectedLabel = null;

		for (const btn of this.optionButtons) {
			btn.disabled = false;
			btn.classList.remove(...OPTION_STATE_CLASSES);
		}

		this.submitButton?.classList.add("hidden");
		this.retryButton?.classList.add("hidden");
		this.feedbackEl?.classList.add("hidden");
		this.peekButton?.classList.remove("hidden");
		hideSolution(this.card);
		clearStatusChip(this.card);
	}

	private async loadSavedStatus() {
		try {
			const statuses = await fetchAnswerStatuses();
			const status = statuses[this.questionId];
			// 既にこのセッションで操作済みなら、遅延したフェッチで上書きしない
			if (!status || this.isSubmitted) return;

			this.selectedLabel = status.label;
			this.isSubmitted = true;
			this.hasRecorded = true; // サーバー記録済みの状態を復元しているだけ
			this.showFeedback(status.isCorrect);
			revealSolution(this.card);
			setStatusChip(this.card, status.isCorrect ? "correct" : "review");
			this.submitButton?.classList.add("hidden");
			this.peekButton?.classList.add("hidden");
			this.retryButton?.classList.remove("hidden");
		} catch {
			// ステータス取得失敗は無視
		}
	}
}

customElements.define("answer-selector", AnswerSelector);
