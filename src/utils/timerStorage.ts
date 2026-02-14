import type { QuestionId } from "../types";
import { err, ok, type Result } from "../types/result";
import type { AttemptRecord, QuestionTimeRecord, TimerStorageData } from "../types/timer";
import { formatZodError, TimerStorageDataSchema } from "../types/timer";
import { createLogger } from "./logger";

const USER_ID_KEY = "fit-exam-user-id";
const STORAGE_KEY_PREFIX = "fit-exam-timer-records";
const MAX_ATTEMPTS_PER_QUESTION = 50;

const logger = createLogger("[TimerStorage]");

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
		return ok(validated.data as TimerStorageData);
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

function mutateTimerData(
	mutator: (data: TimerStorageData) => void,
): Result<TimerStorageData, StorageError> {
	const storageCheck = requireStorage();
	if (!storageCheck.ok) {
		return storageCheck;
	}

	const loadResult = loadTimerDataUnsafe();
	if (!loadResult.ok) {
		return loadResult;
	}

	mutator(loadResult.value);

	const saveResult = saveTimerDataUnsafe(loadResult.value);
	if (!saveResult.ok) {
		return err(saveResult.error);
	}

	return ok(loadResult.value);
}

export function saveAttempt(
	questionId: QuestionId,
	attempt: AttemptRecord,
): Result<void, StorageError> {
	logger.info(
		`Saving attempt for question (mode: ${attempt.mode}, completed: ${attempt.completed})`,
	);

	const mutateResult = mutateTimerData((data) => {
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
	});

	if (!mutateResult.ok) {
		logger.warn("Failed to load existing data before saving attempt");
		return err(mutateResult.error);
	}

	const totalAttempts = mutateResult.value.records[questionId]?.attempts.length ?? 0;
	logger.info(`Attempt saved successfully (total attempts: ${totalAttempts})`);
	return ok(undefined);
}

export function clearQuestionRecords(questionId: QuestionId): Result<void, StorageError> {
	logger.info("Clearing records for question");

	let hadRecord = false;
	const mutateResult = mutateTimerData((data) => {
		hadRecord = questionId in data.records;
		delete data.records[questionId];
	});

	if (mutateResult.ok) {
		logger.info(`Records cleared successfully (had existing data: ${hadRecord})`);
		return ok(undefined);
	}
	logger.warn("Failed to load existing data before clearing records");
	return err(mutateResult.error);
}
