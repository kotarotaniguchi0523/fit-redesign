import { FEEDBACK_DURATION } from "../constants";

const CLIPBOARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"/></svg>`;

const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>`;

const ERROR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>`;

function initCopyButtons() {
	document.addEventListener("click", (e) => {
		const button = (e.target as HTMLElement).closest(
			"[data-copy-button]",
		) as HTMLButtonElement | null;
		if (!button) return;

		const text = button.getAttribute("data-copy-text");
		if (text == null) return;

		// Prevent double-click during feedback
		if (button.dataset.copying === "true") return;
		button.dataset.copying = "true";

		const iconContainer = button.querySelector("[data-copy-icon]");
		const originalHTML = iconContainer?.innerHTML ?? CLIPBOARD_SVG;

		if (!navigator.clipboard) {
			showFeedback(button, iconContainer, originalHTML, false);
			return;
		}

		navigator.clipboard.writeText(text).then(
			() => showFeedback(button, iconContainer, originalHTML, true),
			() => showFeedback(button, iconContainer, originalHTML, false),
		);
	});
}

function showFeedback(
	button: HTMLButtonElement,
	iconContainer: Element | null,
	originalHTML: string,
	success: boolean,
) {
	if (iconContainer) {
		iconContainer.innerHTML = success ? CHECK_SVG : ERROR_SVG;
	}

	if (success) {
		button.classList.add("text-green-600");
	} else {
		button.classList.add("text-red-600");
	}

	setTimeout(() => {
		if (iconContainer) {
			iconContainer.innerHTML = originalHTML;
		}
		button.classList.remove("text-green-600", "text-red-600");
		delete button.dataset.copying;
	}, FEEDBACK_DURATION);
}

initCopyButtons();
