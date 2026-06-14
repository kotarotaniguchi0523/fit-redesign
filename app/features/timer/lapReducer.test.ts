import { describe, expect, it } from "vitest";
import {
	completedLapSeconds,
	currentLapMs,
	initialLapState,
	type LapState,
	lapReducer,
} from "./lapReducer";

/**
 * ラップ式 reducer の純関数テスト。設計のエッジケースを網羅する。
 * now は ms、duration は秒。時刻は基準 T からの相対で与える。
 */

const T = 1_700_000_000_000;
const SEC = 1000;
const QS = ["exam1-2013-q1", "exam1-2013-q2", "exam1-2013-q3", "exam1-2013-q4", "exam1-2013-q5"];

// セット開始済みの running 状態を作る。
function started(now = T): LapState {
	return lapReducer(initialLapState, { type: "start", now, setId: "set-1", questionIds: QS });
}

describe("start（自動開始・setId 払い出し）", () => {
	it("running になり setId と対象5問を持つ", () => {
		const state = started();
		expect(state.phase).toBe("running");
		expect(state.setId).toBe("set-1");
		expect(state.remaining).toEqual(QS);
		expect(state.lapStartAt).toBe(T);
	});
});

describe("grade（採点でラップ確定）", () => {
	it("押下なしの採点は採点時点までを自動打刻し、次ラップは採点時点から", () => {
		// q1 を 45秒で採点（押下なし）
		const s1 = lapReducer(started(), { type: "grade", now: T + 45 * SEC, questionId: QS[0] });
		expect(s1.laps).toEqual([{ questionId: QS[0], durationSeconds: 45 }]);
		expect(s1.remaining).toEqual(QS.slice(1));
		expect(s1.lapStartAt).toBe(T + 45 * SEC); // 次ラップは採点完了時点から
		expect(s1.phase).toBe("running");
	});

	it("「解けた！」押下→採点 では押下時点で duration が確定し、解けた！〜採点は次問に算入しない", () => {
		// T+30 に押下、T+50 に採点 → q1 の duration は 30秒（押下時点）
		const punched = lapReducer(started(), { type: "punch", now: T + 30 * SEC });
		const graded = lapReducer(punched, { type: "grade", now: T + 50 * SEC, questionId: QS[0] });
		expect(graded.laps[0].durationSeconds).toBe(30); // 押下時点
		expect(graded.lapStartAt).toBe(T + 50 * SEC); // 次ラップは採点完了(T+50)から＝押下〜採点(20秒)は算入されない
	});

	it("採点前の押し直しは最後の押下が有効", () => {
		let s = lapReducer(started(), { type: "punch", now: T + 20 * SEC });
		s = lapReducer(s, { type: "punch", now: T + 35 * SEC }); // 押し直し
		s = lapReducer(s, { type: "grade", now: T + 60 * SEC, questionId: QS[0] });
		expect(s.laps[0].durationSeconds).toBe(35); // 最後の押下
	});

	it("順不同の採点はその瞬間に採点された問題にラップが付く", () => {
		// q3 を先に採点
		const s = lapReducer(started(), { type: "grade", now: T + 40 * SEC, questionId: QS[2] });
		expect(s.laps).toEqual([{ questionId: QS[2], durationSeconds: 40 }]);
		expect(s.remaining).toEqual([QS[0], QS[1], QS[3], QS[4]]);
	});

	it("1ラップ10分超は duration NULL", () => {
		const s = lapReducer(started(), { type: "grade", now: T + 601 * SEC, questionId: QS[0] });
		expect(s.laps[0].durationSeconds).toBeNull();
	});

	it("セット外の問題・採点済みの読み返しは無視", () => {
		const s1 = lapReducer(started(), { type: "grade", now: T + 30 * SEC, questionId: QS[0] });
		// 採点済み q1 をもう一度 grade しても変化なし
		const s2 = lapReducer(s1, { type: "grade", now: T + 40 * SEC, questionId: QS[0] });
		expect(s2).toEqual(s1);
		// セット外の問題も無視
		const s3 = lapReducer(s1, { type: "grade", now: T + 40 * SEC, questionId: "exam9-2017-q1" });
		expect(s3).toEqual(s1);
	});
});

describe("punch（押下のみ・採点なし）", () => {
	it("押下しても採点が来なければラップは確定しない（保留）", () => {
		const s = lapReducer(started(), { type: "punch", now: T + 30 * SEC });
		expect(s.laps).toEqual([]);
		expect(s.punchElapsedMs).toBe(30 * SEC); // 押下時点の経過を凍結
		expect(s.remaining).toEqual(QS);
	});

	it("idle / done での押下は無視（punchElapsedMs は null のまま）", () => {
		// idle（未開始）
		const idle = lapReducer(initialLapState, { type: "punch", now: T });
		expect(idle.punchElapsedMs).toBeNull();
		// done（全問採点済み）でも押下は無視
		const done = QS.reduce(
			(s, questionId, index) =>
				lapReducer(s, { type: "grade", now: T + (index + 1) * 30 * SEC, questionId }),
			started(),
		);
		expect(done.phase).toBe("done");
		expect(lapReducer(done, { type: "punch", now: T + 1000 * SEC }).punchElapsedMs).toBeNull();
	});

	it("一時停止中の押下は pausedAt 時点の経過で凍結する（休憩前に解けた！を押せる）", () => {
		// T 開始 → T+10s で一時停止 → T+20s で押下（休憩中）
		const paused = lapReducer(started(), { type: "pause", now: T + 10 * SEC });
		const s = lapReducer(paused, { type: "punch", now: T + 20 * SEC });
		// 凍結は pausedAt(T+10) 基準＝10秒。休憩中の経過(T+10〜T+20)は混入しない。
		expect(s.punchElapsedMs).toBe(10 * SEC);
		// 採点すると凍結した10秒で確定する（採点までの休憩・経過は算入されない）
		const graded = lapReducer(s, { type: "grade", now: T + 100 * SEC, questionId: QS[0] });
		expect(graded.laps[0].durationSeconds).toBe(10);
	});

	it("押下後の一時停止は押下時点 duration に影響しない（押下=30秒で凍結）＋次問へ正しく復帰", () => {
		// T+30 押下（経過30秒で凍結）→ T+50 一時停止 → T+200 採点。押下後の停止は無視。
		let s = lapReducer(started(), { type: "punch", now: T + 30 * SEC });
		s = lapReducer(s, { type: "pause", now: T + 50 * SEC });
		s = lapReducer(s, { type: "grade", now: T + 200 * SEC, questionId: QS[0] });
		expect(s.laps[0].durationSeconds).toBe(30);
		// 次ラップへ running 復帰し、一時停止の残骸が漏れない
		expect(s.phase).toBe("running");
		expect(s.pausedAt).toBeNull();
		expect(s.pausedMs).toBe(0);
		expect(s.lapStartAt).toBe(T + 200 * SEC);
	});

	it("一時停止中に未押下で採点すると、停止前の経過だけ算入し running に復帰する", () => {
		// lapStart T、T+10 一時停止、resume せず T+70 採点 → 停止前10秒のみ
		let s = lapReducer(started(), { type: "pause", now: T + 10 * SEC });
		s = lapReducer(s, { type: "grade", now: T + 70 * SEC, questionId: QS[0] });
		expect(s.laps[0].durationSeconds).toBe(10);
		expect(s.phase).toBe("running");
		expect(s.pausedAt).toBeNull();
		expect(s.pausedMs).toBe(0);
	});
});

describe("pause / resume（タブ非表示で一時停止・復帰で再開）", () => {
	it("一時停止区間は duration から差し引かれる", () => {
		// T+10 に一時停止、T+40 に再開（30秒停止）、T+70 に採点 → 経過70秒 − 停止30秒 = 40秒
		let s = lapReducer(started(), { type: "pause", now: T + 10 * SEC });
		expect(s.phase).toBe("paused");
		s = lapReducer(s, { type: "resume", now: T + 40 * SEC });
		expect(s.phase).toBe("running");
		s = lapReducer(s, { type: "grade", now: T + 70 * SEC, questionId: QS[0] });
		expect(s.laps[0].durationSeconds).toBe(40);
	});

	it("currentLapMs は一時停止中は停止時点で止まる", () => {
		const paused = lapReducer(started(), { type: "pause", now: T + 25 * SEC });
		// now が進んでも停止時点(25秒)で固定
		expect(currentLapMs(paused, T + 100 * SEC)).toBe(25 * SEC);
	});

	it("currentLapMs は idle/done で 0、running は resume 後に停止分を差し引く", () => {
		expect(currentLapMs(initialLapState, T + 100 * SEC)).toBe(0); // idle
		// pause T+10 → resume T+40（停止30秒）→ now T+70 で経過70秒−停止30秒=40秒
		let s = lapReducer(started(), { type: "pause", now: T + 10 * SEC });
		s = lapReducer(s, { type: "resume", now: T + 40 * SEC });
		expect(currentLapMs(s, T + 70 * SEC)).toBe(40 * SEC);
	});

	it("completedLapSeconds は NULL ラップ（10分超）を0として合計する", () => {
		// q1 を10分超(NULL)、q2 を30秒で採点
		let s = lapReducer(started(), { type: "grade", now: T + 601 * SEC, questionId: QS[0] });
		s = lapReducer(s, { type: "grade", now: T + 601 * SEC + 30 * SEC, questionId: QS[1] });
		expect(s.laps[0].durationSeconds).toBeNull();
		expect(completedLapSeconds(s)).toBe(30);
	});
});

describe("完走と合計", () => {
	it("全問採点で phase=done になり、各ラップが確定する", () => {
		let s = started();
		const durations = [40, 30, 50, 20, 60];
		let now = T;
		QS.forEach((qid, index) => {
			now += durations[index] * SEC;
			s = lapReducer(s, { type: "grade", now, questionId: qid });
		});
		expect(s.phase).toBe("done");
		expect(s.remaining).toEqual([]);
		expect(s.laps.map((l) => l.durationSeconds)).toEqual([40, 30, 50, 20, 60]);
		expect(completedLapSeconds(s)).toBe(200);
	});
});

describe("回答済みありで残り問題のみ対象", () => {
	it("start に渡す questionIds が残り問題のみなら、その完走で done", () => {
		const remainingQs = [QS[3], QS[4]];
		let s = lapReducer(initialLapState, {
			type: "start",
			now: T,
			setId: "set-2",
			questionIds: remainingQs,
		});
		s = lapReducer(s, { type: "grade", now: T + 30 * SEC, questionId: QS[3] });
		s = lapReducer(s, { type: "grade", now: T + 50 * SEC, questionId: QS[4] });
		expect(s.phase).toBe("done");
		expect(s.laps).toHaveLength(2);
	});
});

describe("完走後の retry（1問だけ再計測に縮退）", () => {
	it("完走(done)後の retry は確定済み5ラップを捨てて対象1問・新 setId に縮退する", () => {
		// 全5問を30秒間隔で採点して done に
		const done = QS.reduce(
			(acc, qid, index) =>
				lapReducer(acc, { type: "grade", now: T + (index + 1) * 30 * SEC, questionId: qid }),
			started(),
		);
		expect(done.phase).toBe("done");
		expect(done.laps).toHaveLength(5);

		// done から retry
		const retryAt = T + QS.length * 30 * SEC + 100 * SEC;
		const s = lapReducer(done, {
			type: "retry",
			now: retryAt,
			setId: "set-retry",
			questionId: QS[0],
		});
		expect(s.phase).toBe("running");
		expect(s.setId).toBe("set-retry");
		expect(s.remaining).toEqual([QS[0]]);
		expect(s.laps).toEqual([]); // 確定ラップは破棄
		expect(s.lapStartAt).toBe(retryAt);
	});
});
