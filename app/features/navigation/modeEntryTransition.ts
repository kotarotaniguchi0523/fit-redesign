const PENDING_MODE_ENTRY_KEY = "fit-mode-entry-transition";
const MODE_ENTRY_FALLBACK_MS = 5000;
const UNIT_YEAR_ROUTE = /^\/([^/]+)\/(\d{4})\/?$/;
const EXAM_NUMBER = /^\d+$/;

type PendingModeEntry = Readonly<{ target: string }>;
let modeEntryFallbackTimer: number | undefined;

function parsePendingModeEntry(value: string | null): PendingModeEntry | null {
	if (!value) {
		return null;
	}
	try {
		const parsed: unknown = JSON.parse(value);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"target" in parsed &&
			typeof parsed.target === "string"
		) {
			return { target: parsed.target };
		}
	} catch {
		// A stale or malformed session marker should never interfere with navigation.
	}
	return null;
}

function targetForModeLink(link: HTMLAnchorElement): PendingModeEntry | null {
	const sourcePath = UNIT_YEAR_ROUTE.exec(window.location.pathname);
	const destination = new URL(link.href, window.location.href);
	if (
		!sourcePath ||
		destination.origin !== window.location.origin ||
		destination.pathname !== `/${sourcePath[1]}/${sourcePath[2]}/exam`
	) {
		return null;
	}

	const examNumber = destination.searchParams.get("exam");
	if (!(examNumber && EXAM_NUMBER.test(examNumber))) {
		return null;
	}

	return { target: `${destination.pathname}${destination.search}` };
}

function clearPendingModeEntry(): void {
	try {
		window.sessionStorage.removeItem(PENDING_MODE_ENTRY_KEY);
	} catch {
		// Cross-page motion is an enhancement; unavailable storage means no motion.
	}
}

function storePendingModeEntry(pending: PendingModeEntry): void {
	try {
		window.sessionStorage.setItem(PENDING_MODE_ENTRY_KEY, JSON.stringify(pending));
	} catch {
		// Cross-page motion is an enhancement; unavailable storage means no motion.
	}
}

function consumePendingModeEntry(): PendingModeEntry | null {
	try {
		const pending = parsePendingModeEntry(window.sessionStorage.getItem(PENDING_MODE_ENTRY_KEY));
		window.sessionStorage.removeItem(PENDING_MODE_ENTRY_KEY);
		return pending;
	} catch {
		return null;
	}
}

function clearModeEntryAttribute(): void {
	document.documentElement.removeAttribute("data-mode-entry");
	if (modeEntryFallbackTimer !== undefined) {
		window.clearTimeout(modeEntryFallbackTimer);
		modeEntryFallbackTimer = undefined;
	}
}

function onModeLinkClick(event: MouseEvent): void {
	clearPendingModeEntry();
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.detail === 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey ||
		!(event.target instanceof Element)
	) {
		return;
	}

	const link = event.target.closest<HTMLAnchorElement>("a[href]");
	if (!link) {
		return;
	}
	if (
		!link.matches(".question-timer-link, .exam-section__start") ||
		(link.target !== "" && link.target !== "_self") ||
		link.hasAttribute("download")
	) {
		return;
	}

	const pending = targetForModeLink(link);
	if (pending) {
		storePendingModeEntry(pending);
	}
}

function onModeEntryAnimationEnd(event: AnimationEvent): void {
	if (
		event.target instanceof Element &&
		event.target.matches(".exam-player__question[data-mode-transition-target]")
	) {
		clearModeEntryAttribute();
	}
}

if (typeof document !== "undefined") {
	const pending = consumePendingModeEntry();
	if (pending && `${window.location.pathname}${window.location.search}` === pending.target) {
		document.documentElement.setAttribute("data-mode-entry", "");
		modeEntryFallbackTimer = window.setTimeout(clearModeEntryAttribute, MODE_ENTRY_FALLBACK_MS);
	}

	document.addEventListener("click", onModeLinkClick);
	document.addEventListener("animationend", onModeEntryAnimationEnd);
	document.addEventListener("animationcancel", onModeEntryAnimationEnd);
}
