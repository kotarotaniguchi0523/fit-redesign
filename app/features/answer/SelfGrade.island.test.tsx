/** @jsxImportSource hono/jsx/dom */
import { render } from "hono/jsx/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SelfGrade from "./$SelfGrade";

/**
 * SelfGrade island の観測可能な振る舞いを検証する（AAA）。
 *
 * 純粋ロジック（srs / timeFormat）は既存テストが担保するため重複させない。ここでは island の
 * phase 遷移（initial → revealed → graded）が DOM に宣言的に反映されることを確認する。
 *
 * hono/jsx/dom の更新は非同期スケジュールのため、固定回数の flush ではなく「期待状態になるまで
 * ポーリングする」settle() で待つ（async React のレンダ完了を観測ベースで待つ）。
 */

// 回答済み状態の取得はネットワークなので mock する。saved 復元テスト用の固定 status は factory に
// 直書きし（questionId が一意なので未回答テストは undefined → initial のまま）、2 islands のテストが
// 同一モジュールレジストリを共有してもどちらの mock instance が勝っても整合させる。
vi.mock("./answerClient", async () => {
	const actual = await vi.importActual<typeof import("./answerClient")>("./answerClient");
	return {
		...actual,
		fetchAnswerStatuses: vi.fn(async () => ({
			"q-self-saved": { label: "self-correct", isCorrect: true },
		})),
	};
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

/** island を [data-question-card] の中にマウントする。 */
function mountSelfGrade(questionId: string): {
	root: HTMLElement;
} {
	const card = document.createElement("div");
	card.setAttribute("data-question-card", "");

	const root = document.createElement("div");
	card.append(root);
	document.body.appendChild(card);

	render(
		<SelfGrade
			questionId={questionId}
			answerHtml="<span>正答</span>"
			explanationHtml="<span>解説</span>"
		/>,
		root,
	);
	return { root };
}

describe("SelfGrade island", () => {
	it("初期表示では「答え合わせをする」だけを出し、解説は隠れている", async () => {
		// Arrange & Act
		const { root } = mountSelfGrade("q-self-1");

		// Assert
		await settle(() => root.querySelectorAll("button").length === 1);
		expect(buttonLabels(root)).toEqual(["答え合わせをする"]);
		expect(root.querySelector(".q-solution")).toBeNull();
	});

	it("答え合わせで解説が開き、採点ボタンが2つ出る", async () => {
		// Arrange
		const { root } = mountSelfGrade("q-self-2");
		await settle(() => root.querySelectorAll("button").length === 1);

		// Act: reveal
		root.querySelector("button")?.click();

		// Assert
		await settle(() => root.querySelectorAll("button").length === 2);
		expect(buttonLabels(root)).toEqual(["合ってた", "もう一度やる"]);
		expect(root.querySelector(".q-solution")).not.toBeNull();
	});

	it("「合ってた」でチップが correct になり graded に進む", async () => {
		// Arrange
		const { root } = mountSelfGrade("q-self-3");
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
		expect(root.querySelector(".q-chip")?.classList.contains("q-chip--correct")).toBe(true);
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

	it("fetch 解決前でも「答え合わせをする」が即描画される（SSR-first）", async () => {
		// Arrange: fetchAnswerStatuses を未解決のまま保留し、fetch を待たず描画されることを検証する。
		const { fetchAnswerStatuses } = await import("./answerClient");
		vi.mocked(fetchAnswerStatuses).mockImplementationOnce(
			() => new Promise<never>(() => undefined),
		);

		// Act
		const { root } = mountSelfGrade("q-self-pending");

		// Assert: fetch 未解決でも初期アクションが出る（resolved ゲート廃止の回帰防止）
		await settle(() => root.querySelectorAll("button").length === 1);
		expect(buttonLabels(root)).toEqual(["答え合わせをする"]);
		expect(root.querySelector(".q-solution")).toBeNull();
	});

	it("回答済みは fetch 後に graded へ格下げされ、解説とチップが復元される", async () => {
		// Arrange & Act: q-self-saved は factory mock が saved（正解）を返す。
		const { root } = mountSelfGrade("q-self-saved");

		// Assert: graded（やり直しボタン1つ）＋ 解説表示 ＋ チップ correct
		await settle(() => root.querySelector("button")?.textContent === "もう一度この問題を解く");
		expect(root.querySelector(".q-solution")).not.toBeNull();
		expect(root.querySelector(".q-chip")?.classList.contains("q-chip--correct")).toBe(true);
	});
});
