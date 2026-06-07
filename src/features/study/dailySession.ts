import { QUESTION_GRADED_EVENT } from "../../constants";
import { createLogger } from "../../utils/logger";
import { mountAll } from "../../utils/mountAll";
import { buildDailySet, loadSrsState, type QuestionGradedDetail, unitReadiness } from "../srs/srs";

const logger = createLogger("[DailySession]");

/**
 * 「今日の道」連続演習プレイヤー。旧 daily-session Web Component の脱 customElements 版。
 * ページに描画済みの QuestionCard から SRS で今日出す分だけを 1 問ずつ提示する。
 * カードの採点 UI（self-grade / answer-selector）はそのまま再利用し、本モジュールは
 * 出題順・進捗・サマリのみ司る DOM コントローラ。セッション状態はクロージャに保持する。
 */
function setupSession(el: HTMLElement): void {
	const cardsWrap = el.querySelector<HTMLElement>("[data-cards]");
	const progressLabel = el.querySelector<HTMLElement>("[data-progress-label]");
	const progressBar = el.querySelector<HTMLElement>("[data-progress-bar]");
	const nextButton = el.querySelector<HTMLButtonElement>("[data-next]");
	const summaryEl = el.querySelector<HTMLElement>("[data-summary]");
	const emptyEl = el.querySelector<HTMLElement>("[data-empty]");

	const cards = Array.from(
		el.querySelectorAll<HTMLElement>("[data-question-card][data-question-id]"),
	);
	const cardsById = new Map<string, HTMLElement>();
	for (const card of cards) {
		const id = card.dataset.questionId;
		if (id) cardsById.set(id, card);
	}

	const allIds = cards.map((c) => c.dataset.questionId ?? "").filter(Boolean);
	const daily = buildDailySet(loadSrsState(), allIds, Date.now());
	const queue = daily.questionIds;
	// 出題キューを DOM に公開（デバッグ/検証用）
	el.dataset.queueIds = queue.join(" ");

	logger.info(`Daily set: ${queue.length} (review ${daily.dueReviewCount}, new ${daily.newCount})`);

	// 出題対象外のカードは隠す
	for (const card of cards) {
		card.hidden = true;
	}

	// qid → 正誤（同じカードを採点し直しても1件として上書き）
	const graded = new Map<string, boolean>();
	let index = 0;

	function hideSessionChrome(): void {
		if (cardsWrap) cardsWrap.hidden = true;
		nextButton?.setAttribute("hidden", "");
		const header = el.querySelector<HTMLElement>("[data-session-header]");
		if (header) header.hidden = true;
	}

	function showEmpty(): void {
		hideSessionChrome();
		if (emptyEl) emptyEl.hidden = false;
	}

	if (queue.length === 0) {
		showEmpty();
		return;
	}

	function updateProgress(): void {
		const total = queue.length;
		const current = index + 1;
		if (progressLabel) progressLabel.textContent = `${current} / ${total}`;
		if (progressBar) progressBar.style.width = `${Math.round((current / total) * 100)}%`;
	}

	function reflectNextButton(): void {
		if (!nextButton) return;
		const currentId = queue[index];
		const isLast = index >= queue.length - 1;
		nextButton.textContent = isLast ? "今日のぶんを終える" : "次の問題へ";
		// 採点前でも進めるが、採点済みは強調
		nextButton.classList.toggle("is-ready", graded.has(currentId));
	}

	function showCurrent(): void {
		for (const id of queue) {
			const card = cardsById.get(id);
			if (card) card.hidden = true;
		}
		const card = cardsById.get(queue[index]);
		if (card) {
			card.hidden = false;
			card.scrollIntoView({ block: "start", behavior: "smooth" });
		}
		updateProgress();
		reflectNextButton();
	}

	function finish(): void {
		const readiness = unitReadiness(loadSrsState(), Array.from(cardsById.keys()));
		const correctCount = Array.from(graded.values()).filter(Boolean).length;
		const done = graded.size;

		hideSessionChrome();

		if (summaryEl) {
			summaryEl.hidden = false;
			const correctEl = summaryEl.querySelector("[data-summary-correct]");
			const totalEl = summaryEl.querySelector("[data-summary-total]");
			const readinessEl = summaryEl.querySelector("[data-summary-readiness]");
			if (correctEl) correctEl.textContent = String(correctCount);
			if (totalEl) totalEl.textContent = String(done || queue.length);
			if (readinessEl) readinessEl.textContent = `${readiness}%`;
			summaryEl.scrollIntoView({ block: "center", behavior: "smooth" });
		}
		logger.info(`Session finished: ${correctCount}/${done} correct, readiness ${readiness}%`);
	}

	function advance(): void {
		if (index >= queue.length - 1) {
			finish();
			return;
		}
		index += 1;
		showCurrent();
	}

	const handleGraded = (event: Event) => {
		const detail = (event as CustomEvent<QuestionGradedDetail>).detail;
		if (!detail?.questionId) return;
		graded.set(detail.questionId, detail.isCorrect);
		reflectNextButton();
	};

	nextButton?.addEventListener("click", advance);
	document.addEventListener(QUESTION_GRADED_EVENT, handleGraded);

	showCurrent();
}

/** `[data-daily-session]` 要素それぞれにセッションプレイヤーを設定する。 */
export function initDailySession(): void {
	mountAll("[data-daily-session]", setupSession);
}
