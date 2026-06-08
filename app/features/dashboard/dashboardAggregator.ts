import { unitBasedTabs } from "../../data/units";
import type { AnswerRecord } from "../../types/answer";

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

// 月バケットの集計アキュムレータ（aggregateStats の 1 パスで蓄積する）。
interface MonthAccumulator {
	total: number;
	correct: number;
	durationSum: number;
	durationCount: number;
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
	const latestByQuestion = new Map<string, AnswerRecord>();
	const monthAccumulators = new Map<string, MonthAccumulator>();
	let totalAttempts = 0;
	let latestCorrectCount = 0;
	let durationSum = 0;
	let durationCount = 0;

	// 1 パスで複数構造（latest map・月バケット・duration 集計・件数）を同時構築するため for...of。
	// 旧実装の flat→filter→reduce→aggregateByMonth の 4 走査を 1 走査に統合する正当なケース。
	for (const records of Object.values(answerHistory)) {
		const length = records.length;
		if (length === 0) continue;

		// 最新回答（配列末尾）。旧 latestByQuestion.set(qid, records.at(-1)) と同値。
		const latest = records[length - 1];
		latestByQuestion.set(latest.questionId, latest);
		if (latest.isCorrect) latestCorrectCount++;

		for (let i = 0; i < length; i++) {
			const answer = records[i];
			totalAttempts++;

			if (answer.duration != null) {
				durationSum += answer.duration;
				durationCount++;
			}

			const date = new Date(answer.timestamp);
			const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
			const bucket = monthAccumulators.get(month);
			if (bucket) {
				bucket.total++;
				if (answer.isCorrect) bucket.correct++;
				if (answer.duration != null) {
					bucket.durationSum += answer.duration;
					bucket.durationCount++;
				}
			} else {
				monthAccumulators.set(month, {
					total: 1,
					correct: answer.isCorrect ? 1 : 0,
					durationSum: answer.duration != null ? answer.duration : 0,
					durationCount: answer.duration != null ? 1 : 0,
				});
			}
		}
	}

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
	for (const answer of answers) {
		const date = new Date(answer.timestamp);
		const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
		const bucket = byMonth.get(month);
		if (bucket) {
			bucket.total++;
			if (answer.isCorrect) bucket.correct++;
			if (answer.duration != null) {
				bucket.durationSum += answer.duration;
				bucket.durationCount++;
			}
		} else {
			byMonth.set(month, {
				total: 1,
				correct: answer.isCorrect ? 1 : 0,
				durationSum: answer.duration != null ? answer.duration : 0,
				durationCount: answer.duration != null ? 1 : 0,
			});
		}
	}

	return monthAccumulatorsToStats(byMonth);
}

function aggregateByUnit(answerHistory: Record<string, AnswerRecord[]>): UnitStats[] {
	const unitMap = new Map<string, { answers: Map<string, AnswerRecord[]> }>();

	for (const [questionId, records] of Object.entries(answerHistory)) {
		const unitId = mapQuestionToUnit(questionId);
		if (!unitId) continue;

		let unitEntry = unitMap.get(unitId);
		if (!unitEntry) {
			unitEntry = { answers: new Map() };
			unitMap.set(unitId, unitEntry);
		}
		unitEntry.answers.set(questionId, records);
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

export function calculateTrend(values: number[]): "improving" | "stable" | "declining" {
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
