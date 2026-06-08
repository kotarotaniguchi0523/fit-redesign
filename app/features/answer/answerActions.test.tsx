import { afterEach, describe, expect, it, vi } from "vitest";
import { QUESTION_GRADED_EVENT } from "../../constants";
import { recordAnswer } from "./answerActions";

/**
 * recordAnswer の振る舞いを検証する（AAA・古典派寄り）。
 *
 * public 関数の入力 → 出力(boolean) と観測可能な副作用（QUESTION_GRADED_EVENT の dispatch、
 * saveAnswer への payload）を確認する。実装詳細ではなく振る舞いを locked して、リファクタ耐性を持たせる。
 *
 * 依存の境界づけ:
 * - saveAnswer は本物をラップして spy する（差し替えではなく観測）。本物が走るので、saveAnswer 内部で
 *   発火する QUESTION_GRADED_EVENT も「本物の経路」で観測でき、payload も spy で捕捉できる。失敗ケース
 *   のみ mockRejectedValueOnce で reject させて catch を踏ませる。
 * - getUserId は "anonymous" 固定。本物の saveAnswer が anonymous 時に /answer/submit の fetch を
 *   skip する（answerClient.ts L57）ため、テストでネットワークノイズが出ない。イベント発火は fetch より
 *   前なので観測に影響しない。
 *
 * QUESTION_GRADED_EVENT は saveAnswer の await より前で同期 dispatch されるため、DOM レンダ用の
 * settle() ポーリングは不要。listener 登録 → await recordAnswer → 即 assert で観測できる。
 */

vi.mock("../../lib/userId", () => ({ getUserId: () => "anonymous" }));

vi.mock("./answerClient", async () => {
	const actual = await vi.importActual<typeof import("./answerClient")>("./answerClient");
	return { ...actual, saveAnswer: vi.fn(actual.saveAnswer) };
});

import { saveAnswer } from "./answerClient";

const savedAnswer = vi.mocked(saveAnswer);

interface GradedDetail {
	questionId: string;
	isCorrect: boolean;
}

/** QUESTION_GRADED_EVENT の detail を捕捉する listener を仕込み、捕捉済み配列と解除関数を返す。 */
function captureGradedEvents(): { events: GradedDetail[]; stop: () => void } {
	const events: GradedDetail[] = [];
	const handler = (event: Event) => {
		if (event instanceof CustomEvent) events.push(event.detail);
	};
	document.addEventListener(QUESTION_GRADED_EVENT, handler);
	return { events, stop: () => document.removeEventListener(QUESTION_GRADED_EVENT, handler) };
}

/** [data-question-timer] を持つカードを作る（readTimerDuration が経過秒を読み取る経路）。 */
function cardWithTimer(elapsedSeconds: number): HTMLElement {
	const card = document.createElement("div");
	const timer = document.createElement("div");
	timer.setAttribute("data-question-timer", "");
	timer.dataset.elapsed = String(elapsedSeconds);
	card.append(timer);
	return card;
}

afterEach(() => {
	document.body.innerHTML = "";
	vi.clearAllMocks();
});

describe("recordAnswer", () => {
	it("成功時は true を返し、saveAnswer を正しい payload で1回呼ぶ", async () => {
		// Arrange
		const card = cardWithTimer(42);

		// Act
		const recorded = await recordAnswer({
			questionId: "q-record-1",
			card,
			selectedLabel: "ア",
			isCorrect: true,
		});

		// Assert
		expect(recorded).toBe(true);
		expect(savedAnswer).toHaveBeenCalledTimes(1);
		expect(savedAnswer).toHaveBeenCalledWith({
			questionId: "q-record-1",
			selectedLabel: "ア",
			isCorrect: true,
			duration: 42,
		});
	});

	it("成功時に QUESTION_GRADED_EVENT を questionId/正誤付きで dispatch する", async () => {
		// Arrange
		const { events, stop } = captureGradedEvents();

		// Act
		await recordAnswer({
			questionId: "q-record-2",
			card: null,
			selectedLabel: "イ",
			isCorrect: false,
		});
		stop();

		// Assert
		expect(events).toEqual([{ questionId: "q-record-2", isCorrect: false }]);
	});

	it("card に timer が無ければ duration を undefined にする", async () => {
		// Arrange
		const card = document.createElement("div");

		// Act
		const recorded = await recordAnswer({
			questionId: "q-record-3",
			card,
			selectedLabel: "ウ",
			isCorrect: true,
		});

		// Assert
		expect(recorded).toBe(true);
		expect(savedAnswer).toHaveBeenCalledWith({
			questionId: "q-record-3",
			selectedLabel: "ウ",
			isCorrect: true,
			duration: undefined,
		});
	});

	it("連打/二重送信: 同一 questionId が in-flight 中の再呼び出しは false を返し saveAnswer は1回だけ", async () => {
		// Arrange: saveAnswer の解決を保留させ、in-flight 中の状態を作る
		let release: () => void = () => undefined;
		savedAnswer.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);

		// Act: 2 回目を await する前（inFlight.add は await より前の同期処理）に発火する
		const first = recordAnswer({
			questionId: "q-dedup",
			card: null,
			selectedLabel: "ア",
			isCorrect: true,
		});
		const second = recordAnswer({
			questionId: "q-dedup",
			card: null,
			selectedLabel: "ア",
			isCorrect: true,
		});

		// Assert: 2 回目は dedup されて即 false
		expect(await second).toBe(false);

		// 1 回目を解決させると true
		release();
		expect(await first).toBe(true);
		expect(savedAnswer).toHaveBeenCalledTimes(1);
	});

	it("in-flight 解放後は同一 questionId を再度記録できる（dedup は一時的）", async () => {
		// Arrange & Act: 1 回目を完了させてから 2 回目
		const firstRecorded = await recordAnswer({
			questionId: "q-dedup-reset",
			card: null,
			selectedLabel: "ア",
			isCorrect: true,
		});
		const secondRecorded = await recordAnswer({
			questionId: "q-dedup-reset",
			card: null,
			selectedLabel: "ア",
			isCorrect: true,
		});

		// Assert
		expect(firstRecorded).toBe(true);
		expect(secondRecorded).toBe(true);
		expect(savedAnswer).toHaveBeenCalledTimes(2);
	});

	it("saveAnswer が失敗したら false を返す", async () => {
		// Arrange
		savedAnswer.mockRejectedValueOnce(new Error("network down"));

		// Act
		const recorded = await recordAnswer({
			questionId: "q-record-fail",
			card: null,
			selectedLabel: "ア",
			isCorrect: true,
		});

		// Assert
		expect(recorded).toBe(false);
		expect(savedAnswer).toHaveBeenCalledTimes(1);
	});
});
