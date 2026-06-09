import { useActionState } from "hono/jsx/dom";
import { FEEDBACK_DURATION } from "../../constants";

type CopyState = "idle" | "success" | "error";
type CopyEvent = "copy" | "reset";

interface CopyButtonProps {
	text: string;
	className: string;
	ariaLabel: string;
	title: string;
}

export default function CopyButton({ text, className, ariaLabel, title }: CopyButtonProps) {
	const [state, dispatch] = useActionState(
		async (_prev: CopyState, formData: FormData): Promise<CopyState> => {
			const event = formData.get("event") as CopyEvent;
			if (event === "reset") return "idle";
			try {
				if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
				await navigator.clipboard.writeText(text);
				return "success";
			} catch {
				return "error";
			}
		},
		"idle" as CopyState,
	);
	const feedbackClass =
		state === "success" ? "text-green-600" : state === "error" ? "text-red-600" : "";

	return (
		<button
			type="button"
			class={`${className} ${feedbackClass}`}
			aria-label={ariaLabel}
			title={title}
			onClick={() => {
				const formData = new FormData();
				formData.set("event", "copy");
				Promise.resolve(dispatch(formData)).then(() => {
					setTimeout(() => {
						const resetData = new FormData();
						resetData.set("event", "reset");
						dispatch(resetData);
					}, FEEDBACK_DURATION);
				});
			}}
		>
			{state === "success" ? <CheckIcon /> : state === "error" ? <ErrorIcon /> : <CopyIcon />}
		</button>
	);
}

function CopyIcon() {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<title>copy</title>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<title>copied</title>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

function ErrorIcon() {
	return (
		<svg
			class="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<title>copy failed</title>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
			/>
		</svg>
	);
}
