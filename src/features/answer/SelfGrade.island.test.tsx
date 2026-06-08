/** @jsxImportSource hono/jsx/dom */
import { render } from "hono/jsx/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SelfGrade from "../../../app/islands/SelfGrade";

/**
 * SelfGrade island の観測可能な振る舞いを検証する（AAA）。
 *
 * 純粋ロジック（srs / timeFormat）は既存テストが担保するため重複させない。ここでは island の
 * phase 遷移（initial → revealed → graded）が DOM に宣言的に反映され、親カード（subtree 外の
 * [data-question-card]）の解説/チップへ命令的副作用が届くことを確認する。
 *
 * hono/jsx/dom の更新は非同期スケジュールのため、固定回数の flush ではなく「期待状態になるまで
 * ポーリングする」settle() で待つ（async React のレンダ完了を観測ベースで待つ）。
 */

// 回答済み状態の取得はネットワークなので mock し、未回答（initial 開始）に固定する。
vi.mock("./answerClient", async () => {
	const actual = await vi.importActual<typeof import("./answerClient")>("./answerClient");
	return { ...actual, fetchAnswerStatuses: vi.fn(async () => ({})) };
});

/** 条件が満たされるまで（または上限まで）マクロタスクをまたいで待つ。 */
async function settle(predicate: () => boolean): Promise<void> {
	for (let i = 0; i < 50; i++) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	throw new Error("settle: predicate not satisfied in time");
}

const buttonLabels = (root: HTMLElement): (string | null)[] =>
	Array.from(root.querySelectorAll("button"), (b) => b.textContent);

afterEach(() => {
	document.body.innerHTML = "";
	vi.clearAllMocks();
});

/** island を [data-question-card]（解説/チップ付き）の中にマウントする。 */
function mountSelfGrade(questionId: string): {
	root: HTMLElement;
	solution: HTMLElement;
	chip: HTMLElement;
} {
	const card = document.createElement("div");
	card.setAttribute("data-question-card", "");

	const solution = document.createElement("div");
	solution.setAttribute("data-solution", "");
	solution.hidden = true;

	const chip = document.createElement("div");
	chip.setAttribute("data-status-chip", "");
	chip.hidden = true;

	const root = document.createElement("div");
	card.append(solution);
	card.append(chip);
	card.append(root);
	document.body.appendChild(card);

	render(<SelfGrade questionId={questionId} />, root);
	return { root, solution, chip };
}

describe("SelfGrade island", () => {
	it("初期表示では「答え合わせをする」だけを出し、解説は隠れている", async () => {
		// Arrange & Act
		const { root, solution } = mountSelfGrade("q-self-1");

		// Assert
		await settle(() => root.querySelectorAll("button").length === 1);
		expect(buttonLabels(root)).toEqual(["答え合わせをする"]);
		expect(solution.hidden).toBe(true);
	});

	it("答え合わせで解説が開き、採点ボタンが2つ出る", async () => {
		// Arrange
		const { root, solution } = mountSelfGrade("q-self-2");
		await settle(() => root.querySelectorAll("button").length === 1);

		// Act: reveal
		root.querySelector("button")?.click();

		// Assert
		await settle(() => root.querySelectorAll("button").length === 2);
		expect(buttonLabels(root)).toEqual(["合ってた", "もう一度やる"]);
		expect(solution.hidden).toBe(false);
	});

	it("「合ってた」でチップが correct になり graded に進む", async () => {
		// Arrange
		const { root, chip } = mountSelfGrade("q-self-3");
		await settle(() => root.querySelectorAll("button").length === 1);
		root.querySelector("button")?.click(); // reveal
		await settle(() => root.querySelectorAll("button").length === 2);

		// Act: 合ってた（先頭の採点ボタン）
		root.querySelectorAll("button")[0]?.click();

		// Assert: graded フェーズ（やり直しボタン1つ）＋ チップ correct
		await settle(
			() =>
				root.querySelectorAll("button").length === 1 &&
				root.querySelector("button")?.textContent === "もう一度この問題を解く",
		);
		expect(chip.hidden).toBe(false);
		expect(chip.classList.contains("q-chip--correct")).toBe(true);
	});

	it("採点で question-graded イベントが正誤付きで発火する", async () => {
		// Arrange
		const { root } = mountSelfGrade("q-self-4");
		await settle(() => root.querySelectorAll("button").length === 1);
		root.querySelector("button")?.click(); // reveal
		await settle(() => root.querySelectorAll("button").length === 2);

		const events: { questionId: string; isCorrect: boolean }[] = [];
		const handler = (e: Event) => events.push((e as CustomEvent).detail);
		document.addEventListener("question-graded", handler);

		// Act: 「もう一度やる」= self-incorrect
		root.querySelectorAll("button")[1]?.click();

		// Assert
		await settle(() => events.length === 1);
		document.removeEventListener("question-graded", handler);
		expect(events).toEqual([{ questionId: "q-self-4", isCorrect: false }]);
	});
});
