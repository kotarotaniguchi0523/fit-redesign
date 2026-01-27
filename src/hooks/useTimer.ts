import { useCallback, useEffect, useRef, useState } from "react";
import type { TimerMode } from "../types/timer";

interface UseTimerReturn {
	elapsedSeconds: number;
	isRunning: boolean;
	isCompleted: boolean;
	targetTime: number;
	start: () => void;
	stop: () => void;
	reset: (nextMode?: TimerMode) => void;
	setTargetTime: (seconds: number) => void;
}

export function useTimer(mode: TimerMode, targetTimeSeconds?: number): UseTimerReturn {
	const initialTargetTime = targetTimeSeconds ?? 0;
	const [targetTime, setTargetTimeState] = useState(initialTargetTime);
	const [elapsedSeconds, setElapsedSeconds] = useState(
		mode === "countdown" ? initialTargetTime : 0,
	);
	const [isRunning, setIsRunning] = useState(false);
	const [isCompleted, setIsCompleted] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const start = useCallback(() => {
		setIsRunning(true);
		setIsCompleted(false);
	}, []);

	const stop = useCallback(() => {
		setIsRunning(false);
	}, []);

	const reset = useCallback(
		(nextMode?: TimerMode) => {
			const effectiveMode = nextMode ?? mode;
			setIsRunning(false);
			setIsCompleted(false);
			setElapsedSeconds(effectiveMode === "countdown" ? targetTime : 0);
		},
		[mode, targetTime],
	);

	const setTargetTime = useCallback(
		(seconds: number) => {
			setTargetTimeState(seconds);
			if (mode === "countdown" && !isRunning) {
				setElapsedSeconds(seconds);
			}
		},
		[mode, isRunning],
	);

	// mode変更時に elapsedSeconds を適切にリセット
	// QuestionTimerでsetMode後にtimer.reset()を呼んでも、modeの更新は非同期なので
	// reset関数内のmodeは古い値のまま。このuseEffectで新しいmodeに基づいてリセットする
	useEffect(() => {
		if (!isRunning && !isCompleted) {
			setElapsedSeconds(mode === "countdown" ? targetTime : 0);
		}
	}, [mode, targetTime, isRunning, isCompleted]);

	// アラート音を鳴らす関数
	const playAlertSound = useCallback(() => {
		try {
			const audioContext = new AudioContext();
			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);

			oscillator.frequency.value = 800;
			oscillator.type = "sine";
			gainNode.gain.value = 0.3;

			oscillator.start();
			oscillator.stop(audioContext.currentTime + 0.3);

			// 2回目のビープ
			setTimeout(() => {
				const osc2 = audioContext.createOscillator();
				const gain2 = audioContext.createGain();
				osc2.connect(gain2);
				gain2.connect(audioContext.destination);
				osc2.frequency.value = 1000;
				osc2.type = "sine";
				gain2.gain.value = 0.3;
				osc2.start();
				osc2.stop(audioContext.currentTime + 0.3);
			}, 350);
		} catch {
			// Audio API not supported
		}
	}, []);

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
				return next <= 0 ? 0 : next;
			});
		}, 1000);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [isRunning, mode]);

	// Countdown 完了検知
	// biome-ignore lint/correctness/useExhaustiveDependencies: playAlertSound は useCallback で安定しており、依存配列に含めると無駄な再生成が発生する
	useEffect(() => {
		if (mode === "countdown" && isRunning && elapsedSeconds === 0) {
			setIsRunning(false);
			setIsCompleted(true);
			playAlertSound();
		}
	}, [mode, isRunning, elapsedSeconds]);

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
