import { useEffect, useRef, useState } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { ChatGPTIcon, CheckIcon, CopyIcon, ErrorIcon, GeminiIcon } from "./icons";
import { type CopyState, useCopyFeedback } from "./useCopyFeedback";

interface CopyButtonProps {
	text: string;
	askText?: string;
	className: string;
	ariaLabel: string;
	title: string;
	idleLabel?: string;
}

const GEMINI_URL_LENGTH_LIMIT = 1800;

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

function stateLabel(state: CopyState, idleLabel: string): string {
	if (state === "success") {
		return "コピーしました";
	}
	if (state === "error") {
		return "コピーできませんでした";
	}
	return idleLabel;
}

export default function CopyButton({
	text,
	askText,
	className,
	ariaLabel,
	title,
	idleLabel = "Markdownでコピー",
}: CopyButtonProps): JSX.Element {
	const { state, copy } = useCopyFeedback(text);
	const [menuOpen, setMenuOpen] = useState(false);
	const [shareMessage, setShareMessage] = useState("");
	const controlRef = useRef<HTMLDivElement | null>(null);
	const menuButtonRef = useRef<HTMLButtonElement | null>(null);
	const feedbackClass = feedbackClassFor(state);
	const label = stateLabel(state, idleLabel);
	const askPrompt = `この問題を解いて、考え方を順を追って説明してください。\n\n${askText ?? text}`;
	const chatGptUrl = `https://chatgpt.com/?q=${encodeURIComponent(askPrompt)}`;
	const geminiPromptUrl = `https://gemini.google.com/app?q=${encodeURIComponent(askPrompt)}`;
	const geminiUrlIsShortEnough = geminiPromptUrl.length <= GEMINI_URL_LENGTH_LIMIT;
	const geminiUrl = geminiUrlIsShortEnough ? geminiPromptUrl : "https://gemini.google.com/app";

	useEffect(() => {
		if (!menuOpen) {
			return;
		}
		const closeOutside = (event: PointerEvent): void => {
			if (event.target instanceof Node && !controlRef.current?.contains(event.target)) {
				setMenuOpen(false);
			}
		};
		document.addEventListener("pointerdown", closeOutside);
		return (): void => document.removeEventListener("pointerdown", closeOutside);
	}, [menuOpen]);

	const askGemini = async (): Promise<void> => {
		if (!geminiUrlIsShortEnough) {
			const copyState = await copy(askPrompt);
			setShareMessage(
				copyState === "success"
					? "質問文が長いためコピーしました。Geminiで貼り付けてください。"
					: "質問文をコピーできませんでした。通常のコピーをお試しください。",
			);
		}
		setMenuOpen(false);
	};
	const closeOnEscape = (event: KeyboardEvent): void => {
		if (event.key === "Escape") {
			setMenuOpen(false);
			menuButtonRef.current?.focus();
		}
	};

	return (
		<div ref={controlRef} class={`copy-control ${className}`}>
			<button
				ref={menuButtonRef}
				type="button"
				class={`copy-control__copy ${feedbackClass}`}
				aria-label={state === "idle" ? `${ariaLabel}、コピー方法を選択` : label}
				aria-expanded={menuOpen ? "true" : "false"}
				aria-haspopup="menu"
				title={title}
				onClick={(): void => setMenuOpen(!menuOpen)}
			>
				<StateIcon state={state} />
				<span class="sr-only" aria-live="polite">
					{label}
				</span>
			</button>
			{menuOpen ? (
				<div class="copy-ai-menu" aria-label="コピー方法" role="menu">
					<button
						type="button"
						class="copy-ai-menu__item"
						role="menuitem"
						onClick={async (): Promise<void> => {
							await copy();
							setMenuOpen(false);
						}}
						onKeyDown={closeOnEscape}
					>
						<CopyIcon />
						<span>Markdownをコピー</span>
					</button>
					<a
						class="copy-ai-menu__item"
						role="menuitem"
						href={chatGptUrl}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(): void => setMenuOpen(false)}
						onKeyDown={closeOnEscape}
					>
						<ChatGPTIcon />
						<span>ChatGPTに質問</span>
					</a>
					<a
						class="copy-ai-menu__item"
						role="menuitem"
						href={geminiUrl}
						target="_blank"
						rel="noopener noreferrer"
						onClick={askGemini}
						onKeyDown={closeOnEscape}
					>
						<GeminiIcon />
						<span>Geminiに質問</span>
					</a>
				</div>
			) : null}
			<span class="sr-only" role="status" aria-live="polite">
				{shareMessage}
			</span>
		</div>
	);
}
