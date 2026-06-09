/** @jsxImportSource hono/jsx/dom */
import { render } from "hono/jsx/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnswerSelector from "./$AnswerSelector";

/**
 * AnswerSelector island の観測可能な振る舞いを検証する（AAA）。
 *
 * 純粋ロジック（srs / timeFormat）は既存テストが担保するため重複させない。ここでは MCQ の
 * 状態機械（selecting → submitted）が DOM の選択肢クラス・フィードバック・解説/チップへ
 * 宣言的に反映されることを確認する。hono/jsx/dom の非同期更新は settle() で観測待ちする。
 */

// fetchAnswerStatuses は saved 復元テスト用に固定 status を返す（questionId が一意なので未回答テストは
// statuses[id] が undefined → selecting のまま）。2 islands のテストが同一モジュールレジストリを共有し
// うるため、saved キーは factory に直書きしてどちらの mock instance が勝っても整合させる。
vi.mock("./answerClient", async () => {
	const actual = await vi.importActual<typeof import("./answerClient")>("./answerClient");
	return {
		...actual,
		fetchAnswerStatuses: vi.fn(async () => ({
			"q-mcq-saved": { label: "ア", isCorrect: true },
		})),
	};
});

async function settle(predicate: () => boolean): Promise<void> {
	for (let i = 0; i < 50; i++) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	throw new Error("settle: predicate not satisfied in time");
}

afterEach(() => {
	document.body.innerHTML = "";
	vi.clearAllMocks();
});

const OPTIONS = [
	{ label: "ア", html: "<span>ア</span> 1" },
	{ label: "イ", html: "<span>イ</span> 2" },
];

/** island を [data-question-card] の中にマウントする。 */
function mountSelector(questionId: string, correctLabel: string) {
	const card = document.createElement("div");
	card.setAttribute("data-question-card", "");

	const root = document.createElement("div");
	card.append(root);
	document.body.appendChild(card);

	render(
		<AnswerSelector
			questionId={questionId}
			correctLabel={correctLabel}
			options={OPTIONS}
			answerHtml="<span>ア</span>"
			explanationHtml="<span>解説</span>"
		/>,
		root,
	);
	return { root };
}

/** 選択肢ボタン（data-status-chip 等を含まない q-option ボタン）を返す。 */
const optionButtons = (root: HTMLElement): HTMLButtonElement[] =>
	Array.from(root.querySelectorAll<HTMLButtonElement>("button.q-option"));

describe("AnswerSelector island", () => {
	it("初期表示で全選択肢を出し、解説は隠れている", async () => {
		// Arrange & Act
		const { root } = mountSelector("q-mcq-1", "ア");

		// Assert
		await settle(() => optionButtons(root).length === 2);
		expect(root.querySelector(".q-solution")).toBeNull();
		// 採点前は確定/わからないボタンが出る（確定は選択後のみ。わからないは常時）
		expect(root.textContent).toContain("わからない");
	});

	it("選択肢を選ぶと is-selected が付き「確かめる」が出る", async () => {
		// Arrange
		const { root } = mountSelector("q-mcq-2", "ア");
		await settle(() => optionButtons(root).length === 2);

		// Act: 1つ目（正解 ア）を選ぶ
		optionButtons(root)[0].click();

		// Assert
		await settle(() => optionButtons(root)[0].className.includes("is-selected"));
		expect(root.textContent).toContain("この答えで確かめる");
	});

	it("正解を確定すると解説が開き、チップが correct・フィードバックが正解になる", async () => {
		// Arrange
		const { root } = mountSelector("q-mcq-3", "ア");
		await settle(() => optionButtons(root).length === 2);
		optionButtons(root)[0].click(); // 正解 ア を選択
		await settle(() => root.textContent?.includes("この答えで確かめる") ?? false);

		// Act: 確かめる（submit）
		const confirm = Array.from(root.querySelectorAll("button")).find(
			(b) => b.textContent === "この答えで確かめる",
		);
		confirm?.click();

		// Assert
		await settle(() => optionButtons(root)[0].className.includes("is-correct"));
		expect(root.querySelector(".q-solution")).not.toBeNull();
		expect(root.querySelector(".q-chip")?.classList.contains("q-chip--correct")).toBe(true);
		expect(root.textContent).toContain("正解");
	});

	it("不正解を確定するとチップが review・選択肢が is-wrong になる", async () => {
		// Arrange: 正解は ア、ユーザーは イ を選ぶ
		const { root } = mountSelector("q-mcq-4", "ア");
		await settle(() => optionButtons(root).length === 2);
		optionButtons(root)[1].click(); // 不正解 イ
		await settle(() => root.textContent?.includes("この答えで確かめる") ?? false);

		// Act
		Array.from(root.querySelectorAll("button"))
			.find((b) => b.textContent === "この答えで確かめる")
			?.click();

		// Assert
		await settle(() => optionButtons(root)[1].className.includes("is-wrong"));
		expect(root.querySelector(".q-chip")?.classList.contains("q-chip--review")).toBe(true);
		expect(optionButtons(root)[0].className).toContain("is-correct");
	});

	it("fetch 解決前でも選択肢ボタンが即描画される（SSR-first）", async () => {
		// Arrange: fetchAnswerStatuses を未解決のまま保留し、fetch を待たず描画されることを検証する。
		// Panel は無条件マウントなので、fetch が永久に pending でも選択肢が出る（resolved ゲート廃止の回帰防止）。
		const { fetchAnswerStatuses } = await import("./answerClient");
		vi.mocked(fetchAnswerStatuses).mockImplementationOnce(
			() => new Promise<never>(() => undefined),
		);

		// Act: q-mcq-pending は factory saved に無いので、解決しても selecting のまま（二重の安全）。
		const { root } = mountSelector("q-mcq-pending", "ア");

		// Assert: fetch 未解決でも選択肢・「わからない」が出る
		await settle(() => optionButtons(root).length === 2);
		expect(root.textContent).toContain("わからない");
		expect(root.querySelector(".q-solution")).toBeNull();
	});

	it("回答済みは fetch 後に submitted へ格下げされ、解説とチップが復元される", async () => {
		// Arrange & Act: q-mcq-saved は factory mock が saved（正解 ア）を返す。
		const { root } = mountSelector("q-mcq-saved", "ア");

		// Assert: 解説が開き、チップ correct、選択肢が確定表示（is-correct）になる
		await settle(() => optionButtons(root)[0].className.includes("is-correct"));
		expect(root.querySelector(".q-solution")).not.toBeNull();
		expect(root.querySelector(".q-chip")?.classList.contains("q-chip--correct")).toBe(true);
		expect(root.textContent).toContain("もう一度解く");
	});
});
