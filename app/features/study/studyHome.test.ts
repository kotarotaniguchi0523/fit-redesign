import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTION_GRADED_EVENT, USER_ID_KEY } from "../../constants";
import type { UnitManifestEntry } from "../srs/progressClient";
import { SRS_KEY_PREFIX, type SrsState } from "../srs/srs";
import { initStudyHome } from "./studyHome";

/**
 * studyHome の integration テスト。
 * 4kw のレンダリング最適化（DOM ref キャッシュ化＋document 単一リスナ）が
 * 観測可能な振る舞いを保っていることを pin する。実装詳細ではなく、
 * 「SRS state に基づく値が描画される」「採点イベントで再描画される」
 * 「リスナが document に 1 回だけ登録される（多重発火しない）」を検証する。
 *
 * SRS state は実コードの読み取り経路（loadSrsState → fit-srs-v1:<userId>）に合わせ、
 * localStorage 経由で与える。unitReadiness は box のみに依存し時刻非依存なので、
 * 値（data-overall-value / data-unit-value）は決定的に検証できる。
 */

const USER_ID = "test-user";

/** unitReadiness = round(sum(box) / (n * 5) * 100)。time-independent なので決定的。 */
function setSrsState(state: SrsState): void {
	localStorage.setItem(USER_ID_KEY, USER_ID);
	localStorage.setItem(`${SRS_KEY_PREFIX}:${USER_ID}`, JSON.stringify(state));
}

function card(box: number): { box: number; due: number; last: number } {
	return { box, due: 0, last: 0 };
}

/** index.tsx の data-study-home 構造（最小版）を組む。manifest は要素内に埋め込む。 */
function buildStudyHome(manifest: UnitManifestEntry[]): HTMLElement {
	const root = document.createElement("div");
	root.setAttribute("data-study-home", "");

	const manifestScript = document.createElement("script");
	manifestScript.setAttribute("data-manifest", "");
	manifestScript.setAttribute("type", "application/json");
	manifestScript.textContent = JSON.stringify(manifest);
	root.appendChild(manifestScript);

	const overallValue = document.createElement("span");
	overallValue.setAttribute("data-overall-value", "");
	root.appendChild(overallValue);

	root.append(
		...manifest.map((unit) => {
			const row = document.createElement("div");
			row.setAttribute("data-unit-row", unit.id);
			const value = document.createElement("span");
			value.setAttribute("data-unit-value", "");
			row.appendChild(value);
			return row;
		}),
	);

	document.body.appendChild(root);
	return root;
}

const baseUnit: UnitManifestEntry = {
	id: "base-conversion",
	name: "基数変換",
	description: "desc",
	primaryYear: 2013,
	questionIds: ["q1", "q2"],
};

describe("initStudyHome（描画・再描画・単一リスナ）", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("mount 時に SRS state に基づく overall / unit の値が描画される", () => {
		// Arrange: q1=box5, q2 未学習 → sum=5, n*5=10 → readiness=50%
		setSrsState({ q1: card(5) });
		const root = buildStudyHome([baseUnit]);

		// Act
		initStudyHome();

		// Assert
		expect(root.querySelector("[data-overall-value]")?.textContent).toBe("50%");
		expect(
			root.querySelector('[data-unit-row="base-conversion"] [data-unit-value]')?.textContent,
		).toBe("50%");
	});

	it("QUESTION_GRADED_EVENT を dispatch すると最新 state で再描画される", () => {
		// Arrange: 初期は未学習（0%）で mount
		setSrsState({});
		const root = buildStudyHome([baseUnit]);
		initStudyHome();
		expect(root.querySelector("[data-overall-value]")?.textContent).toBe("0%");

		// Act: state を更新（q1,q2 とも box5 → 100%）して採点イベント発火
		setSrsState({ q1: card(5), q2: card(5) });
		document.dispatchEvent(new Event(QUESTION_GRADED_EVENT));

		// Assert
		expect(root.querySelector("[data-overall-value]")?.textContent).toBe("100%");
	});

	it("複数 [data-study-home] でも採点リスナは document に 1 回だけ登録される（多重発火しない）", () => {
		// Arrange: 2 つの study-home を mount
		setSrsState({ q1: card(5) });
		const rootA = buildStudyHome([baseUnit]);
		const rootB = buildStudyHome([baseUnit]);

		// addEventListener 呼び出しを mount 直前から監視
		const addSpy = vi.spyOn(document, "addEventListener");

		// Act
		initStudyHome();

		// Assert: QUESTION_GRADED_EVENT のリスナは 1 回だけ登録される。
		// （要素ごとに登録すると 2 回になり、1 採点で各要素が複数回 rerender される）
		const gradedRegistrations = addSpy.mock.calls.filter(
			(callArgs) => callArgs[0] === QUESTION_GRADED_EVENT,
		);
		expect(gradedRegistrations).toHaveLength(1);

		// 機能面: 1 回の dispatch で両要素が最新 state を反映する
		setSrsState({ q1: card(5), q2: card(5) });
		document.dispatchEvent(new Event(QUESTION_GRADED_EVENT));
		expect(rootA.querySelector("[data-overall-value]")?.textContent).toBe("100%");
		expect(rootB.querySelector("[data-overall-value]")?.textContent).toBe("100%");
	});
});
