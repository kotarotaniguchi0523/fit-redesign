import { useEffect, useRef, useState } from "hono/jsx";
import { FEEDBACK_DURATION } from "../constants";
import { writeClipboardText } from "../lib/clipboard";

export type CopyState = "idle" | "success" | "error";

export function useCopyFeedback(text: string): Readonly<{
	state: CopyState;
	copy: (value?: string) => Promise<CopyState>;
}> {
	const [state, setState] = useState<CopyState>("idle");
	const resetTimer = useRef<number | null>(null);
	useEffect(
		() => (): void => {
			if (resetTimer.current !== null) {
				window.clearTimeout(resetTimer.current);
			}
		},
		[],
	);
	return {
		state,
		copy: async (value = text): Promise<CopyState> => {
			const nextState: CopyState = (await writeClipboardText(value)) ? "success" : "error";
			setState(nextState);
			if (resetTimer.current !== null) {
				window.clearTimeout(resetTimer.current);
			}
			resetTimer.current = window.setTimeout(() => {
				resetTimer.current = null;
				setState("idle");
			}, FEEDBACK_DURATION);
			return nextState;
		},
	};
}
