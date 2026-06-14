/**
 * ラップ式ストップウォッチの純粋な状態遷移（reducer）。
 *
 * セット = exam（小テスト）単位・常に5問。ページ表示で自動開始し、ユーザー操作は
 * 「✓ 解けた！」打刻（任意）と一時停止/再開のみ。各問の duration は「ラップ開始（前問の採点完了
 * or セット開始）→ 解けた！押下」の純粋な解答時間で測る。押下が無ければ採点アクションが自動打刻する。
 *
 * I/O・Date.now・乱数を持たない純関数。now（epoch ms）と setId は action で外から注入する
 * （island が生成して dispatch）。duration は秒、内部時刻は ms。
 */

// 1ラップが10分を超えたら計測不能として NULL（タブ放置などの外れ値を除外）。
export const LAP_MAX_SECONDS = 600;

export interface Lap {
	questionId: string;
	durationSeconds: number | null;
}

export type LapPhase = "idle" | "running" | "paused" | "done";

export interface LapState {
	setId: string | null;
	phase: LapPhase;
	remaining: string[]; // まだ採点していない問題（順不同で採点されうる）
	lapStartAt: number; // 現ラップ開始時刻（前問採点完了 or セット開始）
	// 「解けた！」押下時点の純解答経過(ms)。押下した瞬間に凍結するので、押下後の一時停止に影響されない。
	// 未押下なら null（採点時に now から自動打刻）。
	punchElapsedMs: number | null;
	pausedAt: number | null; // 一時停止の開始時刻（phase=paused のとき）
	pausedMs: number; // 現ラップ中の一時停止累積(ms)
	laps: Lap[]; // 採点済みの確定ラップ
}

export type LapAction =
	| { type: "start"; now: number; setId: string; questionIds: string[] }
	| { type: "punch"; now: number }
	| { type: "grade"; now: number; questionId: string }
	| { type: "pause"; now: number }
	| { type: "resume"; now: number }
	| { type: "retry"; now: number; setId: string; questionId: string };

export const initialLapState: LapState = {
	setId: null,
	phase: "idle",
	remaining: [],
	lapStartAt: 0,
	punchElapsedMs: null,
	pausedAt: null,
	pausedMs: 0,
	laps: [],
};

// running 状態を新規に作る（start と retry の共通初期化）。
function freshRunningState(setId: string, remaining: string[], now: number): LapState {
	return {
		setId,
		phase: "running",
		remaining,
		lapStartAt: now,
		punchElapsedMs: null,
		pausedAt: null,
		pausedMs: 0,
		laps: [],
	};
}

// 一時停止中なら停止分を pausedMs に確定して running へ。それ以外は state をそのまま返す。
function settlePause(state: LapState, now: number): LapState {
	if (state.phase !== "paused" || state.pausedAt == null) {
		return state;
	}
	return {
		...state,
		phase: "running",
		pausedAt: null,
		pausedMs: state.pausedMs + (now - state.pausedAt),
	};
}

// 純解答経過(ms) → 確定 duration（秒）。10分超は NULL（外れ値）。
function durationFromMs(activeMs: number): number | null {
	const seconds = Math.max(0, Math.round(activeMs / 1000));
	return seconds > LAP_MAX_SECONDS ? null : seconds;
}

// 1問を採点してラップを確定し、次ラップを採点時点から開始する。
function gradeQuestion(state: LapState, questionId: string, now: number): LapState {
	// 押下済みならその凍結経過、無ければ採点時点までの経過（解けた！〜採点は次問に算入しない）。
	const activeMs = state.punchElapsedMs ?? now - state.lapStartAt - state.pausedMs;
	const lap: Lap = { questionId, durationSeconds: durationFromMs(activeMs) };
	const remaining = state.remaining.filter((id) => id !== questionId);
	return {
		...state,
		remaining,
		laps: [...state.laps, lap],
		// 次ラップは採点完了時点（now）から。押下・一時停止累積はリセット。
		lapStartAt: now,
		punchElapsedMs: null,
		pausedAt: null,
		pausedMs: 0,
		phase: remaining.length === 0 ? "done" : "running",
	};
}

export function lapReducer(state: LapState, action: LapAction): LapState {
	switch (action.type) {
		case "start":
			return freshRunningState(action.setId, [...action.questionIds], action.now);

		case "punch":
			// 走行中・一時停止中に有効（休憩タップ前に「解けた！」を押せる UI のため paused も受ける）。
			// 押し直しは最後の押下が有効（凍結経過を上書き）。一時停止中は currentLapMs が
			// pausedAt 時点で凍結した経過を返すので、休憩分は混入しない。
			if (state.phase !== "running" && state.phase !== "paused") {
				return state;
			}
			return { ...state, punchElapsedMs: currentLapMs(state, action.now) };

		case "grade": {
			// 採点対象がセット内に残っていなければ無視（採点済みカードの読み返し等）。
			if (
				(state.phase !== "running" && state.phase !== "paused") ||
				!state.remaining.includes(action.questionId)
			) {
				return state;
			}
			// 未押下で一時停止中の採点は、停止分を確定してから now 基準で打刻する。
			// 押下済みなら凍結経過を使うため、押下後の一時停止は影響しない。
			const base = state.punchElapsedMs == null ? settlePause(state, action.now) : state;
			return gradeQuestion(base, action.questionId, action.now);
		}

		case "pause":
			if (state.phase !== "running") {
				return state;
			}
			return { ...state, phase: "paused", pausedAt: action.now };

		case "resume":
			return settlePause(state, action.now);

		case "retry":
			// 完走後の「もう一度解く」は、その1問だけの再計測に縮退（新しい setId）。
			return freshRunningState(action.setId, [action.questionId], action.now);

		default:
			return state;
	}
}

// --- 表示用の派生値（島が now を渡して使う。状態は変えない） ---

// 現在の問題の経過(ms)。一時停止中は停止時点で止まる。
export function currentLapMs(state: LapState, now: number): number {
	if (state.phase === "idle" || state.phase === "done") {
		return 0;
	}
	const frozenNow = state.phase === "paused" && state.pausedAt != null ? state.pausedAt : now;
	return Math.max(0, frozenNow - state.lapStartAt - state.pausedMs);
}

// 確定ラップの合計（秒）。NULL ラップは 0 として扱う。
export function completedLapSeconds(state: LapState): number {
	return state.laps.reduce((sum, lap) => sum + (lap.durationSeconds ?? 0), 0);
}

// 現ラップを採点した場合に確定する秒（押下済みは凍結経過、未押下は now までの経過）。10分超は NULL。
// 島の表示属性・採点フォールバックの双方が使い、外れ値判定（durationFromMs）を一元化する。
export function currentLapSeconds(state: LapState, now: number): number | null {
	return durationFromMs(state.punchElapsedMs ?? currentLapMs(state, now));
}
