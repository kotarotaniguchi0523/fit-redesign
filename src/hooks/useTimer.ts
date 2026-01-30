import { useCallback, useEffect, useRef, useState } from "react";
import type { TimerMode } from "../types/timer";

const TIMER_INTERVAL_MS = 1000;
const ALERT_SOUND = {
	FIRST_FREQUENCY: 800,
	SECOND_FREQUENCY: 1000,
	GAIN: 0.3,
	DURATION: 0.3,
	SECOND_DELAY: 350,
} as const;

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
	const audioContextRef = useRef<AudioContext | null>(null);

	const start = () => {
		setIsRunning(true);
		setIsCompleted(false);
	};

	const stop = () => {
		setIsRunning(false);
	};

	const reset = (nextMode?: TimerMode) => {
		const effectiveMode = nextMode ?? mode;
		setIsRunning(false);
		setIsCompleted(false);
		setElapsedSeconds(effectiveMode === "countdown" ? targetTime : 0);
	};

	const setTargetTime = (seconds: number) => {
		setTargetTimeState(seconds);
		if (mode === "countdown" && !isRunning) {
			setElapsedSeconds(seconds);
		}
	};

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
			if (!audioContextRef.current) {
				audioContextRef.current = new AudioContext();
			}
			const audioContext = audioContextRef.current;

			if (audioContext.state === "suspended") {
				audioContext.resume().catch(() => {});
			}

			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);

			oscillator.frequency.value = ALERT_SOUND.FIRST_FREQUENCY;
			oscillator.type = "sine";
			gainNode.gain.value = ALERT_SOUND.GAIN;

			oscillator.start();
			oscillator.stop(audioContext.currentTime + ALERT_SOUND.DURATION);

			// 2回目のビープ
			setTimeout(() => {
				const osc2 = audioContext.createOscillator();
				const gain2 = audioContext.createGain();
				osc2.connect(gain2);
				gain2.connect(audioContext.destination);
				osc2.frequency.value = ALERT_SOUND.SECOND_FREQUENCY;
				osc2.type = "sine";
				gain2.gain.value = ALERT_SOUND.GAIN;
				osc2.start();
				osc2.stop(audioContext.currentTime + ALERT_SOUND.DURATION);
			}, ALERT_SOUND.SECOND_DELAY);
		} catch (e) {
			console.log("AudioContext error", e);
			// Audio API not supported
		}
	}, []);

	// Cleanup AudioContext
	useEffect(() => {
		return () => {
			if (audioContextRef.current) {
                audioContextRef.current.close().catch((e) => console.log("AudioContext close error", e));
				audioContextRef.current = null;
			}
		};
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
		}, TIMER_INTERVAL_MS);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [isRunning, mode]);

	// Countdown 完了検知
	useEffect(() => {
		if (mode === "countdown" && isRunning && elapsedSeconds === 0) {
			setIsRunning(false);
			setIsCompleted(true);
			playAlertSound();
		}
	}, [mode, isRunning, elapsedSeconds, playAlertSound]);

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
