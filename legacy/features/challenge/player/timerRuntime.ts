import type { QuestionId } from "../../../types";
import type { TimerRuntime } from "../challenge";
import {
	applyElapsedDelta,
	calculateElapsedDelta,
	MAX_REASONABLE_TIMER_DELTA_MS,
} from "../challenge";
import type { ChallengeState } from "../types";

export type MutableTimerRuntime = { -readonly [Key in keyof TimerRuntime]: TimerRuntime[Key] };

export function projectElapsedTime(
	baseElapsedMs: number,
	running: boolean,
	startedAt: number | null,
	now: number,
): number {
	if (!running || startedAt === null) {
		return baseElapsedMs;
	}
	const delta = now - startedAt;
	if (!Number.isFinite(delta) || delta < 0 || delta > MAX_REASONABLE_TIMER_DELTA_MS) {
		return baseElapsedMs;
	}
	return baseElapsedMs + delta;
}

export function sampleChallengeTimer(
	state: ChallengeState,
	runtime: MutableTimerRuntime,
	now: number,
): Readonly<{ state: ChallengeState; deltaMs: number }> {
	const deltaMs = calculateElapsedDelta(runtime, now);
	runtime.lastSample = now;
	if (deltaMs <= 0) {
		return { state, deltaMs: 0 };
	}
	return {
		state: applyElapsedDelta(state, runtime.currentQuestionId, deltaMs),
		deltaMs,
	};
}

export function resetTimerRuntimeInPlace(
	runtime: MutableTimerRuntime,
	questionId: QuestionId | undefined,
): void {
	if (questionId) {
		runtime.currentQuestionId = questionId;
	}
	runtime.lastSample = null;
	runtime.running = false;
}
