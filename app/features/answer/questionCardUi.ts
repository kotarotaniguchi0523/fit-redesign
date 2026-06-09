/**
 * 問題カードの共通DOM操作。
 * MCQ用 answer-selector と 記述式用 self-grade の両方から使う。
 * （クライアントバンドルを軽く保つため Zod や重い依存は持ち込まない）
 *
 * カード（[data-question-card]）は island の subtree 外にあるサーバー描画 DOM。各 island は
 * 自身の状態から「カードのあるべき見た目」(CardView) を `cardView(state)` で導出し、reflectCard で
 * 一括反映する。reveal/hide/setChip/clearChip を分岐ごとに散在させず、状態→DOM の反映を 1 関数に
 * 集約することで、二重化した真実（React state とカード DOM）の同期漏れを防ぐ。
 */

export type CardState = "correct" | "review";

/** island 状態から導出するカードの見た目。solution=解説パネル表示、chip=進捗チップ（null で消す）。 */
export interface CardView {
	solution: boolean;
	chip: CardState | null;
}

const CHIP_TEXT: Record<CardState, string> = {
	correct: "✓ できた",
	review: "あとで復習",
};

/**
 * island 状態から導出した CardView をカード DOM へ冪等に一括反映する。
 * 解説パネルの開閉と、進捗チップ（文言/クラス/data-answered）を同期する。
 */
export function reflectCard(card: Element | null, view: CardView): void {
	const panel = card?.querySelector<HTMLElement>("[data-solution]");
	if (panel) {
		panel.hidden = !view.solution;
		panel.classList.toggle("solution-reveal", view.solution);
	}

	const chip = card?.querySelector<HTMLElement>("[data-status-chip]");
	if (view.chip === null) {
		if (chip) chip.hidden = true;
		card?.removeAttribute("data-answered");
		return;
	}

	if (chip) {
		chip.hidden = false;
		chip.classList.remove("q-chip--correct", "q-chip--review");
		chip.classList.add(view.chip === "correct" ? "q-chip--correct" : "q-chip--review");
		chip.textContent = CHIP_TEXT[view.chip];
		card?.setAttribute("data-answered", view.chip);
	}
}
