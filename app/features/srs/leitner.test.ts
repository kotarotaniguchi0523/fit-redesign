import { describe, expect, it } from "vitest";
import { MAX_BOX, nextCard, type SrsCard } from "./leitner";

/**
 * Leitner 純関数 nextCard の characterization テスト。
 * recordGrade（localStorage 永続化あり）から抽出した box 遷移ロジックの入出力を
 * テーブルで固定し、抽出前後で挙動が不変であることを保証する。
 * srs.test.ts（recordGrade 経由）と二重に pin することで、リファクタ・リプレイ双方の安全網にする。
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEARN_MS = 10 * 60 * 1000;
const NOW = 1_700_000_000_000;

const card = (box: number, due = NOW, last = NOW): SrsCard => ({ box, due, last });

describe("nextCard（純粋な box 遷移）", () => {
	// [説明, 現カード, 正誤, 期待box, 期待due]
	const cases: [string, SrsCard | undefined, boolean, number, number][] = [
		["未学習に正解 → box1・due+1日", undefined, true, 1, NOW + DAY_MS],
		["box1 に正解 → box2・due+2日", card(1), true, 2, NOW + 2 * DAY_MS],
		["box2 に正解 → box3・due+4日", card(2), true, 3, NOW + 4 * DAY_MS],
		["box3 に正解 → box4・due+8日", card(3), true, 4, NOW + 8 * DAY_MS],
		["box4 に正解 → box5・due+16日", card(4), true, 5, NOW + 16 * DAY_MS],
		["box5 に正解 → box5 で頭打ち・due+16日", card(5), true, 5, NOW + 16 * DAY_MS],
		["未学習に不正解 → box1・due+10分", undefined, false, 1, NOW + RELEARN_MS],
		["box3 に不正解 → box1 リセット・due+10分", card(3), false, 1, NOW + RELEARN_MS],
		["box5 に不正解 → box1 リセット・due+10分", card(5), false, 1, NOW + RELEARN_MS],
	];

	it.each(cases)("%s", (_label, current, isCorrect, expectedBox, expectedDue) => {
		const result = nextCard(current, isCorrect, NOW);
		expect(result.box).toBe(expectedBox);
		expect(result.due).toBe(expectedDue);
		expect(result.last).toBe(NOW);
	});

	it("now を last にそのまま記録する（last は採点時刻）", () => {
		const result = nextCard(card(1), true, NOW + 1234);
		expect(result.last).toBe(NOW + 1234);
	});
});

describe("nextCard（破損した box 値への耐性）", () => {
	// 壊れた box でも returned box が 1..MAX_BOX の整数、due が有限数になることを保証する
	const corruptedBoxCases: [string, number][] = [
		["NaN", Number.NaN],
		["-3（負数）", -3],
		["0（下限未満）", 0],
		["2.5（小数）", 2.5],
	];

	it.each(
		corruptedBoxCases,
	)("box=%s に正解しても returned box は 1..MAX_BOX の整数で due は有限数", (_label, badBox) => {
		const corruptedCard: SrsCard = { box: badBox, due: NOW, last: NOW };
		const result = nextCard(corruptedCard, true, NOW);

		// box は 1..MAX_BOX の整数であること
		expect(Number.isInteger(result.box)).toBe(true);
		expect(result.box).toBeGreaterThanOrEqual(1);
		expect(result.box).toBeLessThanOrEqual(MAX_BOX);
		// due は NaN / Infinity にならないこと
		expect(Number.isFinite(result.due)).toBe(true);
	});
});

describe("nextCard（box 1..MAX_BOX の due 単調増加不変条件）", () => {
	// box が上がるほど due が単調増加することを保証する（MAX_BOX 変更時の回帰ガード）。
	// box=MAX_BOX-1 と box=MAX_BOX は同じ間隔（上限）になるため、1..MAX_BOX-1 は厳密増加、
	// MAX_BOX-1 → MAX_BOX は等値を許容する。
	it("box 1..(MAX_BOX-1) に正解した due が厳密単調増加し、全 due が有限数になる", () => {
		const dues = Array.from({ length: MAX_BOX }, (_, index) => {
			const boxValue = index + 1;
			return nextCard({ box: boxValue, due: NOW, last: NOW }, true, NOW).due;
		});
		// 全 due が有限数であること（NaN / Infinity を弾く）
		expect(dues.every((due) => Number.isFinite(due))).toBe(true);
		// box 1..(MAX_BOX-1) を入力とした due は厳密増加（上限に達するまで間隔が伸びる）
		const beforeCap = dues.slice(0, MAX_BOX - 1);
		const strictlyIncreasing = beforeCap.every(
			(due, index) => index === 0 || (beforeCap[index - 1] as number) < due,
		);
		expect(strictlyIncreasing).toBe(true);
		// box=MAX_BOX-1 と box=MAX_BOX の due は同値（上限で頭打ち）
		expect(dues[MAX_BOX - 2]).toBe(dues[MAX_BOX - 1]);
	});
});
