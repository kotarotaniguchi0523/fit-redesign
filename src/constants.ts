// --- Storage ---

export const USER_ID_KEY = "fit-exam-user-id";
export const STORAGE_KEY_PREFIX = "fit-exam-timer-records";
export const MAX_ATTEMPTS_PER_QUESTION = 50;

// --- Timer ---

export const TIMER_INTERVAL_MS = 1000;
export const DEFAULT_TARGET_TIME = 60;
export const TARGET_TIME_PRESETS = [
	{ label: "1分", value: 60 },
	{ label: "2分", value: 120 },
	{ label: "3分", value: 180 },
	{ label: "5分", value: 300 },
] as const;

export const ALERT_SOUND = {
	FIRST_FREQUENCY: 800,
	SECOND_FREQUENCY: 1000,
	GAIN: 0.3,
	DURATION: 0.3,
	SECOND_DELAY: 350,
} as const;

// --- Copy button ---

export const FEEDBACK_DURATION = 2000;

// --- Validation (keep in sync with src/types/timer.ts schemas) ---

export const QUESTION_ID_RE = /^exam[1-9]-\d{4}-q\d+$/;
export const TIMER_MODES = new Set(["stopwatch", "countdown"]);
