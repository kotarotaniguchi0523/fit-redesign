import { useEffect, useReducer, useRef, useState } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { QUESTION_GRADED_EVENT } from "../../constants";
import {
	completedLapSeconds,
	currentLapMs,
	currentLapSeconds,
	initialLapState,
	type LapState,
	lapReducer,
} from "./lapReducer";
import { formatTime } from "./timeFormat";

/**
 * ラップ式ストップウォッチ島（フローティング UI）。
 *
 * セット（小テスト＝常に5問）をページ表示で自動開始し、ユーザー操作は「✓ 解けた！」打刻と
 * 休憩トグルのみ。各問の所要は「前問採点 or セット開始 → 解けた！押下（無ければ採点時点）」で測る。
 * 計測ロジックは純関数 lapReducer に委譲し、島は Date.now / setInterval / DOM イベントの I/O のみ持つ。
 *
 * 文言規約: 画面に「ラップ」「一時停止」「打刻」「セット」を出さない（学習者向けの平易語に統一）。
 * 3c 連携のため root に data 属性（data-lap-stopwatch / data-set-id / data-current-lap-seconds）を毎描画で出す。
 */

// live tick の再描画間隔（ms）。秒表示なので 250ms で十分滑らか。
const TICK_INTERVAL_MS = 250;
// 打刻フィードバックの表示時間（ms）。
const FEEDBACK_DURATION_MS = 1500;

interface LapStopwatchProps {
	questionIds: string[];
}

// QUESTION_GRADED_EVENT の detail 形（島は questionId のみ参照。正誤は採点側が使う）。
interface QuestionGradedDetail {
	questionId: string;
}

// 採点直後に一瞬出す強調表示（直近ラップ）。
interface Feedback {
	questionNumber: string;
	seconds: number | null;
}

// 新しいセット ID を生成する（ID 生成用途なので Date.now / Math.random を許容）。
function generateSetId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// questionId 末尾の Q 番号（"...q3" → "3"）を取り出す正規表現（頻繁呼び出しのため top-level に固定）。
const QUESTION_NUMBER_PATTERN = /q(\d+)$/;

// questionId（exam1-2013-q3 等）から表示用の Q 番号（"3"）を取り出す。
function questionNumber(questionId: string): string {
	const match = questionId.match(QUESTION_NUMBER_PATTERN);
	return match ? match[1] : questionId;
}

// 1問の所要秒の表示（NULL＝10分超の外れ値は "—"）。フィードバックと一覧で共用。
function formatLapSeconds(seconds: number | null): string {
	return seconds === null ? "—" : `${seconds}秒`;
}

// current-lap-seconds（data 属性用）。確定相当の秒（reducer の currentLapSeconds）を文字列へ。
// idle/done は進行中ラップが無いので空文字（"0" を有効な0秒と誤解させない）。外れ値（10分超 = NULL）も空文字。
function currentLapSecondsAttr(state: LapState, now: number): string {
	if (state.phase !== "running" && state.phase !== "paused") {
		return "";
	}
	const seconds = currentLapSeconds(state, now);
	return seconds === null ? "" : String(seconds);
}

export default function LapStopwatch({ questionIds }: LapStopwatchProps): JSX.Element {
	const [state, dispatch] = useReducer(lapReducer, initialLapState);
	// live tick: カウンタを進めるたびに再描画して経過秒を更新する。
	const [, setTick] = useState(0);
	const [feedback, setFeedback] = useState<Feedback | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	// 打刻フィードバックの自動消去タイマー。連続採点で前のタイマーが後の表示を消さないよう ref で管理する。
	const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// マウント時に自動開始（セット ID を生成して start を dispatch）。
	useEffect(() => {
		dispatch({
			type: "start",
			now: Date.now(),
			setId: generateSetId(),
			questionIds,
		});
		// questionIds はカード単位で固定。マウント時に1回だけ開始する。
	}, []);

	// live tick: running のときだけ 250ms ごとに再描画する。
	// done/paused/idle は表示が動かないので interval を張らない（unmount でも必ず片付ける）。
	useEffect(() => {
		function clearTick(): void {
			if (intervalRef.current !== null) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		}
		if (state.phase !== "running") {
			clearTick();
			return;
		}
		intervalRef.current = setInterval(() => setTick((value) => value + 1), TICK_INTERVAL_MS);
		return clearTick;
	}, [state.phase]);

	// 採点イベントの自動打刻フォールバック。対象が未採点なら grade を dispatch し、直近ラップを一瞬強調する。
	useEffect(() => {
		const onGraded = (event: Event): void => {
			const detail = (event as CustomEvent<QuestionGradedDetail>).detail;
			if (!(detail && state.remaining.includes(detail.questionId))) {
				return;
			}
			const now = Date.now();
			const seconds = currentLapSeconds(state, now);
			dispatch({ type: "grade", now, questionId: detail.questionId });
			setFeedback({ questionNumber: questionNumber(detail.questionId), seconds });
			// 連続採点に備え、前回の自動消去タイマーを止めてから貼り直す。
			if (feedbackTimerRef.current !== null) {
				clearTimeout(feedbackTimerRef.current);
			}
			feedbackTimerRef.current = setTimeout(() => {
				setFeedback(null);
				feedbackTimerRef.current = null;
			}, FEEDBACK_DURATION_MS);
		};
		document.addEventListener(QUESTION_GRADED_EVENT, onGraded);
		return (): void => document.removeEventListener(QUESTION_GRADED_EVENT, onGraded);
	}, [
		state.remaining,
		state.punchElapsedMs,
		state.lapStartAt,
		state.pausedMs,
		state.pausedAt,
		state.phase,
	]);

	// unmount 時に保留中の feedback タイマーを片付ける（採点ごとの再購読では消さない）。
	useEffect(
		() => (): void => {
			if (feedbackTimerRef.current !== null) {
				clearTimeout(feedbackTimerRef.current);
			}
		},
		[],
	);

	// タブを隠したら一時停止、戻したら再開（経過時間の不正な膨張を防ぐ）。
	useEffect(() => {
		const onVisibility = (): void => {
			const now = Date.now();
			if (document.hidden && state.phase === "running") {
				dispatch({ type: "pause", now });
			} else if (!document.hidden && state.phase === "paused") {
				dispatch({ type: "resume", now });
			}
		};
		document.addEventListener("visibilitychange", onVisibility);
		return (): void => document.removeEventListener("visibilitychange", onVisibility);
	}, [state.phase]);

	const now = Date.now();
	const currentMs = currentLapMs(state, now);
	const currentSeconds = Math.round(currentMs / 1000);
	const isDone = state.phase === "done";
	const isPaused = state.phase === "paused";
	// 完走時は確定合計、走行中は現ラップを加算した暫定合計。
	const totalSeconds = completedLapSeconds(state) + (isDone ? 0 : currentSeconds);

	return (
		<div
			data-lap-stopwatch=""
			data-set-id={state.setId ?? ""}
			data-current-lap-seconds={currentLapSecondsAttr(state, now)}
			class="lap-sw"
		>
			<div class="lap-sw__inner">
				<div class="lap-sw__stats">
					{isDone ? (
						<p class="lap-sw__headline">
							全{state.laps.length}問おわり！ 合計 {formatTime(totalSeconds)}
						</p>
					) : (
						<>
							<p class="lap-sw__progress">あと {state.remaining.length} 問</p>
							<p class="lap-sw__current">この問題 {formatTime(currentSeconds)}</p>
							<p class="lap-sw__total">合計 {formatTime(totalSeconds)}</p>
						</>
					)}

					{feedback ? (
						<p class="lap-sw__feedback">
							Q{feedback.questionNumber} {formatLapSeconds(feedback.seconds)}
						</p>
					) : null}

					{state.laps.length > 0 ? (
						<p class="lap-sw__laps">
							{state.laps
								.map(
									(lap) =>
										`Q${questionNumber(lap.questionId)} ${formatLapSeconds(lap.durationSeconds)}`,
								)
								.join(" / ")}
						</p>
					) : null}
				</div>

				{isDone ? null : (
					<div class="lap-sw__actions">
						<button
							type="button"
							class="lap-sw__punch"
							onClick={(): void => dispatch({ type: "punch", now: Date.now() })}
						>
							✓ 解けた！
						</button>
						<button
							type="button"
							class="lap-sw__break"
							onClick={(): void => {
								const clickedAt = Date.now();
								if (isPaused) {
									dispatch({ type: "resume", now: clickedAt });
								} else {
									dispatch({ type: "pause", now: clickedAt });
								}
							}}
						>
							{isPaused ? "休憩中・タップで再開" : "☕ 休憩"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
