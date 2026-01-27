import { err, ok, type Result } from "../types/result";
import type { AttemptRecord, QuestionTimeRecord, TimerStorageData } from "../types/timer";
import { formatZodError, TimerStorageDataSchema } from "../types/timer";
import { createLogger } from "./logger";

const USER_ID_KEY = "fit-exam-user-id";
const STORAGE_KEY_PREFIX = "fit-exam-timer-records";
const MAX_ATTEMPTS_PER_QUESTION = 50;

/**
 * ユーザーIDを取得（なければ生成して保存）
 * ブラウザ/デバイス単位でユーザーを識別
 */
function getUserId(): string {
	try {
		let userId = localStorage.getItem(USER_ID_KEY);
		if (!userId) {
			userId = crypto.randomUUID();
			localStorage.setItem(USER_ID_KEY, userId);
			logger.info("Generated new user ID");
		}
		return userId;
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

const logger = createLogger("[TimerStorage]");

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

function isLocalStorageAvailable(): boolean {
	try {
		const testKey = "__storage_test__";
		localStorage.setItem(testKey, "test");
		localStorage.removeItem(testKey);
		return true;
	} catch {
		return false;
	}
}

function getInitialData(): TimerStorageData {
	return {
		version: 1,
		records: {},
	};
}

export function loadTimerData(): Result<TimerStorageData, StorageError> {
	if (!isLocalStorageAvailable()) {
		logger.error("LocalStorage is not available");
		return err(createStorageError("STORAGE_UNAVAILABLE", "LocalStorage is not available"));
	}

	try {
		const rawData = localStorage.getItem(getStorageKey());

		if (!rawData) {
			logger.info("No existing data found, initializing with empty data");
			return ok(getInitialData());
		}

		const parsed = JSON.parse(rawData);
		const validated = TimerStorageDataSchema.safeParse(parsed);

		if (!validated.success) {
			logger.error("Data validation failed", { error: formatZodError(validated.error) });
			return err(
				createStorageError(
					"VALIDATION_ERROR",
					`データ形式が不正です: ${formatZodError(validated.error)}`,
					validated.error,
				),
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

export function saveTimerData(data: TimerStorageData): Result<void, StorageError> {
	if (!isLocalStorageAvailable()) {
		logger.error("LocalStorage is not available");
		return err(createStorageError("STORAGE_UNAVAILABLE", "LocalStorage is not available"));
	}

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

export function saveAttempt(
	questionId: string,
	attempt: AttemptRecord,
): Result<void, StorageError> {
	logger.info(
		`Saving attempt for question (mode: ${attempt.mode}, completed: ${attempt.completed})`,
	);

	const loadResult = loadTimerData();
	if (!loadResult.ok) {
		logger.warn("Failed to load existing data before saving attempt");
		return err(loadResult.error);
	}

	const data = loadResult.value;

	const existingRecord = data.records[questionId];
	const currentAttempts = existingRecord?.attempts || [];

	const updatedAttempts = [...currentAttempts, attempt];

	if (updatedAttempts.length > MAX_ATTEMPTS_PER_QUESTION) {
		const removedCount = updatedAttempts.length - MAX_ATTEMPTS_PER_QUESTION;
		updatedAttempts.splice(0, updatedAttempts.length - MAX_ATTEMPTS_PER_QUESTION);
		logger.info(`Trimmed ${removedCount} old attempts (max: ${MAX_ATTEMPTS_PER_QUESTION})`);
	}

	const updatedRecord: QuestionTimeRecord = {
		questionId,
		attempts: updatedAttempts,
	};

	data.records[questionId] = updatedRecord;

	const saveResult = saveTimerData(data);
	if (saveResult.ok) {
		logger.info(`Attempt saved successfully (total attempts: ${updatedAttempts.length})`);
	}

	return saveResult;
}

export function clearQuestionRecords(questionId: string): Result<void, StorageError> {
	logger.info("Clearing records for question");

	const loadResult = loadTimerData();
	if (!loadResult.ok) {
		logger.warn("Failed to load existing data before clearing records");
		return err(loadResult.error);
	}

	const data = loadResult.value;

	const hadRecord = questionId in data.records;
	delete data.records[questionId];

	const saveResult = saveTimerData(data);
	if (saveResult.ok) {
		logger.info(`Records cleared successfully (had existing data: ${hadRecord})`);
	}

	return saveResult;
}
