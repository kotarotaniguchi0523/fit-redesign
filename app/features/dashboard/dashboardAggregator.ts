import { unitBasedTabs } from "../../data/units";
import type { AnswerRecord } from "../../types/answer";
import {
	DAY_MS,
	dayKeyToLabel,
	jstDayKey,
	jstMidnightMs,
	jstWeekdayMondayBased,
	jstWeekStartKey,
} from "./dashboardJst";
import { mapQuestionToUnit } from "./dashboardQuestionId";
import { aggregateSetTimes } from "./dashboardSetTime";
import type {
	DashboardData,
	HeatmapCell,
	MonthlyStats,
	PeriodStats,
	UnitStats,
} from "./dashboardTypes";
import { aggregateWeakness, computeMastery } from "./dashboardWeakness";

export { mapQuestionToUnit, parseQuestionId } from "./dashboardQuestionId";
// 公開 API の再エクスポート（外部 import は dashboardAggregator 経由を維持しつつ、実装は分割モジュールへ）。
export type {
	Coverage,
	DashboardData,
	HeatmapCell,
	MonthlyStats,
	ParsedQuestionId,
	PeriodStats,
	SetTime,
	UnitMastery,
	UnitStats,
	WeakQuestion,
} from "./dashboardTypes";
export { TOTAL_QUESTIONS } from "./dashboardTypes";

const HEATMAP_WEEKS = 15; // ヒートマップは直近15週 × 7曜日
const HEATMAP_DAYS = HEATMAP_WEEKS * 7;
const DAILY_TREND_DAYS = 30; // 推移グラフ「日」= 直近30日
const WEEKLY_TREND_WEEKS = 12; // 推移グラフ「週」= 直近12週

// 月/日/週で共用するバケットの集計アキュムレータ（aggregateStats の 1 パスで蓄積する）。
interface BucketAccumulator {
	total: number;
	correct: number;
	durationSum: number;
	durationCount: number;
}

interface DashboardAccumulator {
	latestByQuestion: Map<string, AnswerRecord>;
	monthAccumulators: Map<string, BucketAccumulator>;
	dayAccumulators: Map<string, BucketAccumulator>; // JST 日次バケット
	weekAccumulators: Map<string, BucketAccumulator>; // JST 週次バケット（月曜起点）
	todayKey: string; // now の JST 日付キー
	todayQuestionIds: Set<string>; // 今日(JST)1回以上解いたユニーク問題
	totalAttempts: number;
	durationSum: number;
	durationCount: number;
}

const EMPTY_BUCKET: BucketAccumulator = {
	total: 0,
	correct: 0,
	durationSum: 0,
	durationCount: 0,
};

function createDashboardAccumulator(now: number): DashboardAccumulator {
	return {
		latestByQuestion: new Map(),
		monthAccumulators: new Map(),
		dayAccumulators: new Map(),
		weekAccumulators: new Map(),
		todayKey: jstDayKey(now),
		todayQuestionIds: new Set(),
		totalAttempts: 0,
		durationSum: 0,
		durationCount: 0,
	};
}

function answerMonth(answer: AnswerRecord): string {
	// 月次も JST 基準に統一（日次/週次/ヒートマップと同じ jstDayKey 由来）。"YYYY-MM"。
	return jstDayKey(answer.createdAt).slice(0, 7);
}

function addAnswerToBucket(
	bucket: BucketAccumulator | undefined,
	answer: AnswerRecord,
): BucketAccumulator {
	const current = bucket ?? EMPTY_BUCKET;
	return {
		total: current.total + 1,
		correct: current.correct + (answer.isCorrect ? 1 : 0),
		durationSum: current.durationSum + (answer.duration ?? 0),
		durationCount: current.durationCount + (answer.duration == null ? 0 : 1),
	};
}

function addAnswerToDashboardAccumulator(
	accumulator: DashboardAccumulator,
	answer: AnswerRecord,
): DashboardAccumulator {
	const month = answerMonth(answer);
	const dayKey = jstDayKey(answer.createdAt);
	const weekKey = jstWeekStartKey(answer.createdAt);
	// private accumulator を in-place で更新（Map は既に in-place のため spread を揃える）。
	// 月次に加え JST 日次・週次バケットにも同形状で蓄積する（ヒートマップ・推移グラフの粒度別データ源）。
	accumulator.monthAccumulators.set(
		month,
		addAnswerToBucket(accumulator.monthAccumulators.get(month), answer),
	);
	accumulator.dayAccumulators.set(
		dayKey,
		addAnswerToBucket(accumulator.dayAccumulators.get(dayKey), answer),
	);
	accumulator.weekAccumulators.set(
		weekKey,
		addAnswerToBucket(accumulator.weekAccumulators.get(weekKey), answer),
	);
	// 今日(JST)解いた問題をユニークに集める（目標リング分子）。日キーは上で算出済みを再利用し
	// 二度目の走査を避ける。Set なので再解答・複数問題でも自然に重複排除される。
	if (dayKey === accumulator.todayKey) {
		accumulator.todayQuestionIds.add(answer.questionId);
	}
	accumulator.totalAttempts += 1;
	accumulator.durationSum += answer.duration ?? 0;
	accumulator.durationCount += answer.duration == null ? 0 : 1;
	return accumulator;
}

function addQuestionRecordsToDashboardAccumulator(
	accumulator: DashboardAccumulator,
	records: AnswerRecord[],
): DashboardAccumulator {
	const latest = records.at(-1);
	const answerAccumulator = records.reduce(addAnswerToDashboardAccumulator, accumulator);
	if (!latest) {
		return answerAccumulator;
	}

	answerAccumulator.latestByQuestion.set(latest.questionId, latest);
	return answerAccumulator;
}

function collectDashboardAccumulator(
	answerHistory: Record<string, AnswerRecord[]>,
	now: number,
): DashboardAccumulator {
	return Object.values(answerHistory).reduce(
		addQuestionRecordsToDashboardAccumulator,
		createDashboardAccumulator(now),
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
export function aggregateStats(
	answerHistory: Record<string, AnswerRecord[]>,
	now: number,
): DashboardData {
	const accumulator = collectDashboardAccumulator(answerHistory, now);
	const {
		latestByQuestion,
		monthAccumulators,
		dayAccumulators,
		weekAccumulators,
		todayQuestionIds,
		totalAttempts,
		durationSum,
		durationCount,
	} = accumulator;

	// ヒートマップは now 基準で日付軸が決まるので、回答ゼロでも105日の0埋めセルを返す。
	const heatmap = buildHeatmap(now, dayAccumulators);
	// 弱点診断は空履歴でも全単元0・カバレッジ0/180 を返す（空状態画面で使わずとも型を満たす）。
	const weakness = aggregateWeakness(answerHistory);
	const setTimes = aggregateSetTimes(answerHistory);
	const mastery = computeMastery(weakness.unitMastery);

	if (totalAttempts === 0) {
		return {
			totalAnswered: 0,
			totalAttempts: 0,
			overallAccuracy: 0,
			avgDuration: null,
			monthlyStats: [],
			unitStats: [],
			trend: "stable",
			dailyStats: [],
			weeklyStats: [],
			heatmap,
			todayCount: 0,
			coverage: weakness.coverage,
			unitMastery: weakness.unitMastery,
			weakUnits: weakness.weakUnits,
			weakQuestions: weakness.weakQuestions,
			setTimes,
			overallMastery: mastery.rate,
			masteryAttempted: mastery.attempted,
		};
	}

	const monthlyStats = monthAccumulatorsToStats(monthAccumulators);
	const dailyStats = bucketsToPeriodStats(
		dayAccumulators,
		dayKeyToLabel,
		jstDayKey(now - (DAILY_TREND_DAYS - 1) * DAY_MS),
	);
	const weeklyStats = bucketsToPeriodStats(
		weekAccumulators,
		(key) => `${dayKeyToLabel(key)}〜`,
		jstWeekStartKey(now - (WEEKLY_TREND_WEEKS - 1) * 7 * DAY_MS),
	);

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
		dailyStats,
		weeklyStats,
		heatmap,
		todayCount: todayQuestionIds.size,
		coverage: weakness.coverage,
		unitMastery: weakness.unitMastery,
		weakUnits: weakness.weakUnits,
		weakQuestions: weakness.weakQuestions,
		setTimes,
		overallMastery: mastery.rate,
		masteryAttempted: mastery.attempted,
	};
}

// バケット（月/日/週で同形状）→ 正答率・平均時間の指標。丸め規則の単一の真実。
function accumulatorMetrics(bucket: BucketAccumulator): {
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number;
	avgDuration: number | null;
} {
	return {
		totalAnswers: bucket.total,
		correctAnswers: bucket.correct,
		accuracy: Math.round((bucket.correct / bucket.total) * 100),
		avgDuration:
			bucket.durationCount > 0
				? Math.round((bucket.durationSum / bucket.durationCount) * 10) / 10
				: null,
	};
}

// 日次/週次バケットを minKey 以降に絞り、昇順 PeriodStats[] に変換する。
function bucketsToPeriodStats(
	buckets: Map<string, BucketAccumulator>,
	labelFor: (key: string) => string,
	minKey: string,
): PeriodStats[] {
	return Array.from(buckets.entries())
		.filter(([key]) => key >= minKey)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, bucket]) => ({ key, label: labelFor(key), ...accumulatorMetrics(bucket) }));
}

// now を起点に直近 HEATMAP_DAYS 日を 0 埋めで列挙し、日次バケットの回答数を引く。
function buildHeatmap(now: number, dayBuckets: Map<string, BucketAccumulator>): HeatmapCell[] {
	const todayMidnight = jstMidnightMs(now);
	return Array.from({ length: HEATMAP_DAYS }, (_, index) => {
		const dayMs = todayMidnight - (HEATMAP_DAYS - 1 - index) * DAY_MS;
		const dateKey = jstDayKey(dayMs);
		return {
			dateKey,
			label: dayKeyToLabel(dateKey),
			count: dayBuckets.get(dateKey)?.total ?? 0,
			weekday: jstWeekdayMondayBased(dayMs),
		};
	});
}

// 月バケットを月昇順の MonthlyStats[] に変換する。
function monthAccumulatorsToStats(accumulators: Map<string, BucketAccumulator>): MonthlyStats[] {
	return Array.from(accumulators.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, bucket]) => ({ month, ...accumulatorMetrics(bucket) }));
}

export function aggregateByMonth(answers: AnswerRecord[]): MonthlyStats[] {
	const byMonth = new Map<string, BucketAccumulator>();

	// 1 パスで月バケットの集計値を直接蓄積する（旧実装は Map<string, AnswerRecord[]> を作り直して再走査）。
	const monthAccumulators = answers.reduce((accumulators, answer) => {
		const month = answerMonth(answer);
		accumulators.set(month, addAnswerToBucket(accumulators.get(month), answer));
		return accumulators;
	}, byMonth);

	return monthAccumulatorsToStats(monthAccumulators);
}

function aggregateByUnit(answerHistory: Record<string, AnswerRecord[]>): UnitStats[] {
	const unitMap = Object.entries(answerHistory).reduce((accumulator, [questionId, records]) => {
		const unitId = mapQuestionToUnit(questionId);
		if (!unitId) {
			return accumulator;
		}

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
		if (!unitData) {
			return [];
		}

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
				createdAt: r.createdAt,
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
	if (answers.length < 2) {
		return [];
	}

	const sorted = [...answers].sort((a, b) => a.createdAt - b.createdAt);
	const windowCount = Math.max(0, Math.floor((sorted.length - windowSize) / windowSize) + 1);
	return Array.from({ length: windowCount }, (_, index) => {
		const end = index * windowSize + windowSize - 1;
		const window = sorted.slice(Math.max(0, end - windowSize + 1), end + 1);
		const correct = window.filter((a) => a.isCorrect).length;
		return (correct / window.length) * 100;
	});
}

export function calculateTrend(values: number[]): "improving" | "stable" | "declining" {
	if (values.length < 2) {
		return "stable";
	}

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

	if (slope > 3) {
		return "improving";
	}
	if (slope < -3) {
		return "declining";
	}
	return "stable";
}
