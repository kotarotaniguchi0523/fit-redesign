import { useEffect, useRef, useState } from "hono/jsx";
import { FEEDBACK_DURATION } from "../constants";

export type CopyState = "idle" | "success" | "error";

export function useCopyFeedback(text: string): Readonly<{
	state: CopyState;
	copy: () => Promise<void>;
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
		copy: async (): Promise<void> => {
			try {
				await navigator.clipboard.writeText(text);
				setState("success");
			} catch {
				setState("error");
			}
			if (resetTimer.current !== null) {
				window.clearTimeout(resetTimer.current);
			}
			resetTimer.current = window.setTimeout(() => {
				resetTimer.current = null;
				setState("idle");
			}, FEEDBACK_DURATION);
		},
	};
}
