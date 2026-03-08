import {
	MAX_ATTEMPTS_PER_QUESTION,
	QUESTION_ID_RE,
	STORAGE_KEY_PREFIX,
	TIMER_MODES,
	USER_ID_KEY,
} from "../constants";
import type { QuestionId } from "../types";
import { err, ok, type Result } from "../types/result";
import type { AttemptRecord, QuestionTimeRecord, TimerStorageData } from "../types/timer";
import { createLogger } from "./logger";

const logger = createLogger("[TimerStorage]");

// --- Lightweight validation (replaces Zod to keep Zod out of client bundle) ---

function isRecord(v: unknown): v is Record<string, unknown> {
	return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validateAttempt(v: unknown): v is AttemptRecord {
	if (!isRecord(v)) return false;
	return (
		Number.isFinite(v.timestamp) &&
		Number.isFinite(v.duration) &&
		(v.duration as number) >= 0 &&
		typeof v.mode === "string" &&
		TIMER_MODES.has(v.mode) &&
		typeof v.completed === "boolean" &&
		(v.targetTime === undefined || Number.isFinite(v.targetTime))
	);
}

function validateTimerStorageData(
	data: unknown,
): { success: true; data: TimerStorageData } | { success: false; error: string } {
	if (!isRecord(data)) return { success: false, error: "データがオブジェクトではありません" };
	if (data.version !== 1) return { success: false, error: "version が 1 ではありません" };
	if (!isRecord(data.records))
		return { success: false, error: "records がオブジェクトではありません" };

	for (const [key, record] of Object.entries(data.records)) {
		if (!QUESTION_ID_RE.test(key)) {
			return { success: false, error: `不正な questionId キー: ${key}` };
		}
		if (!isRecord(record)) {
			return { success: false, error: `records[${key}] がオブジェクトではありません` };
		}
		if (record.questionId !== key) {
			return { success: false, error: `records のキーと questionId が不一致: ${key}` };
		}
		if (!Array.isArray(record.attempts)) {
			return { success: false, error: `records[${key}].attempts が配列ではありません` };
		}
		for (const attempt of record.attempts) {
			if (!validateAttempt(attempt)) {
				return { success: false, error: `records[${key}] に不正な attempt があります` };
			}
		}
	}

	return { success: true, data: data as TimerStorageData };
}

// --- Core implementation ---

/**
 * ユーザーIDを取得（なければ生成して保存）
 * ブラウザ/デバイス単位でユーザーを識別
 */
export function getUserId(): string {
	try {
		const existing = localStorage.getItem(USER_ID_KEY);
		if (existing) return existing;

		const newId = crypto.randomUUID();
		localStorage.setItem(USER_ID_KEY, newId);
		logger.info("Generated new user ID");
		return newId;
	} catch {
		// localStorageが使えない場合は一時的なIDを返す
		logger.warn("Failed to access localStorage for user ID, using temporary ID");
		return "anonymous";
	}
}

/**
 * ユーザー固有のストレージキーを取得
 */
function getStorageKey(): string {
	return `${STORAGE_KEY_PREFIX}-${getUserId()}`;
}

export type StorageErrorType = "PARSE_ERROR" | "VALIDATION_ERROR" | "STORAGE_UNAVAILABLE";

export interface StorageError {
	type: StorageErrorType;
	message: string;
	cause?: unknown;
}

function createStorageError(
	type: StorageErrorType,
	message: string,
	cause?: unknown,
): StorageError {
	return { type, message, cause };
}

let _isStorageAvailable: boolean | undefined;

function isLocalStorageAvailable(): boolean {
	if (_isStorageAvailable !== undefined) {
		return _isStorageAvailable;
	}
	try {
		const testKey = "__storage_test__";
		localStorage.setItem(testKey, "test");
		localStorage.removeItem(testKey);
		_isStorageAvailable = true;
	} catch {
		_isStorageAvailable = false;
	}
	return _isStorageAvailable;
}

function getInitialData(): TimerStorageData {
	return {
		version: 1,
		records: {},
	};
}

function loadTimerDataUnsafe(): Result<TimerStorageData, StorageError> {
	try {
		const rawData = localStorage.getItem(getStorageKey());

		if (!rawData) {
			logger.info("No existing data found, initializing with empty data");
			return ok(getInitialData());
		}

		const parsed = JSON.parse(rawData);
		const validated = validateTimerStorageData(parsed);

		if (!validated.success) {
			logger.error("Data validation failed", { error: validated.error });
			return err(
				createStorageError("VALIDATION_ERROR", `データ形式が不正です: ${validated.error}`),
			);
		}

		const recordCount = Object.keys(validated.data.records).length;
		logger.info(`Loaded timer data successfully (${recordCount} questions)`);
		return ok(validated.data);
	} catch (error) {
		logger.error("Failed to parse stored data", { error });
		return err(createStorageError("PARSE_ERROR", "Failed to parse stored data", error));
	}
}

function saveTimerDataUnsafe(data: TimerStorageData): Result<void, StorageError> {
	try {
		const serialized = JSON.stringify(data);
		const recordCount = Object.keys(data.records).length;
		localStorage.setItem(getStorageKey(), serialized);
		logger.info(`Saved timer data successfully (${recordCount} questions)`);
		return ok(undefined);
	} catch (error) {
		logger.error("Failed to save data to localStorage", { error });
		return err(
			createStorageError("STORAGE_UNAVAILABLE", "Failed to save data to localStorage", error),
		);
	}
}

function requireStorage(): Result<void, StorageError> {
	if (isLocalStorageAvailable()) {
		return ok(undefined);
	}
	logger.error("LocalStorage is not available");
	return err(createStorageError("STORAGE_UNAVAILABLE", "LocalStorage is not available"));
}

export function loadTimerData(): Result<TimerStorageData, StorageError> {
	const storageCheck = requireStorage();
	if (!storageCheck.ok) {
		return storageCheck;
	}
	return loadTimerDataUnsafe();
}

export function saveTimerData(data: TimerStorageData): Result<void, StorageError> {
	const storageCheck = requireStorage();
	if (!storageCheck.ok) {
		return storageCheck;
	}
	return saveTimerDataUnsafe(data);
}

/**
 * タイマーデータを純粋関数で更新する。
 * updater は元データから新しいデータを返す（元データは変更しない）。
 */
function withTimerData(
	updater: (data: TimerStorageData) => TimerStorageData,
): Result<TimerStorageData, StorageError> {
	const storageCheck = requireStorage();
	if (!storageCheck.ok) {
		return storageCheck;
	}

	const loadResult = loadTimerDataUnsafe();
	if (!loadResult.ok) {
		return loadResult;
	}

	const newData = updater(loadResult.value);
	const saveResult = saveTimerDataUnsafe(newData);
	if (!saveResult.ok) {
		return err(saveResult.error);
	}

	return ok(newData);
}

export function saveAttempt(
	questionId: QuestionId,
	attempt: AttemptRecord,
): Result<void, StorageError> {
	logger.info(
		`Saving attempt for question (mode: ${attempt.mode}, completed: ${attempt.completed})`,
	);

	const result = withTimerData((data) => {
		const currentAttempts = data.records[questionId]?.attempts ?? [];
		const allAttempts = currentAttempts.concat(attempt);
		const trimmedAttempts =
			allAttempts.length > MAX_ATTEMPTS_PER_QUESTION
				? allAttempts.slice(-MAX_ATTEMPTS_PER_QUESTION)
				: allAttempts;

		if (allAttempts.length > MAX_ATTEMPTS_PER_QUESTION) {
			const removedCount = allAttempts.length - MAX_ATTEMPTS_PER_QUESTION;
			logger.info(`Trimmed ${removedCount} old attempts (max: ${MAX_ATTEMPTS_PER_QUESTION})`);
		}

		const updatedRecord: QuestionTimeRecord = {
			questionId,
			attempts: trimmedAttempts,
		};

		return Object.assign({}, data, {
			records: Object.assign({}, data.records, { [questionId]: updatedRecord }),
		});
	});

	if (!result.ok) {
		logger.warn("Failed to load existing data before saving attempt");
		return err(result.error);
	}

	const totalAttempts = result.value.records[questionId]?.attempts.length ?? 0;
	logger.info(`Attempt saved successfully (total attempts: ${totalAttempts})`);

	// Fire-and-forget server sync
	import("./timerSync").then(({ syncToServer }) => {
		syncToServer(getUserId(), result.value);
	}).catch(() => {});

	return ok(undefined);
}

export function clearQuestionRecords(questionId: QuestionId): Result<void, StorageError> {
	logger.info("Clearing records for question");

	const result = withTimerData((data) =>
		Object.assign({}, data, {
			records: Object.fromEntries(
				Object.entries(data.records).filter(([key]) => key !== questionId),
			),
		}),
	);

	if (result.ok) {
		logger.info("Records cleared successfully");

		// Fire-and-forget server clear
		import("./timerSync").then(({ clearOnServer }) => {
			clearOnServer(getUserId(), questionId);
		}).catch(() => {});

		return ok(undefined);
	}
	logger.warn("Failed to load existing data before clearing records");
	return err(result.error);
}
