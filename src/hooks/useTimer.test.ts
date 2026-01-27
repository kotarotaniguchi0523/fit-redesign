import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimerMode } from "../types/timer";

let useTimer: typeof import("./useTimer").useTimer;

const mockOscillator = {
	connect: vi.fn(function connect() {}),
	start: vi.fn(function start() {}),
	stop: vi.fn(function stop() {}),
	frequency: { value: 0 },
	type: "sine" as OscillatorType,
};

const mockGainNode = {
	connect: vi.fn(function connect() {}),
	gain: { value: 0 },
};

const mockAudioContext = {
	state: "running" as AudioContextState,
	currentTime: 0,
	destination: {},
	createOscillator: vi.fn(function createOscillator() {
		return mockOscillator;
	}),
	createGain: vi.fn(function createGain() {
		return mockGainNode;
	}),
	resume: vi.fn(function resume() {}),
};

describe("useTimer", () => {
	beforeAll(async () => {
		vi.stubGlobal(
			"AudioContext",
			vi.fn(function AudioContextMock() {
				return mockAudioContext;
			}),
		);

		const module = await import("./useTimer");
		useTimer = module.useTimer;
	});

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("初期状態", () => {
		it("stopwatch モードだと elapsedSeconds が 0", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			expect(result.current.elapsedSeconds).toBe(0);
		});

		it("stopwatch モードだと isRunning が false", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			expect(result.current.isRunning).toBe(false);
		});

		it("stopwatch モードだと isCompleted が false", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			expect(result.current.isCompleted).toBe(false);
		});

		it("stopwatch モードだと targetTime が 0", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			expect(result.current.targetTime).toBe(0);
		});

		it("countdown モードだと elapsedSeconds が targetTime", () => {
			const { result } = renderHook(() => useTimer("countdown", 60));
			expect(result.current.elapsedSeconds).toBe(60);
		});

		it("countdown モードだと targetTime が 60", () => {
			const { result } = renderHook(() => useTimer("countdown", 60));
			expect(result.current.targetTime).toBe(60);
		});

		it("countdown モードだと isRunning が false", () => {
			const { result } = renderHook(() => useTimer("countdown", 60));
			expect(result.current.isRunning).toBe(false);
		});

		it("countdown モードだと isCompleted が false", () => {
			const { result } = renderHook(() => useTimer("countdown", 60));
			expect(result.current.isCompleted).toBe(false);
		});
	});

	describe("start / stop", () => {
		it("start で isRunning が true", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			act(() => {
				result.current.start();
			});
			expect(result.current.isRunning).toBe(true);
		});

		it("stop で isRunning が false", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			act(() => {
				result.current.start();
			});
			act(() => {
				result.current.stop();
			});
			expect(result.current.isRunning).toBe(false);
		});

		it("stop 後に elapsedSeconds が 0", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(5000);
			});
			act(() => {
				result.current.stop();
			});
			expect(result.current.elapsedSeconds).toBe(0);
		});
	});

	describe("reset", () => {
		it("stopwatch モードで elapsedSeconds が 0 に戻る", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(3000);
			});
			act(() => {
				result.current.reset();
			});
			expect(result.current.elapsedSeconds).toBe(0);
		});

		it("countdown モードで elapsedSeconds が targetTime に戻る", () => {
			const { result } = renderHook(() => useTimer("countdown", 60));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(10000);
			});
			act(() => {
				result.current.reset();
			});
			expect(result.current.elapsedSeconds).toBe(60);
		});
	});

	describe("setTargetTime", () => {
		it("targetTime を変更できる", () => {
			const { result } = renderHook(() => useTimer("countdown", 60));
			act(() => {
				result.current.setTargetTime(120);
			});
			expect(result.current.targetTime).toBe(120);
		});

		it("countdown モードで停止中は elapsedSeconds に反映", () => {
			const { result } = renderHook(() => useTimer("countdown", 60));
			act(() => {
				result.current.setTargetTime(120);
			});
			expect(result.current.elapsedSeconds).toBe(120);
		});

		it("countdown モードで実行中は elapsedSeconds が変わらない", () => {
			const { result } = renderHook(() => useTimer("countdown", 60));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(5000);
			});
			const currentElapsed = result.current.elapsedSeconds;
			act(() => {
				result.current.setTargetTime(120);
			});
			expect(result.current.elapsedSeconds).toBe(currentElapsed);
		});

		it("stopwatch モードで elapsedSeconds は変わらない", () => {
			const { result } = renderHook(() => useTimer("stopwatch", 60));
			act(() => {
				result.current.setTargetTime(120);
			});
			expect(result.current.elapsedSeconds).toBe(0);
		});
	});

	describe("stopwatch モード - 時間経過", () => {
		it("1 秒経過で 1 秒になる", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(1000);
			});
			expect(result.current.elapsedSeconds).toBe(1);
		});

		it("5 秒経過で 5 秒になる", () => {
			const { result } = renderHook(() => useTimer("stopwatch"));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(5000);
			});
			expect(result.current.elapsedSeconds).toBe(5);
		});
	});

	describe("countdown モード - 時間経過", () => {
		it("1 秒経過で 9 秒になる", () => {
			const { result } = renderHook(() => useTimer("countdown", 10));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(1000);
			});
			expect(result.current.elapsedSeconds).toBe(9);
		});

		it("5 秒経過で 5 秒になる", () => {
			const { result } = renderHook(() => useTimer("countdown", 10));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(5000);
			});
			expect(result.current.elapsedSeconds).toBe(5);
		});

		it("0 になると isCompleted が true", () => {
			const { result } = renderHook(() => useTimer("countdown", 5));
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(5000);
			});
			expect(result.current.isCompleted).toBe(true);
		});
	});

	describe("mode 変更時の挙動", () => {
		it("非実行時に countdown に切り替えると elapsedSeconds が targetTime", () => {
			const { result, rerender } = renderHook(
				({ mode, target }: { mode: TimerMode; target: number }) => useTimer(mode, target),
				{ initialProps: { mode: "stopwatch" as TimerMode, target: 60 } },
			);
			rerender({ mode: "countdown" as TimerMode, target: 60 });
			expect(result.current.elapsedSeconds).toBe(60);
		});

		it("実行中にモードを切り替えても elapsedSeconds が変わらない", () => {
			const { result, rerender } = renderHook(
				({ mode, target }: { mode: TimerMode; target: number }) => useTimer(mode, target),
				{ initialProps: { mode: "stopwatch" as TimerMode, target: 60 } },
			);
			act(() => {
				result.current.start();
			});
			act(() => {
				vi.advanceTimersByTime(5000);
			});
			const currentElapsed = result.current.elapsedSeconds;
			rerender({ mode: "countdown" as TimerMode, target: 60 });
			expect(result.current.elapsedSeconds).toBe(currentElapsed);
		});
	});

	describe("クリーンアップ", () => {
		it("アンマウント後にタイマーが動作し続けない", () => {
			const { result, unmount } = renderHook(() => useTimer("stopwatch"));
			act(() => {
				result.current.start();
			});
			unmount();
			expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
		});
	});
});
