import type { QuestionId } from "../../../types";
import type { TimerRuntime } from "../challenge";

export type MutableTimerRuntime = { -readonly [Key in keyof TimerRuntime]: TimerRuntime[Key] };

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
