import * as assert from "remix/assert";
import { render } from "remix/component/test";
import { describe, it } from "remix/test";

import { ExamIdSchema, QuestionIdSchema, UnitTabIdSchema } from "../../../types/browser.ts";
import type { ExamPlayerProps } from "../player/types.ts";
import { ExamPlayer } from "./exam-player.tsx";

/** 島は props だけで動くため、テスト内の設問で完結する。 */
const PLAYER_PROPS: ExamPlayerProps = {
	examId: ExamIdSchema.parse("exam1-2017"),
	examNumber: 1,
	year: "2017",
	unitId: UnitTabIdSchema.parse("unit-base-conversion"),
	playerTitle: "小テスト1: 基数変換 (2017)",
	questions: [
		{
			id: QuestionIdSchema.parse("exam1-2017-q1"),
			number: 1,
			text: "2進数 1010 を 10 進数に変換せよ。",
			answer: "10",
			explanation: "8 + 2 = 10。",
		},
		{
			id: QuestionIdSchema.parse("exam1-2017-q2"),
			number: 2,
			text: "16進数 FF を 10 進数に変換せよ。",
			answer: "255",
		},
	],
	mode: "exam",
};

/**
 * 小テストプレイヤー（clientEntry）のブラウザーコンポーネントテスト。
 *
 * サーバー描画ではプレビューが出るだけなので、解答の開示・自己判定・問題一覧の
 * 開閉は「操作後にどう変わるか」を島の境界で確認する（Testing ガイドの方針）。
 */
describe("ExamPlayer", () => {
	it("解答を開いて自己判定できる", async (t) => {
		const { $, act, cleanup, container } = render(<ExamPlayer {...PLAYER_PROPS} />);
		t.after(cleanup);

		const reveal = $('button[aria-label="解答を表示"]');
		assert.ok(reveal instanceof HTMLButtonElement, container.innerHTML.slice(0, 500));

		await act(() => reveal.click());
		assert.ok($("#exam-answer-heading"), "解答パネルが開く");

		const correct = $('button[aria-label="正解として記録"]');
		assert.ok(correct instanceof HTMLButtonElement);
		await act(() => correct.click());

		assert.equal(correct.disabled, true, "判定後は再判定できない");
	});

	it("問題一覧ドロワを開ける", async (t) => {
		const { $, act, cleanup, container } = render(<ExamPlayer {...PLAYER_PROPS} />);
		t.after(cleanup);

		assert.ok($("[data-player]"), container.innerHTML.slice(0, 500));
		assert.equal($('aside[aria-label="問題一覧"]'), null, "初期状態は閉じている");

		const open = $('button[aria-label="問題一覧を開く"]');
		assert.ok(open instanceof HTMLButtonElement);
		await act(() => open.click());

		assert.ok($('aside[aria-label="問題一覧"]'), "ドロワが開く");
	});
});
