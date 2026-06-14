import { render } from "hono/jsx/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QUESTION_GRADED_EVENT } from "../../constants";
import LapStopwatch from "./$LapStopwatch";

/**
 * ラップ式ストップウォッチ島のテスト。
 *
 * QuestionTimer.island.test.tsx の作法（hono/jsx/dom の render・document.body 追加・
 * vi.useFakeTimers / advance・settle）に倣う。島は自動開始するため、マウント直後の
 * 自動 start dispatch を settle で反映させてから assert する。
 */

// このセットで使う問題 ID（全5問）。
const QUESTION_IDS = [
	"exam1-2013-q1",
	"exam1-2013-q2",
	"exam1-2013-q3",
	"exam1-2013-q4",
	"exam1-2013-q5",
];

function mount(questionIds: string[] = QUESTION_IDS): HTMLElement {
	const el = document.createElement("div");
	document.body.appendChild(el);
	render(<LapStopwatch questionIds={questionIds} />, el);
	return el;
}

// 1 フレーム相当の時間(ms)。fake timer 化した requestAnimationFrame を 1 回発火させるのに十分。
const FRAME_MS = 16;

// effect / dispatch を反映させる。hono/jsx/dom は useEffect を requestAnimationFrame 経由で flush するため、
// microtask を流すだけでなく fake timer を 1 フレーム進めて保留中の effect（自動 start 等）を確実に実行する。
async function settle(): Promise<void> {
	await Promise.resolve();
	await vi.advanceTimersByTimeAsync(FRAME_MS);
	await Promise.resolve();
}

// fake timer を進めつつ前後で settle する（setInterval の tick 反映用）。
async function advance(ms: number): Promise<void> {
	await settle();
	await vi.advanceTimersByTimeAsync(ms);
	await settle();
}

// 主ボタン「✓ 解けた！」を取得する。
function getPunchButton(el: HTMLElement): HTMLButtonElement {
	const buttons = Array.from(el.querySelectorAll("button"));
	const punch = buttons.find((button) => button.textContent?.includes("解けた"));
	return punch as HTMLButtonElement;
}

// 休憩ボタンを取得する（休憩中は文言が変わるので「休憩」を含むボタンで拾う）。
function getBreakButton(el: HTMLElement): HTMLButtonElement {
	const buttons = Array.from(el.querySelectorAll("button"));
	const breakButton = buttons.find(
		(button) => button.textContent?.includes("休憩") || button.textContent?.includes("再開"),
	);
	return breakButton as HTMLButtonElement;
}

// 採点イベントを document に発火する（島は questionId のみ参照する）。
function dispatchGraded(questionId: string): void {
	document.dispatchEvent(new CustomEvent(QUESTION_GRADED_EVENT, { detail: { questionId } }));
}

// 島ルート（data-lap-stopwatch を持つ要素）。
function getRoot(el: HTMLElement): HTMLElement {
	return el.querySelector("[data-lap-stopwatch]") as HTMLElement;
}

describe("LapStopwatch island", () => {
	beforeEach(() => {
		// Date も fake 化し、advanceTimersByTime で Date.now() が連動するようにする（経過秒を決定的にする）。
		// hono/jsx/dom は useEffect を requestAnimationFrame 経由で flush するため rAF も fake 対象に含める。
		vi.useFakeTimers({
			toFake: ["setInterval", "clearInterval", "setTimeout", "requestAnimationFrame", "Date"],
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("マウントで自動開始し「あと 5 問」「この問題 00:00」が表示される", async () => {
		const el = mount();
		await settle();

		expect(el.textContent).toContain("あと 5 問");
		expect(el.textContent).toContain("この問題 00:00");
	});

	it("主ボタン「✓ 解けた！」が表示され押下できる", async () => {
		const el = mount();
		await settle();

		const punch = getPunchButton(el);
		expect(punch).toBeDefined();
		expect(punch.textContent).toContain("解けた");
		expect(() => punch.click()).not.toThrow();
	});

	it("採点イベントでラップが確定し「あと 4 問」へ進み、打刻フィードバックが一瞬出る", async () => {
		const el = mount();
		await settle();

		await advance(45_000); // 45秒解答
		dispatchGraded("exam1-2013-q1");
		await settle();

		expect(el.textContent).toContain("あと 4 問");
		// 採点直後は打刻フィードバック要素が一瞬出る（laps 一覧の恒久表示とは別の強調要素）。
		const feedback = el.querySelector(".lap-sw__feedback");
		expect(feedback?.textContent).toMatch(/Q1\s.*秒/);

		// フィードバック要素は時間経過で消える（laps 一覧の「Q1 …秒」は残る）。
		await advance(3000);
		expect(el.querySelector(".lap-sw__feedback")).toBeNull();
	});

	it("休憩ボタンで「休憩中・タップで再開」になり、再度押すと復帰する", async () => {
		const el = mount();
		await settle();

		getBreakButton(el).click();
		await settle();
		expect(el.textContent).toContain("休憩中・タップで再開");

		getBreakButton(el).click();
		await settle();
		expect(el.textContent).not.toContain("休憩中・タップで再開");
	});

	it("画面テキストに「ラップ」「一時停止」「打刻」「セット」を出さない", async () => {
		const el = mount();
		await settle();

		dispatchGraded("exam1-2013-q1");
		await settle();

		const text = el.textContent ?? "";
		expect(text).not.toContain("ラップ");
		expect(text).not.toContain("一時停止");
		expect(text).not.toContain("打刻");
		expect(text).not.toContain("セット");
	});

	it("data 属性: set-id が空でなく current-lap-seconds が数値文字列", async () => {
		const el = mount();
		await settle();
		await advance(2000);

		const root = getRoot(el);
		expect(root.getAttribute("data-set-id")).not.toBe("");
		expect(root.getAttribute("data-current-lap-seconds")).toMatch(/^\d+$/);
	});

	it("全問を採点すると「全N問おわり！」が表示される", async () => {
		const el = mount();
		await settle();

		await QUESTION_IDS.reduce(async (previous, questionId) => {
			await previous;
			await advance(10_000);
			dispatchGraded(questionId);
			await settle();
		}, Promise.resolve());
		await settle();

		expect(el.textContent).toContain(`全${QUESTION_IDS.length}問おわり！`);
	});
});
