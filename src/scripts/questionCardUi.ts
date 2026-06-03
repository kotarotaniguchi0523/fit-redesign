/**
 * 問題カードの共通DOM操作。
 * MCQ用 answer-selector と 記述式用 self-grade の両方から使う。
 * （クライアントバンドルを軽く保つため Zod や重い依存は持ち込まない）
 */

export type CardState = "correct" | "review";

/** 解き方パネルを表示する */
export function revealSolution(card: Element | null): void {
	const panel = card?.querySelector<HTMLElement>("[data-solution]");
	if (!panel) return;
	panel.hidden = false;
	panel.classList.add("solution-reveal");
}

/** 解き方パネルを隠す（もう一度やるとき） */
export function hideSolution(card: Element | null): void {
	const panel = card?.querySelector<HTMLElement>("[data-solution]");
	if (!panel) return;
	panel.hidden = true;
	panel.classList.remove("solution-reveal");
}

/** カード上部の進捗チップ（できた / 復習する）を設定する */
export function setStatusChip(card: Element | null, state: CardState): void {
	const chip = card?.querySelector<HTMLElement>("[data-status-chip]");
	if (!chip) return;

	chip.hidden = false;
	chip.classList.remove("q-chip--correct", "q-chip--review");

	if (state === "correct") {
		chip.classList.add("q-chip--correct");
		chip.textContent = "✓ できた";
		card?.setAttribute("data-answered", "correct");
	} else {
		chip.classList.add("q-chip--review");
		chip.textContent = "あとで復習";
		card?.setAttribute("data-answered", "review");
	}
}

/** 進捗チップを消す */
export function clearStatusChip(card: Element | null): void {
	const chip = card?.querySelector<HTMLElement>("[data-status-chip]");
	if (chip) chip.hidden = true;
	card?.removeAttribute("data-answered");
}
