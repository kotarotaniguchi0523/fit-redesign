import { bench, describe } from "vitest";
import { syncAttempts } from "./d1TimerRepository";

const MOCK_LATENCY = 50;

const createMockDb = () => {
	let _statementCount = 0;
	return {
		prepare: (_query: string) => {
			return {
				bind: (..._values: unknown[]) => {
					return {
						all: async () => ({ results: [], success: true }),
						run: async () => ({ results: [], success: true }),
					};
				},
			};
		},
		// biome-ignore lint/suspicious/noExplicitAny: mock type
		batch: async (statements: any[]) => {
			_statementCount += statements.length;
			await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY));
			return [];
		},
	};
};

const createMockClientRecords = (numQuestions: number, attemptsPerQuestion: number) => {
	// biome-ignore lint/suspicious/noExplicitAny: mock type
	const records: Record<string, any> = {};
	for (let i = 0; i < numQuestions; i++) {
		const qid = `exam1-2013-q${i}`;
		const attempts = [];
		for (let j = 0; j < attemptsPerQuestion; j++) {
			attempts.push({
				timestamp: Date.now() - j * 1000,
				duration: 100 + j,
				mode: "exam",
				completed: true,
			});
		}
		records[qid] = { questionId: qid, attempts };
	}
	return records;
};

// 10 questions with 50 attempts each = 500 statements total
const clientRecords = createMockClientRecords(10, 50);

describe("d1TimerRepository", () => {
	bench(
		"syncAttempts with 500 statements",
		async () => {
			const mockDb = createMockDb();
			// biome-ignore lint/suspicious/noExplicitAny: mock type
			await syncAttempts(mockDb as any, "test-user-123", clientRecords);
		},
		{ iterations: 5, warmupIterations: 1 },
	);
});
