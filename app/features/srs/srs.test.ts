import { afterEach, describe, expect, it } from "vitest";
import {
	buildDailySet,
	isDue,
	isNew,
	loadSrsState,
	recordGrade,
	type SrsState,
	unitReadiness,
} from "./srs";

/**
 * SRS エンジン（Leitner ボックス）の古典派ユニットテスト。
 * 純粋関数（isDue / isNew / buildDailySet / unitReadiness）は state を引数で与え、
 * 入力 → 出力を AAA で検証する。localStorage 依存（recordGrade / loadSrsState）は
 * jsdom の実 localStorage を out-of-process 依存として使う。
 * 実装詳細ではなく観測可能な振る舞い（次回出題日・出題セットの構成・到達度）を pin し、
 * リファクタリング耐性を持たせる。
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEARN_MS = 10 * 60 * 1000;
const NOW = 1_700_000_000_000; // 固定の基準時刻

const card = (box: number, due: number, last = NOW) => ({ box, due, last });

describe("recordGrade（localStorage 永続化あり）", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("新規問題に正解すると box=1・due は1日後・last は now", () => {
		// Act
		const state = recordGrade("q1", true, NOW);

		// Assert
		expect(state.q1).toEqual({ box: 1, due: NOW + DAY_MS, last: NOW });
	});

	it("正解を重ねると box が上がり次回間隔が伸びる（box2 → box3 で 4日後）", () => {
		// Arrange: box2 まで上げる
		recordGrade("q1", true, NOW); // box1
		recordGrade("q1", true, NOW); // box2

		// Act
		const state = recordGrade("q1", true, NOW); // box3

		// Assert: box3 の間隔は 4 日
		expect(state.q1.box).toBe(3);
		expect(state.q1.due).toBe(NOW + 4 * DAY_MS);
	});

	it("box が 5 を超えて上がらず、間隔も 16日で頭打ち（MAX_BOX）", () => {
		// Arrange / Act: 6回正解しても box は 5 まで
		Array.from({ length: 6 }, () => recordGrade("q1", true, NOW));

		// Assert
		const state = loadSrsState();
		expect(state.q1.box).toBe(5);
		expect(state.q1.due).toBe(NOW + 16 * DAY_MS);
	});

	it("不正解は box=1 にリセットし、10分後に再出題する", () => {
		// Arrange: box3 まで上げてから
		recordGrade("q1", true, NOW);
		recordGrade("q1", true, NOW);
		recordGrade("q1", true, NOW);

		// Act
		const state = recordGrade("q1", false, NOW);

		// Assert
		expect(state.q1.box).toBe(1);
		expect(state.q1.due).toBe(NOW + RELEARN_MS);
	});

	it("同じ問題の再採点は1エントリを上書きする（追記しない）", () => {
		// Arrange
		recordGrade("q1", true, NOW);

		// Act
		recordGrade("q1", false, NOW + 1000);

		// Assert: q1 は1キーのみ、最新の不正解で上書き
		const state = loadSrsState();
		expect(Object.keys(state)).toEqual(["q1"]);
		expect(state.q1.box).toBe(1);
		expect(state.q1.last).toBe(NOW + 1000);
	});

	it("loadSrsState は recordGrade の永続化結果を読み戻す", () => {
		// Arrange
		recordGrade("q1", true, NOW);
		recordGrade("q2", false, NOW);

		// Act
		const state = loadSrsState();

		// Assert
		expect(Object.keys(state).sort()).toEqual(["q1", "q2"]);
	});
});

describe("isDue", () => {
	it("未学習（state に無い）問題は出題対象（新規扱い）", () => {
		expect(isDue({}, "q1", NOW)).toBe(true);
	});

	it("due が現在以前なら出題対象", () => {
		const state: SrsState = { q1: card(1, NOW) };
		expect(isDue(state, "q1", NOW)).toBe(true);
	});

	it("due が未来なら出題対象外", () => {
		const state: SrsState = { q1: card(2, NOW + DAY_MS) };
		expect(isDue(state, "q1", NOW)).toBe(false);
	});
});

describe("isNew", () => {
	it("state に無ければ新規", () => {
		expect(isNew({}, "q1")).toBe(true);
	});

	it("state にあれば新規ではない", () => {
		const state: SrsState = { q1: card(1, NOW) };
		expect(isNew(state, "q1")).toBe(false);
	});
});

describe("buildDailySet", () => {
	it("期限到来の復習を新規より先頭に並べ、内訳を返す", () => {
		// Arrange: q1=期限到来の復習、q2=新規
		const state: SrsState = { q1: card(1, NOW - DAY_MS) };

		// Act
		const set = buildDailySet(state, ["q1", "q2"], NOW);

		// Assert
		expect(set.questionIds).toEqual(["q1", "q2"]);
		expect(set.dueReviewCount).toBe(1);
		expect(set.newCount).toBe(1);
	});

	it("まだ期限が来ていない復習は除外する", () => {
		// Arrange: q1 は期限前
		const state: SrsState = { q1: card(2, NOW + DAY_MS) };

		// Act
		const set = buildDailySet(state, ["q1", "q2"], NOW);

		// Assert: 新規 q2 のみ
		expect(set.questionIds).toEqual(["q2"]);
		expect(set.dueReviewCount).toBe(0);
		expect(set.newCount).toBe(1);
	});

	it("新規は maxNew 件まで（一度に出して圧倒しない）", () => {
		// Act
		const set = buildDailySet({}, ["n1", "n2", "n3", "n4"], NOW, { maxNew: 2 });

		// Assert
		expect(set.questionIds).toEqual(["n1", "n2"]);
		expect(set.newCount).toBe(2);
	});

	it("合計 maxTotal で打ち切り、復習を優先して新規を落とす", () => {
		// Arrange: 復習2件 + 新規多数、maxTotal=2
		const state: SrsState = {
			r1: card(1, NOW - DAY_MS),
			r2: card(1, NOW - DAY_MS),
		};

		// Act
		const set = buildDailySet(state, ["r1", "r2", "n1", "n2"], NOW, { maxTotal: 2 });

		// Assert: 復習2件で埋まり新規は0
		expect(set.questionIds).toEqual(["r1", "r2"]);
		expect(set.dueReviewCount).toBe(2);
		expect(set.newCount).toBe(0);
	});

	it("空の問題リストは空セット", () => {
		expect(buildDailySet({}, [], NOW)).toEqual({
			questionIds: [],
			dueReviewCount: 0,
			newCount: 0,
		});
	});
});

describe("unitReadiness", () => {
	it("空の単元は 0", () => {
		expect(unitReadiness({}, [])).toBe(0);
	});

	it("全問が最高 box(5) なら 100", () => {
		const state: SrsState = { q1: card(5, NOW), q2: card(5, NOW) };
		expect(unitReadiness(state, ["q1", "q2"])).toBe(100);
	});

	it("未学習問題は 0 点として按分する（2問中 1問 box5・1問未学習 → 50）", () => {
		const state: SrsState = { q1: card(5, NOW) };
		expect(unitReadiness(state, ["q1", "q2"])).toBe(50);
	});

	it("box が MAX_BOX を超える壊れた状態でも 100 で頭打ち", () => {
		const state: SrsState = { q1: card(99, NOW) };
		expect(unitReadiness(state, ["q1"])).toBe(100);
	});
});
