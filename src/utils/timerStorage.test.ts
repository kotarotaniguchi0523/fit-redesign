import { beforeEach, describe, expect, it } from "vitest";
import { clearQuestionRecords, loadTimerData, saveAttempt, saveTimerData } from "./timerStorage";

describe("timerStorage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe("loadTimerData", () => {
		it("初回ロード時は空のデータを返す", () => {
			const result = loadTimerData();

			expect(result).toMatchObject({
				ok: true,
				value: {
					version: 1,
					records: {},
				},
			});
		});

		it("保存したデータをロードできる", () => {
			const testData = {
				version: 1 as const,
				records: {
					q1: {
						questionId: "q1",
						attempts: [
							{
								duration: 120,
								mode: "stopwatch" as const,
								completed: false,
								timestamp: Date.now(),
							},
						],
					},
				},
			};

			saveTimerData(testData);
			const result = loadTimerData();

			expect(result).toMatchObject({
				ok: true,
				value: {
					records: {
						q1: {
							questionId: "q1",
							attempts: [
								expect.objectContaining({
									duration: 120,
									mode: "stopwatch",
									completed: false,
								}),
							],
						},
					},
				},
			});
		});
	});

	describe("saveTimerData", () => {
		it("データを保存できる", () => {
			const testData = {
				version: 1 as const,
				records: {},
			};

			const result = saveTimerData(testData);

			expect(result.ok).toBe(true);
		});
	});

	describe("saveAttempt", () => {
		it("問題に試行を追加できる", () => {
			const attempt = {
				duration: 60,
				mode: "stopwatch" as const,
				completed: false,
				timestamp: Date.now(),
			};

			const saveResult = saveAttempt("q1", attempt);
			if (!saveResult.ok) {
				throw new Error("saveAttempt failed");
			}

			const loadResult = loadTimerData();
			if (!loadResult.ok) {
				throw new Error("loadTimerData failed");
			}

			expect(loadResult.value.records["q1"].attempts).toEqual([
				expect.objectContaining({
					duration: 60,
					mode: "stopwatch",
					completed: false,
				}),
			]);
		});

		it("複数の試行を蓄積できる", () => {
			const attempt1 = {
				duration: 60,
				mode: "stopwatch" as const,
				completed: false,
				timestamp: Date.now(),
			};
			const attempt2 = {
				duration: 90,
				mode: "countdown" as const,
				completed: true,
				timestamp: Date.now(),
				targetTime: 120,
			};

			saveAttempt("q2", attempt1);
			saveAttempt("q2", attempt2);

			const result = loadTimerData();
			if (!result.ok) {
				throw new Error("loadTimerData failed");
			}

			expect(result.value.records["q2"].attempts).toEqual([
				expect.objectContaining({
					duration: 60,
					mode: "stopwatch",
					completed: false,
				}),
				expect.objectContaining({
					duration: 90,
					mode: "countdown",
					completed: true,
					targetTime: 120,
				}),
			]);
		});
	});

	describe("clearQuestionRecords", () => {
		it("問題の記録をクリアできる", () => {
			const attempt = {
				duration: 120,
				mode: "stopwatch" as const,
				completed: false,
				timestamp: Date.now(),
			};
			const attemptResult = saveAttempt("q3", attempt);
			if (!attemptResult.ok) {
				throw new Error("saveAttempt failed");
			}

			const clearResult = clearQuestionRecords("q3");
			if (!clearResult.ok) {
				throw new Error("clearQuestionRecords failed");
			}

			const loadResult = loadTimerData();
			if (!loadResult.ok) {
				throw new Error("loadTimerData failed");
			}

			expect(loadResult.value.records["q3"]).toBeUndefined();
		});

		it("存在しない問題をクリアしてもエラーにならない", () => {
			const result = clearQuestionRecords("nonexistent");
			expect(result.ok).toBe(true);
		});
	});
});
