import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { TimerMode } from "../types/timer";

interface UseTimerReturn {
	elapsedSeconds: number;
	isRunning: boolean;
	isCompleted: boolean;
	targetTime: number;
	start: () => void;
	stop: () => void;
	reset: () => void;
	setTargetTime: (seconds: number) => void;
}

export function useTimer(mode: TimerMode, targetTimeSeconds?: number): UseTimerReturn {
	const [elapsedSeconds, setElapsedSeconds] = useState(
		mode === "countdown" ? (targetTimeSeconds ?? 0) : 0,
	);
	const [isRunning, setIsRunning] = useState(false);
	const [isCompleted, setIsCompleted] = useState(false);
	const [targetTime, setTargetTimeState] = useState(targetTimeSeconds ?? 0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const start = useCallback(() => {
		setIsRunning(true);
		setIsCompleted(false);
	}, []);

	const stop = useCallback(() => {
		setIsRunning(false);
	}, []);

	const reset = useCallback(() => {
		setIsRunning(false);
		setIsCompleted(false);
		if (mode === "countdown") {
			setElapsedSeconds(targetTime);
		} else {
			setElapsedSeconds(0);
		}
	}, [mode, targetTime]);

	const setTargetTime = useCallback(
		(seconds: number) => {
			setTargetTimeState(seconds);
			if (mode === "countdown" && !isRunning) {
				setElapsedSeconds(seconds);
			}
		},
		[mode, isRunning],
	);

	// useEffectEvent: カウントダウン完了時の処理
	// - Effect内から呼び出せるが、依存配列には入れない
	// - 常に最新の値を読める
	const handleCountdownComplete = useEffectEvent(() => {
		setIsCompleted(true);
		setIsRunning(false);
	});

	// Timer interval effect
	// 外部システム（setInterval）との同期なのでuseEffectが必要
	useEffect(() => {
		if (!isRunning) {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			return;
		}

		intervalRef.current = setInterval(() => {
			setElapsedSeconds((prev) => {
				if (mode === "stopwatch") {
					return prev + 1;
				}

				// Countdown
				const next = prev - 1;
				if (next <= 0) {
					// useEffectEventで完了処理（refを介さずに直接呼び出し）
					handleCountdownComplete();
					return 0;
				}
				return next;
			});
		}, 1000);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [isRunning, mode]);

	return {
		elapsedSeconds,
		isRunning,
		isCompleted,
		targetTime,
		start,
		stop,
		reset,
		setTargetTime,
	};
}
