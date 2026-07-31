import { useState } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { FEEDBACK_DURATION } from "../constants";
import { CheckIcon, CopyIcon, ErrorIcon } from "./icons";

type CopyState = "idle" | "success" | "error";

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

function stateLabel(state: CopyState): string {
	if (state === "success") {
		return "コピーしました";
	}
	if (state === "error") {
		return "コピーできませんでした";
	}
	return "Markdownでコピー";
}

export default function CopyButton({
	text,
	className,
	ariaLabel,
	title,
}: CopyButtonProps): JSX.Element {
	const [state, setState] = useState<CopyState>("idle");

	const copy = async (): Promise<void> => {
		try {
			await navigator.clipboard.writeText(text);
			setState("success");
		} catch {
			setState("error");
		}
		setTimeout(() => setState("idle"), FEEDBACK_DURATION);
	};
	const feedbackClass = feedbackClassFor(state);
	const label = stateLabel(state);

	return (
		<button
			type="button"
			class={`${className} ${feedbackClass}`}
			aria-label={state === "idle" ? ariaLabel : label}
			title={title}
			onClick={copy}
		>
			<StateIcon state={state} />
			<span aria-live="polite">{label}</span>
		</button>
	);
}
