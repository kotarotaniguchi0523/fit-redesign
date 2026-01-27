import { useCallback, useEffect, useMemo, useState } from "react";
import type { AttemptRecord, TimerMode } from "../types/timer";
import { createLogger } from "../utils/logger";
import { clearQuestionRecords, loadTimerData, saveAttempt } from "../utils/timerStorage";

const logger = createLogger("[useQuestionTimeRecord]");

interface UseQuestionTimeRecordReturn {
	attempts: AttemptRecord[];
	addAttempt: (duration: number, mode: TimerMode, completed: boolean, targetTime?: number) => void;
	clearRecords: () => void;
	lastAttemptDuration: number | null;
	averageDuration: number | null;
	totalAttempts: number;
}

export function useQuestionTimeRecord(questionId: string): UseQuestionTimeRecordReturn {
	const [attempts, setAttempts] = useState<AttemptRecord[]>([]);

	// マウント時にlocalStorageから読込
	useEffect(() => {
		logger.info("Hook mounted, loading timer data");

		const loadResult = loadTimerData();

		if (!loadResult.ok) {
			logger.warn(`Failed to load timer data: ${loadResult.error.type}`, {
				message: loadResult.error.message,
			});
			return;
		}

		const questionRecord = loadResult.value.records[questionId];
		if (questionRecord) {
			setAttempts(questionRecord.attempts);
			logger.info(`Loaded ${questionRecord.attempts.length} attempts for question`);
		} else {
			logger.info("No existing attempts found for question");
		}
	}, [questionId]);

	// 新しい試行を追加
	const addAttempt = useCallback(
		(duration: number, mode: TimerMode, completed: boolean, targetTime?: number) => {
			logger.info(
				`Adding new attempt (mode: ${mode}, completed: ${completed}, duration: ${duration}s)`,
			);

			const newAttempt: AttemptRecord = {
				timestamp: Date.now(),
				duration,
				mode,
				completed,
				targetTime,
			};

			const saveResult = saveAttempt(questionId, newAttempt);

			if (!saveResult.ok) {
				logger.warn(`Failed to save attempt: ${saveResult.error.type}`, {
					message: saveResult.error.message,
				});
				return;
			}

			setAttempts((prev) => {
				const updated = [...prev, newAttempt];
				logger.info(`Attempt added successfully (total: ${updated.length})`);
				return updated;
			});
		},
		[questionId],
	);

	// 記録をクリア
	const clearRecords = useCallback(() => {
		logger.info("Clearing all records for question");

		const clearResult = clearQuestionRecords(questionId);

		if (!clearResult.ok) {
			logger.warn(`Failed to clear records: ${clearResult.error.type}`, {
				message: clearResult.error.message,
			});
			return;
		}

		setAttempts([]);
		logger.info("Records cleared successfully");
	}, [questionId]);

	// 最新の記録（メモ化）
	const lastAttemptDuration = useMemo<number | null>(() => {
		if (attempts.length === 0) return null;
		return attempts[attempts.length - 1].duration;
	}, [attempts]);

	// 平均時間（メモ化）
	const averageDuration = useMemo<number | null>(() => {
		if (attempts.length === 0) return null;

		const total = attempts.reduce((sum, attempt) => sum + attempt.duration, 0);
		return total / attempts.length;
	}, [attempts]);

	return {
		attempts,
		addAttempt,
		clearRecords,
		lastAttemptDuration,
		averageDuration,
		totalAttempts: attempts.length, // O(1)なのでuseMemo不要
	};
}
