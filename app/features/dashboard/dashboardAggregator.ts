import { unitBasedTabs } from "../../data/units";
import type { AnswerRecord } from "../../types/answer";

// questionId → unitId マッピングを構築
const questionToUnitMap: Map<string, string> = new Map(
	unitBasedTabs.flatMap((tab) =>
		tab.examMapping.flatMap((mapping) =>
			mapping.examNumbers.map((examNum) => [`exam${examNum}-${mapping.year}`, tab.id] as const),
		),
	),
);

export function mapQuestionToUnit(questionId: string): string | null {
	// exam1-2013-q1 → exam1-2013
	const match = questionId.match(/^(exam\d+-\d{4})-q\d+$/);
	if (!match) return null;
	return questionToUnitMap.get(match[1]) ?? null;
}

export interface MonthlyStats {
	month: string; // "YYYY-MM"
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number; // 0-100
	avgDuration: number | null; // seconds
}

export interface UnitStats {
	unitId: string;
	unitName: string;
	unitIcon: string;
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number;
	trend: "improving" | "stable" | "declining";
	questionDetails: {
		questionId: string;
		answers: { selectedLabel: string; isCorrect: boolean; timestamp: number }[];
	}[];
}

export interface DashboardData {
	totalQuestions: number; // 全問題数（ユニークな questionId）
	totalAnswered: number; // 回答済み問題数（ユニークな questionId）
	totalAttempts: number; // 総回答回数
	overallAccuracy: number; // 全体正答率（最新回答ベース）
	avgDuration: number | null;
	monthlyStats: MonthlyStats[];
	unitStats: UnitStats[];
	trend: "improving" | "stable" | "declining";
}

// 月バケットの集計アキュムレータ（aggregateStats の 1 パスで蓄積する）。
interface MonthAccumulator {
	total: number;
	correct: number;
	durationSum: number;
	durationCount: number;
}

interface DashboardAccumulator {
	latestByQuestion: Map<string, AnswerRecord>;
	monthAccumulators: Map<string, MonthAccumulator>;
	totalAttempts: number;
	durationSum: number;
	durationCount: number;
}

const EMPTY_MONTH_ACCUMULATOR: MonthAccumulator = {
	total: 0,
	correct: 0,
	durationSum: 0,
	durationCount: 0,
};

function createDashboardAccumulator(): DashboardAccumulator {
	return {
		latestByQuestion: new Map(),
		monthAccumulators: new Map(),
		totalAttempts: 0,
		durationSum: 0,
		durationCount: 0,
	};
}

function answerMonth(answer: AnswerRecord): string {
	const date = new Date(answer.timestamp);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addAnswerToMonth(
	bucket: MonthAccumulator | undefined,
	answer: AnswerRecord,
): MonthAccumulator {
	const current = bucket ?? EMPTY_MONTH_ACCUMULATOR;
	return {
		total: current.total + 1,
		correct: current.correct + (answer.isCorrect ? 1 : 0),
		durationSum: current.durationSum + (answer.duration ?? 0),
		durationCount: current.durationCount + (answer.duration != null ? 1 : 0),
	};
}

function addAnswerToDashboardAccumulator(
	accumulator: DashboardAccumulator,
	answer: AnswerRecord,
): DashboardAccumulator {
	const month = answerMonth(answer);
	const nextBucket = addAnswerToMonth(accumulator.monthAccumulators.get(month), answer);
	// private accumulator を in-place で更新（Map は既に in-place のため spread を揃える）。
	accumulator.monthAccumulators.set(month, nextBucket);
	accumulator.totalAttempts += 1;
	accumulator.durationSum += answer.duration ?? 0;
	accumulator.durationCount += answer.duration != null ? 1 : 0;
	return accumulator;
}

function addQuestionRecordsToDashboardAccumulator(
	accumulator: DashboardAccumulator,
	records: AnswerRecord[],
): DashboardAccumulator {
	const latest = records.at(-1);
	const answerAccumulator = records.reduce(addAnswerToDashboardAccumulator, accumulator);
	if (!latest) return answerAccumulator;

	answerAccumulator.latestByQuestion.set(latest.questionId, latest);
	return answerAccumulator;
}

function collectDashboardAccumulator(
	answerHistory: Record<string, AnswerRecord[]>,
): DashboardAccumulator {
	return Object.values(answerHistory).reduce(
		addQuestionRecordsToDashboardAccumulator,
		createDashboardAccumulator(),
	);
}

/**
 * ダッシュボードの主要集計。
 *
 * 旧実装は allAnswers を ~4 回走査していた（Object.values().flat() でフルコピー →
 * latest map / durations / 月次 / 単元 を各々再走査）。本実装は grouped な answerHistory を
 * 1 パスで走査し、correctCount・duration 合計/件数・月バケットを同時に蓄積する
 * （allAnswers の materialize を排除）。単元集計は grouped をそのまま aggregateByUnit に渡す。
 *
 * 出力は旧実装と完全同値（avgDuration の 0→null truthiness 分岐も含めて保存）。
 */
export function aggregateStats(answerHistory: Record<string, AnswerRecord[]>): DashboardData {
	const accumulator = collectDashboardAccumulator(answerHistory);
	const { latestByQuestion, monthAccumulators, totalAttempts, durationSum, durationCount } =
		accumulator;

	if (totalAttempts === 0) {
		return {
			totalQuestions: getTotalQuestionCount(),
			totalAnswered: 0,
			totalAttempts: 0,
			overallAccuracy: 0,
			avgDuration: null,
			monthlyStats: [],
			unitStats: [],
			trend: "stable",
		};
	}

	const monthlyStats = monthAccumulatorsToStats(monthAccumulators);

	// 単元別集計（grouped な answerHistory をそのまま渡し、再 group しない）
	const unitStats = aggregateByUnit(answerHistory);

	// 全体トレンド
	const trend = calculateTrend(monthlyStats.map((m) => m.accuracy));

	// 旧実装の truthiness 分岐を保存: 平均が 0（falsy）なら null を返す。
	const avgDuration = durationCount > 0 ? durationSum / durationCount : null;
	const latestCorrectCount = Array.from(latestByQuestion.values()).filter(
		(answer) => answer.isCorrect,
	).length;

	return {
		totalQuestions: getTotalQuestionCount(),
		totalAnswered: latestByQuestion.size,
		totalAttempts,
		overallAccuracy:
			latestByQuestion.size > 0
				? Math.round((latestCorrectCount / latestByQuestion.size) * 100)
				: 0,
		avgDuration: avgDuration ? Math.round(avgDuration * 10) / 10 : null,
		monthlyStats,
		unitStats,
		trend,
	};
}

// 月バケットを月昇順の MonthlyStats[] に変換する。
function monthAccumulatorsToStats(accumulators: Map<string, MonthAccumulator>): MonthlyStats[] {
	return Array.from(accumulators.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, bucket]) => ({
			month,
			totalAnswers: bucket.total,
			correctAnswers: bucket.correct,
			accuracy: Math.round((bucket.correct / bucket.total) * 100),
			avgDuration:
				bucket.durationCount > 0
					? Math.round((bucket.durationSum / bucket.durationCount) * 10) / 10
					: null,
		}));
}

export function aggregateByMonth(answers: AnswerRecord[]): MonthlyStats[] {
	const byMonth = new Map<string, MonthAccumulator>();

	// 1 パスで月バケットの集計値を直接蓄積する（旧実装は Map<string, AnswerRecord[]> を作り直して再走査）。
	const monthAccumulators = answers.reduce((accumulators, answer) => {
		const month = answerMonth(answer);
		accumulators.set(month, addAnswerToMonth(accumulators.get(month), answer));
		return accumulators;
	}, byMonth);

	return monthAccumulatorsToStats(monthAccumulators);
}

function aggregateByUnit(answerHistory: Record<string, AnswerRecord[]>): UnitStats[] {
	const unitMap = Object.entries(answerHistory).reduce((accumulator, [questionId, records]) => {
		const unitId = mapQuestionToUnit(questionId);
		if (!unitId) return accumulator;

		// accumulator(private)の inner Map を in-place で set（new Map(current) で作り直すと単元
		// あたり O(q²) になるため避ける）。
		const unitEntry = accumulator.get(unitId);
		if (unitEntry) {
			unitEntry.answers.set(questionId, records);
		} else {
			accumulator.set(unitId, { answers: new Map([[questionId, records]]) });
		}
		return accumulator;
	}, new Map<string, { answers: Map<string, AnswerRecord[]> }>());

	return unitBasedTabs.flatMap((tab) => {
		const unitData = unitMap.get(tab.id);
		if (!unitData) return [];

		const allAnswers = Array.from(unitData.answers.values()).flat();
		const correct = allAnswers.filter((a) => a.isCorrect).length;

		// 最近5回の正答率でトレンド計算
		const recentAccuracies = getRecentAccuracies(allAnswers, 5);
		const trend = calculateTrend(recentAccuracies);

		const questionDetails = Array.from(unitData.answers.entries()).map(([qid, records]) => ({
			questionId: qid,
			answers: records.map((r) => ({
				selectedLabel: r.selectedLabel,
				isCorrect: r.isCorrect,
				timestamp: r.timestamp,
			})),
		}));

		return [
			{
				unitId: tab.id,
				unitName: tab.name,
				unitIcon: tab.icon,
				totalAnswers: allAnswers.length,
				correctAnswers: correct,
				accuracy: allAnswers.length > 0 ? Math.round((correct / allAnswers.length) * 100) : 0,
				trend,
				questionDetails,
			},
		];
	});
}

function getRecentAccuracies(answers: AnswerRecord[], windowSize: number): number[] {
	if (answers.length < 2) return [];

	const sorted = [...answers].sort((a, b) => a.timestamp - b.timestamp);
	const windowCount = Math.max(0, Math.floor((sorted.length - windowSize) / windowSize) + 1);
	return Array.from({ length: windowCount }, (_, index) => {
		const end = index * windowSize + windowSize - 1;
		const window = sorted.slice(Math.max(0, end - windowSize + 1), end + 1);
		const correct = window.filter((a) => a.isCorrect).length;
		return (correct / window.length) * 100;
	});
}

export function calculateTrend(values: number[]): "improving" | "stable" | "declining" {
	if (values.length < 2) return "stable";

	// 線形回帰の傾き
	const n = values.length;
	const sums = values.reduce(
		(acc, value, index) => ({
			sumX: acc.sumX + index,
			sumY: acc.sumY + value,
			sumXY: acc.sumXY + index * value,
			sumX2: acc.sumX2 + index * index,
		}),
		{ sumX: 0, sumY: 0, sumXY: 0, sumX2: 0 },
	);

	const slope = (n * sums.sumXY - sums.sumX * sums.sumY) / (n * sums.sumX2 - sums.sumX * sums.sumX);

	if (slope > 3) return "improving";
	if (slope < -3) return "declining";
	return "stable";
}

function getTotalQuestionCount(): number {
	return new Set(
		unitBasedTabs.flatMap((tab) =>
			tab.examMapping.flatMap((mapping) =>
				mapping.examNumbers.map((examNum) => `exam${examNum}-${mapping.year}`),
			),
		),
	).size;
}
