import { unitBasedTabs } from "../data/units";
import type { AnswerRecord } from "../types/answer";

// questionId → unitId マッピングを構築
const questionToUnitMap = new Map<string, string>();

for (const tab of unitBasedTabs) {
	for (const mapping of tab.examMapping) {
		for (const examNum of mapping.examNumbers) {
			// exam{n}-{year}-q{m} パターンにマッチするキーを生成
			// 実際のquestionIdは動的なので、examId部分でマッチさせる
			const examPrefix = `exam${examNum}-${mapping.year}`;
			questionToUnitMap.set(examPrefix, tab.id);
		}
	}
}

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

export function aggregateStats(
	answerHistory: Record<string, AnswerRecord[]>,
): DashboardData {
	const allAnswers = Object.values(answerHistory).flat();

	if (allAnswers.length === 0) {
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

	// 最新回答ベースの正答率
	const latestByQuestion = new Map<string, AnswerRecord>();
	for (const [qid, records] of Object.entries(answerHistory)) {
		if (records.length > 0) {
			latestByQuestion.set(qid, records[records.length - 1]);
		}
	}

	const latestAnswers = Array.from(latestByQuestion.values());
	const correctCount = latestAnswers.filter((a) => a.isCorrect).length;

	// 平均時間
	const durationsWithValue = allAnswers.filter((a) => a.duration != null);
	const avgDuration =
		durationsWithValue.length > 0
			? durationsWithValue.reduce((sum, a) => sum + (a.duration ?? 0), 0) / durationsWithValue.length
			: null;

	// 月ごと集計
	const monthlyStats = aggregateByMonth(allAnswers);

	// 単元別集計
	const unitStats = aggregateByUnit(answerHistory);

	// 全体トレンド
	const trend = calculateTrend(
		monthlyStats.map((m) => m.accuracy),
	);

	return {
		totalQuestions: getTotalQuestionCount(),
		totalAnswered: latestByQuestion.size,
		totalAttempts: allAnswers.length,
		overallAccuracy: latestAnswers.length > 0 ? Math.round((correctCount / latestAnswers.length) * 100) : 0,
		avgDuration: avgDuration ? Math.round(avgDuration * 10) / 10 : null,
		monthlyStats,
		unitStats,
		trend,
	};
}

export function aggregateByMonth(answers: AnswerRecord[]): MonthlyStats[] {
	const byMonth = new Map<string, AnswerRecord[]>();

	for (const answer of answers) {
		const date = new Date(answer.timestamp);
		const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
		const arr = byMonth.get(month) ?? [];
		arr.push(answer);
		byMonth.set(month, arr);
	}

	const stats: MonthlyStats[] = [];
	const sortedMonths = Array.from(byMonth.keys()).sort();

	for (const month of sortedMonths) {
		const monthAnswers = byMonth.get(month)!;
		const correct = monthAnswers.filter((a) => a.isCorrect).length;
		const withDuration = monthAnswers.filter((a) => a.duration != null);

		stats.push({
			month,
			totalAnswers: monthAnswers.length,
			correctAnswers: correct,
			accuracy: Math.round((correct / monthAnswers.length) * 100),
			avgDuration:
				withDuration.length > 0
					? Math.round(
							(withDuration.reduce((s, a) => s + (a.duration ?? 0), 0) / withDuration.length) * 10,
						) / 10
					: null,
		});
	}

	return stats;
}

function aggregateByUnit(
	answerHistory: Record<string, AnswerRecord[]>,
): UnitStats[] {
	const unitMap = new Map<string, { answers: Map<string, AnswerRecord[]> }>();

	for (const [questionId, records] of Object.entries(answerHistory)) {
		const unitId = mapQuestionToUnit(questionId);
		if (!unitId) continue;

		if (!unitMap.has(unitId)) {
			unitMap.set(unitId, { answers: new Map() });
		}
		unitMap.get(unitId)!.answers.set(questionId, records);
	}

	const stats: UnitStats[] = [];

	for (const tab of unitBasedTabs) {
		const unitData = unitMap.get(tab.id);
		if (!unitData) continue;

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

		stats.push({
			unitId: tab.id,
			unitName: tab.name,
			unitIcon: tab.icon,
			totalAnswers: allAnswers.length,
			correctAnswers: correct,
			accuracy: allAnswers.length > 0 ? Math.round((correct / allAnswers.length) * 100) : 0,
			trend,
			questionDetails,
		});
	}

	return stats;
}

function getRecentAccuracies(answers: AnswerRecord[], windowSize: number): number[] {
	if (answers.length < 2) return [];

	const sorted = [...answers].sort((a, b) => a.timestamp - b.timestamp);
	const accuracies: number[] = [];

	for (let i = windowSize - 1; i < sorted.length; i += windowSize) {
		const window = sorted.slice(Math.max(0, i - windowSize + 1), i + 1);
		const correct = window.filter((a) => a.isCorrect).length;
		accuracies.push((correct / window.length) * 100);
	}

	return accuracies;
}

export function calculateTrend(
	values: number[],
): "improving" | "stable" | "declining" {
	if (values.length < 2) return "stable";

	// 線形回帰の傾き
	const n = values.length;
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumX2 = 0;

	for (let i = 0; i < n; i++) {
		sumX += i;
		sumY += values[i];
		sumXY += i * values[i];
		sumX2 += i * i;
	}

	const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

	if (slope > 3) return "improving";
	if (slope < -3) return "declining";
	return "stable";
}

function getTotalQuestionCount(): number {
	let count = 0;
	const seen = new Set<string>();

	for (const tab of unitBasedTabs) {
		for (const mapping of tab.examMapping) {
			for (const examNum of mapping.examNumbers) {
				const key = `exam${examNum}-${mapping.year}`;
				if (!seen.has(key)) {
					seen.add(key);
					// 各試験は複数問題を含む可能性があるが、正確な数はデータ読み込みが必要
					// ここでは examMapping のエントリ数を近似値として使用
					count++;
				}
			}
		}
	}

	return count;
}
