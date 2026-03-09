import { USER_ID_KEY } from "../constants";
import { createLogger } from "../utils/logger";

const logger = createLogger("[AnswerSelector]");

interface AnswerStatusMap {
	[questionId: string]: { label: string; isCorrect: boolean };
}

// ページ全体で1回だけ回答済み状態を取得
let statusPromise: Promise<AnswerStatusMap> | null = null;

function getUserId(): string {
	try {
		const existing = localStorage.getItem(USER_ID_KEY);
		if (existing) return existing;
		const newId = crypto.randomUUID();
		localStorage.setItem(USER_ID_KEY, newId);
		return newId;
	} catch {
		return "anonymous";
	}
}

function fetchAnswerStatuses(): Promise<AnswerStatusMap> {
	if (statusPromise) return statusPromise;

	const userId = getUserId();
	if (userId === "anonymous") {
		statusPromise = Promise.resolve({});
		return statusPromise;
	}

	statusPromise = fetch(`/api/answer/status?userId=${encodeURIComponent(userId)}`)
		.then((res) => {
			if (!res.ok) return {};
			return res.json();
		})
		.then((data: { statuses?: AnswerStatusMap }) => data.statuses ?? {})
		.catch(() => ({}));

	return statusPromise;
}

class AnswerSelector extends HTMLElement {
	private questionId = "";
	private correctLabel = "";
	private selectedLabel: string | null = null;
	private isSubmitted = false;
	private optionButtons: HTMLButtonElement[] = [];
	private submitButton: HTMLButtonElement | null = null;
	private retryButton: HTMLButtonElement | null = null;
	private detailsEl: HTMLDetailsElement | null = null;

	connectedCallback() {
		this.questionId = this.dataset.questionId ?? "";
		this.correctLabel = this.dataset.correctLabel ?? "";

		if (!this.questionId || !this.correctLabel) {
			logger.warn("Missing data-question-id or data-correct-label");
			return;
		}

		// details要素を探す（解答セクション）
		const card = this.closest(".mb-4.border-l-4");
		this.detailsEl = card?.querySelector("details") ?? null;

		this.transformOptions();
		this.createSubmitButton();
		this.createRetryButton();
		this.loadSavedStatus();
	}

	private transformOptions() {
		const optionDivs = this.querySelectorAll<HTMLDivElement>(":scope > div");

		for (const div of optionDivs) {
			const labelSpan = div.querySelector("span:first-child");
			const label = labelSpan?.textContent?.trim() ?? "";

			const button = document.createElement("button");
			button.type = "button";
			button.className =
				div.className +
				" cursor-pointer transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 w-full text-left";
			button.innerHTML = div.innerHTML;
			button.dataset.label = label;

			button.addEventListener("click", () => this.handleSelect(label));

			div.replaceWith(button);
			this.optionButtons.push(button);
		}
	}

	private createSubmitButton() {
		this.submitButton = document.createElement("button");
		this.submitButton.type = "button";
		this.submitButton.className =
			"mt-3 w-full py-2.5 px-4 rounded-lg font-medium text-white bg-[#1e3a5f] hover:bg-[#2d4a6f] transition-colors hidden";
		this.submitButton.textContent = "回答する";
		this.submitButton.addEventListener("click", () => this.handleSubmit());
		this.appendChild(this.submitButton);
	}

	private createRetryButton() {
		this.retryButton = document.createElement("button");
		this.retryButton.type = "button";
		this.retryButton.className =
			"mt-2 w-full py-2 px-4 rounded-lg font-medium text-[#1e3a5f] border border-[#1e3a5f] hover:bg-[#1e3a5f]/5 transition-colors hidden";
		this.retryButton.textContent = "もう一度解く";
		this.retryButton.addEventListener("click", () => this.handleRetry());
		this.appendChild(this.retryButton);
	}

	private handleSelect(label: string) {
		if (this.isSubmitted) return;

		this.selectedLabel = label;

		// 全ボタンのハイライトをリセット
		for (const btn of this.optionButtons) {
			const isSelected = btn.dataset.label === label;
			btn.classList.toggle("border-blue-500", isSelected);
			btn.classList.toggle("bg-blue-50", isSelected);
			btn.classList.toggle("ring-2", isSelected);
			btn.classList.toggle("ring-blue-300", isSelected);
			btn.classList.toggle("border-gray-200", !isSelected);
			btn.classList.toggle("bg-gray-50", !isSelected);
		}

		// 回答するボタンを表示
		if (this.submitButton) {
			this.submitButton.classList.remove("hidden");
		}
	}

	private async handleSubmit() {
		if (!this.selectedLabel || this.isSubmitted) return;

		this.isSubmitted = true;
		const isCorrect = this.selectedLabel === this.correctLabel;

		// ボタンを無効化
		if (this.submitButton) {
			this.submitButton.classList.add("hidden");
		}

		// 正誤フィードバック
		this.showFeedback(isCorrect);

		// 解答セクションを自動展開
		if (this.detailsEl) {
			this.detailsEl.open = true;
		}

		// もう一度解くボタン表示
		if (this.retryButton) {
			this.retryButton.classList.remove("hidden");
		}

		// サーバーに保存（fire-and-forget）
		this.saveAnswer(isCorrect);

		logger.info(`Answer submitted: ${isCorrect ? "correct" : "incorrect"}`);
	}

	private showFeedback(isCorrect: boolean) {
		for (const btn of this.optionButtons) {
			const label = btn.dataset.label ?? "";
			btn.disabled = true;
			btn.classList.remove("cursor-pointer", "hover:border-blue-400", "hover:bg-blue-50");
			btn.classList.remove("ring-2", "ring-blue-300", "border-blue-500");
			btn.classList.remove("border-gray-200", "bg-gray-50");

			if (label === this.correctLabel) {
				// 正解の選択肢は常に緑
				btn.classList.add("border-emerald-500", "bg-emerald-50", "ring-2", "ring-emerald-300");
			} else if (label === this.selectedLabel && !isCorrect) {
				// 不正解で選んだ選択肢は赤
				btn.classList.add("border-red-500", "bg-red-50", "ring-2", "ring-red-300");
			} else {
				btn.classList.add("border-gray-200", "bg-gray-50", "opacity-60");
			}
		}
	}

	private handleRetry() {
		this.isSubmitted = false;
		this.selectedLabel = null;

		// ボタン状態をリセット
		for (const btn of this.optionButtons) {
			btn.disabled = false;
			btn.classList.remove(
				"border-emerald-500",
				"bg-emerald-50",
				"ring-emerald-300",
				"border-red-500",
				"bg-red-50",
				"ring-red-300",
				"ring-2",
				"opacity-60",
			);
			btn.classList.add(
				"cursor-pointer",
				"hover:border-blue-400",
				"hover:bg-blue-50",
				"border-gray-200",
				"bg-gray-50",
			);
		}

		if (this.submitButton) {
			this.submitButton.classList.add("hidden");
		}
		if (this.retryButton) {
			this.retryButton.classList.add("hidden");
		}

		// 解答セクションを閉じる
		if (this.detailsEl) {
			this.detailsEl.open = false;
		}
	}

	private async loadSavedStatus() {
		try {
			const statuses = await fetchAnswerStatuses();
			const status = statuses[this.questionId];
			if (!status) return;

			// 回答済みの場合、その状態を復元
			this.selectedLabel = status.label;
			this.isSubmitted = true;
			this.showFeedback(status.isCorrect);

			if (this.retryButton) {
				this.retryButton.classList.remove("hidden");
			}
		} catch {
			// ステータス取得失敗は無視
		}
	}

	private async saveAnswer(isCorrect: boolean) {
		const userId = getUserId();
		if (userId === "anonymous") return;

		// タイマーからdurationを取得
		const duration = this.getTimerDuration();

		try {
			await fetch("/api/answer/submit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId,
					questionId: this.questionId,
					selectedLabel: this.selectedLabel,
					isCorrect,
					duration,
					timestamp: Date.now(),
				}),
			});
		} catch {
			logger.warn("Failed to save answer to server");
		}
	}

	private getTimerDuration(): number | undefined {
		// 同じカード内のタイマーからelapsed timeを取得
		const card = this.closest(".mb-4.border-l-4");
		const timer = card?.querySelector("question-timer");
		if (!timer) return undefined;

		// question-timerのdisplay要素から時間を読み取る
		const display =
			timer.shadowRoot?.querySelector("[data-elapsed]") ?? timer.querySelector("[data-elapsed]");
		if (display) {
			const elapsed = Number(display.getAttribute("data-elapsed"));
			if (Number.isFinite(elapsed) && elapsed > 0) return elapsed;
		}

		return undefined;
	}
}

customElements.define("answer-selector", AnswerSelector);
