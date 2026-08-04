import type { JSX } from "hono/jsx/jsx-runtime";
import { CheckIcon, CopyIcon, ErrorIcon } from "./icons";
import { type CopyState, useCopyFeedback } from "./useCopyFeedback";

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
	const { state, copy } = useCopyFeedback(text);
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
