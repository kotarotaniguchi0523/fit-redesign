import { QUESTION_GRADED_EVENT } from "../constants";
import { createLogger } from "../utils/logger";
import { buildDailySet, loadSrsState, type QuestionGradedDetail, unitReadiness } from "./srs";

const logger = createLogger("[DailySession]");

/**
 * 「今日の道」連続演習プレイヤー。
 * ページに描画済みの全 QuestionCard から、SRSで今日出す分だけを 1問ずつ提示する。
 * カード自体の採点UIはそのまま再利用し、本コンポーネントは出題順・進捗・サマリのみ司る。
 */
class DailySession extends HTMLElement {
	private cardsById = new Map<string, HTMLElement>();
	private queue: string[] = [];
	private index = 0;
	// qid → 正誤（同じカードを採点し直しても1件として上書き）
	private graded = new Map<string, boolean>();

	private progressLabel: HTMLElement | null = null;
	private progressBar: HTMLElement | null = null;
	private nextButton: HTMLButtonElement | null = null;
	private summaryEl: HTMLElement | null = null;
	private cardsWrap: HTMLElement | null = null;
	private emptyEl: HTMLElement | null = null;

	connectedCallback() {
		this.cardsWrap = this.querySelector("[data-cards]");
		this.progressLabel = this.querySelector("[data-progress-label]");
		this.progressBar = this.querySelector("[data-progress-bar]");
		this.nextButton = this.querySelector("[data-next]");
		this.summaryEl = this.querySelector("[data-summary]");
		this.emptyEl = this.querySelector("[data-empty]");

		const cards = Array.from(
			this.querySelectorAll<HTMLElement>("[data-question-card][data-question-id]"),
		);
		for (const card of cards) {
			const id = card.dataset.questionId;
			if (id) this.cardsById.set(id, card);
		}

		const allIds = cards.map((c) => c.dataset.questionId ?? "").filter(Boolean);
		const state = loadSrsState();
		const daily = buildDailySet(state, allIds, Date.now());
		this.queue = daily.questionIds;
		// 出題キューをDOMに公開（デバッグ/検証用）
		this.dataset.queueIds = this.queue.join(" ");

		logger.info(
			`Daily set: ${this.queue.length} (review ${daily.dueReviewCount}, new ${daily.newCount})`,
		);

		// 出題対象外のカードは隠す
		for (const card of cards) {
			card.hidden = true;
		}

		if (this.queue.length === 0) {
			this.showEmpty();
			return;
		}

		this.nextButton?.addEventListener("click", () => this.advance());
		document.addEventListener(QUESTION_GRADED_EVENT, this.handleGraded);

		this.showCurrent();
	}

	disconnectedCallback() {
		document.removeEventListener(QUESTION_GRADED_EVENT, this.handleGraded);
	}

	private handleGraded = (event: Event) => {
		const detail = (event as CustomEvent<QuestionGradedDetail>).detail;
		if (!detail?.questionId) return;
		this.graded.set(detail.questionId, detail.isCorrect);
		this.reflectNextButton();
	};

	private showCurrent() {
		for (const id of this.queue) {
			const card = this.cardsById.get(id);
			if (card) card.hidden = true;
		}
		const currentId = this.queue[this.index];
		const card = this.cardsById.get(currentId);
		if (card) {
			card.hidden = false;
			card.scrollIntoView({ block: "start", behavior: "smooth" });
		}
		this.updateProgress();
		this.reflectNextButton();
	}

	private reflectNextButton() {
		if (!this.nextButton) return;
		const currentId = this.queue[this.index];
		const isGraded = this.graded.has(currentId);
		const isLast = this.index >= this.queue.length - 1;
		this.nextButton.textContent = isLast ? "今日のぶんを終える" : "次の問題へ";
		// 採点前でも進めるが、採点済みは強調
		this.nextButton.classList.toggle("is-ready", isGraded);
	}

	private advance() {
		if (this.index >= this.queue.length - 1) {
			this.finish();
			return;
		}
		this.index += 1;
		this.showCurrent();
	}

	private updateProgress() {
		const total = this.queue.length;
		const current = this.index + 1;
		if (this.progressLabel) {
			this.progressLabel.textContent = `${current} / ${total}`;
		}
		if (this.progressBar) {
			this.progressBar.style.width = `${Math.round((current / total) * 100)}%`;
		}
	}

	/** カード・進捗・次へボタンを畳む（空状態/サマリ表示の共通前処理） */
	private hideSessionChrome() {
		if (this.cardsWrap) this.cardsWrap.hidden = true;
		this.nextButton?.setAttribute("hidden", "");
		const header = this.querySelector<HTMLElement>("[data-session-header]");
		if (header) header.hidden = true;
	}

	private showEmpty() {
		this.hideSessionChrome();
		if (this.emptyEl) this.emptyEl.hidden = false;
	}

	private finish() {
		const allIds = Array.from(this.cardsById.keys());
		const readiness = unitReadiness(loadSrsState(), allIds);
		const correctCount = Array.from(this.graded.values()).filter(Boolean).length;
		const done = this.graded.size;

		this.hideSessionChrome();

		if (this.summaryEl) {
			this.summaryEl.hidden = false;
			const correctEl = this.summaryEl.querySelector("[data-summary-correct]");
			const totalEl = this.summaryEl.querySelector("[data-summary-total]");
			const readinessEl = this.summaryEl.querySelector("[data-summary-readiness]");
			if (correctEl) correctEl.textContent = String(correctCount);
			if (totalEl) totalEl.textContent = String(done || this.queue.length);
			if (readinessEl) readinessEl.textContent = `${readiness}%`;
			this.summaryEl.scrollIntoView({ block: "center", behavior: "smooth" });
		}
		logger.info(`Session finished: ${correctCount}/${done} correct, readiness ${readiness}%`);
	}
}

customElements.define("daily-session", DailySession);
