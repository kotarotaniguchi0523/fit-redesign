import { useActionState } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { CheckIcon, CopyIcon, ErrorIcon } from "../../components/icons";
import { FEEDBACK_DURATION } from "../../constants";

type CopyState = "idle" | "success" | "error";

const INITIAL_STATE: CopyState = "idle";

interface CopyButtonProps {
	text: string;
	className: string;
	ariaLabel: string;
	title: string;
}

function feedbackClassFor(state: CopyState): string {
	if (state === "success") {
		return "text-green-600";
	}
	if (state === "error") {
		return "text-red-600";
	}
	return "";
}

function StateIcon({ state }: { state: CopyState }): JSX.Element {
	if (state === "success") {
		return <CheckIcon />;
	}
	if (state === "error") {
		return <ErrorIcon />;
	}
	return <CopyIcon />;
}

export default function CopyButton({
	text,
	className,
	ariaLabel,
	title,
}: CopyButtonProps): JSX.Element {
	const [state, dispatch] = useActionState(
		async (_prev: CopyState, formData: FormData): Promise<CopyState> => {
			// FormData の値を直接比較する（"copy" 以外＝"reset"/null は idle へ）。as キャスト不要。
			if (formData.get("event") === "reset") {
				return "idle";
			}
			try {
				if (!navigator.clipboard) {
					throw new Error("Clipboard API unavailable");
				}
				await navigator.clipboard.writeText(text);
				return "success";
			} catch {
				return "error";
			}
		},
		INITIAL_STATE,
	);
	const feedbackClass = feedbackClassFor(state);

	return (
		<button
			type="button"
			class={`${className} ${feedbackClass}`}
			aria-label={ariaLabel}
			title={title}
			onClick={(): void => {
				const formData = new FormData();
				formData.set("event", "copy");
				Promise.resolve(dispatch(formData))
					.then(() => {
						setTimeout(() => {
							const resetData = new FormData();
							resetData.set("event", "reset");
							dispatch(resetData);
						}, FEEDBACK_DURATION);
					})
					.catch(() => {
						/* コピー演出の失敗は無視 */
					});
			}}
		>
			<StateIcon state={state} />
		</button>
	);
}
