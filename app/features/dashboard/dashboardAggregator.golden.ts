import { unitBasedTabs } from "../../data/units";
import type { AnswerJoinRow } from "../../server/answerRepository";
import { QuestionIdSchema, UserIdSchema } from "../../types";
import type { AnswerRecord } from "../../types/answer";

const OLD_QUESTION_ID_RE = /^(exam\d+-\d{4})-q\d+$/;

/**
 * dashboard 最適化の golden（最適化前）実装と合成データ生成。
 *
 * - 最適化前の getUserAnswerHistory の reduce / aggregateStats / 下流を deep-copy で保持し、
 *   before 計測（bench）と equivalence test（new vs old を deep-equal）の双方が共有する。
 * - `.test`/`.bench` サフィックスを持たないため vitest のスイートとしては収集されない。
 */

// 実在する exam{n}-{year} ペア（app/data/units.ts の examMapping）。
// 異なる単元へ写像されるよう年/番号を散らす。mapQuestionToUnit が null を返すと
// aggregateByUnit（最重量パス）がベンチされないため、必ず実在ペアを使う。
const BENCH_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

const EXAM_PREFIXES = [
	"exam1-2013",
	"exam2-2013",
	"exam3-2013",
	"exam4-2013",
	"exam5-2013",
	"exam6-2013",
	"exam7-2013",
	"exam9-2013",
	"exam1-2014",
	"exam2-2014",
] as const;

// 決定論的な擬似乱数（seed 固定で before/after を同一データで比較）。
function makeRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1_664_525 + 1_013_904_223) >>> 0;
		return state / 0xff_ff_ff_ff;
	};
}

// 合成 AnswerJoinRow[] を count 件生成（leftJoin 取得行のシェイプ）。
// created_at は複数月にまたがり、単元横断で交互（interleaved）になるよう散らす
// （月次集計・順序の基準は created_at に一本化）。
export function makeRows(count: number, seed = 42): AnswerJoinRow[] {
	const rng = makeRng(seed);
	return Array.from({ length: count }, (_, i) => {
		const prefix = EXAM_PREFIXES[i % EXAM_PREFIXES.length];
		const qNum = (i % 7) + 1;
		const monthOffset = Math.floor(rng() * 6); // 0..5 ヶ月
		const dayOffset = Math.floor(rng() * 25) + 1;
		const date = new Date(2024, monthOffset, dayOffset);
		const hasDuration = rng() > 0.2;
		// setId: 5問ごとに同じセットIDを割り当て（実際のラップ式ストップウォッチの挙動を模倣）。
		const setIndex = Math.floor(i / 5);
		return {
			id: i + 1,
			userId: BENCH_USER_ID,
			jsonId: `${prefix}-q${qNum}`,
			selectedLabel: "ア",
			isCorrect: rng() > 0.4 ? 1 : 0,
			duration: hasDuration ? Math.floor(rng() * 120) + 1 : null,
			setId: `set-${setIndex.toString().padStart(4, "0")}`,
			createdAt: date.getTime() + Math.floor(rng() * 1000),
		};
	});
}

// ---- 最適化前の実装コピー（before 計測 + equivalence 用） ----

function oldRowToRecord(row: AnswerJoinRow): AnswerRecord | null {
	if (row.jsonId == null) {
		return null;
	}
	return {
		id: row.id,
		userId: UserIdSchema.parse(row.userId),
		questionId: QuestionIdSchema.parse(row.jsonId),
		selectedLabel: row.selectedLabel,
		isCorrect: row.isCorrect === 1,
		duration: row.duration,
		setId: row.setId,
		createdAt: row.createdAt,
	};
}

export function oldGroupRowsByQuestion(rows: AnswerJoinRow[]): Record<string, AnswerRecord[]> {
	return rows.reduce<Record<string, AnswerRecord[]>>((history, row) => {
		const record = oldRowToRecord(row);
		if (record == null) {
			return history;
		}
		history[record.questionId] = [...(history[record.questionId] ?? []), record];
		return history;
	}, {});
}

interface OldDashboardData {
	totalAnswered: number;
	totalAttempts: number;
	overallAccuracy: number;
	avgDuration: number | null;
	monthlyStats: OldMonthlyStats[];
	unitStats: OldUnitStats[];
	trend: "improving" | "stable" | "declining";
}

export function oldAggregateStats(answerHistory: Record<string, AnswerRecord[]>): OldDashboardData {
	const allAnswers = Object.values(answerHistory).flat();

	if (allAnswers.length === 0) {
		return {
			totalAnswered: 0,
			totalAttempts: 0,
			overallAccuracy: 0,
			avgDuration: null,
			monthlyStats: [],
			unitStats: [],
			trend: "stable" as const,
		};
	}

	const latestByQuestion = new Map<string, AnswerRecord>();
	for (const [qid, records] of Object.entries(answerHistory)) {
		if (records.length > 0) {
			latestByQuestion.set(qid, records[records.length - 1]);
		}
	}

	const latestAnswers = Array.from(latestByQuestion.values());
	const correctCount = latestAnswers.filter((a) => a.isCorrect).length;

	const durationsWithValue = allAnswers.filter((a) => a.duration != null);
	const avgDuration =
		durationsWithValue.length > 0
			? durationsWithValue.reduce((sum, a) => sum + (a.duration ?? 0), 0) /
				durationsWithValue.length
			: null;

	const monthlyStats = oldAggregateByMonth(allAnswers);
	const unitStats = oldAggregateByUnit(answerHistory);
	const trend = oldCalculateTrend(monthlyStats.map((m) => m.accuracy));

	return {
		totalAnswered: latestByQuestion.size,
		totalAttempts: allAnswers.length,
		overallAccuracy:
			latestAnswers.length > 0 ? Math.round((correctCount / latestAnswers.length) * 100) : 0,
		avgDuration: avgDuration ? Math.round(avgDuration * 10) / 10 : null,
		monthlyStats,
		unitStats,
		trend,
	};
}

interface OldMonthlyStats {
	month: string;
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number;
	avgDuration: number | null;
}

// JST(UTC+9) 基準の "YYYY-MM"（real の jstDayKey と同一基準。golden は private を import 不可のため自前定義）。
const GOLDEN_JST_OFFSET_MS = 9 * 60 * 60 * 1000;
function goldenJstMonth(createdAt: number): string {
	const date = new Date(createdAt + GOLDEN_JST_OFFSET_MS);
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function oldAggregateByMonth(answers: AnswerRecord[]): OldMonthlyStats[] {
	const byMonth = new Map<string, AnswerRecord[]>();

	for (const answer of answers) {
		const month = goldenJstMonth(answer.createdAt);
		const arr = byMonth.get(month) ?? [];
		arr.push(answer);
		byMonth.set(month, arr);
	}

	const stats: OldMonthlyStats[] = [];
	const sortedMonths = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));

	for (const [month, monthAnswers] of sortedMonths) {
		let correct = 0;
		let durationSum = 0;
		let withDurationCount = 0;

		for (let i = 0; i < monthAnswers.length; i++) {
			const a = monthAnswers[i];
			if (a.isCorrect) {
				correct++;
			}
			if (a.duration != null) {
				durationSum += a.duration;
				withDurationCount++;
			}
		}

		stats.push({
			month,
			totalAnswers: monthAnswers.length,
			correctAnswers: correct,
			accuracy: Math.round((correct / monthAnswers.length) * 100),
			avgDuration:
				withDurationCount > 0 ? Math.round((durationSum / withDurationCount) * 10) / 10 : null,
		});
	}

	return stats;
}

const oldQuestionToUnitMap = new Map<string, string>();
for (const tab of unitBasedTabs) {
	for (const mapping of tab.examMapping) {
		for (const examNum of mapping.examNumbers) {
			oldQuestionToUnitMap.set(`exam${examNum}-${mapping.year}`, tab.id);
		}
	}
}

function oldMapQuestionToUnit(questionId: string): string | null {
	const match = questionId.match(OLD_QUESTION_ID_RE);
	if (!match) {
		return null;
	}
	return oldQuestionToUnitMap.get(match[1]) ?? null;
}

interface OldUnitStats {
	unitId: string;
	unitName: string;
	unitIcon: string;
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number;
	trend: "improving" | "stable" | "declining";
	questionDetails: {
		questionId: string;
		answers: { selectedLabel: string; isCorrect: boolean; createdAt: number }[];
	}[];
}

function oldAggregateByUnit(answerHistory: Record<string, AnswerRecord[]>): OldUnitStats[] {
	const unitMap = new Map<string, { answers: Map<string, AnswerRecord[]> }>();

	for (const [questionId, records] of Object.entries(answerHistory)) {
		const unitId = oldMapQuestionToUnit(questionId);
		if (!unitId) {
			continue;
		}

		let unitEntry = unitMap.get(unitId);
		if (!unitEntry) {
			unitEntry = { answers: new Map() };
			unitMap.set(unitId, unitEntry);
		}
		unitEntry.answers.set(questionId, records);
	}

	const stats: OldUnitStats[] = [];

	for (const tab of unitBasedTabs) {
		const unitData = unitMap.get(tab.id);
		if (!unitData) {
			continue;
		}

		const allAnswers = Array.from(unitData.answers.values()).flat();
		const correct = allAnswers.filter((a) => a.isCorrect).length;

		const recentAccuracies = oldGetRecentAccuracies(allAnswers, 5);
		const trend = oldCalculateTrend(recentAccuracies);

		const questionDetails = Array.from(unitData.answers.entries()).map(([qid, records]) => ({
			questionId: qid,
			answers: records.map((r) => ({
				selectedLabel: r.selectedLabel,
				isCorrect: r.isCorrect,
				createdAt: r.createdAt,
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

function oldGetRecentAccuracies(answers: AnswerRecord[], windowSize: number): number[] {
	if (answers.length < 2) {
		return [];
	}

	const sorted = [...answers].sort((a, b) => a.createdAt - b.createdAt);
	const accuracies: number[] = [];

	for (let i = windowSize - 1; i < sorted.length; i += windowSize) {
		const window = sorted.slice(Math.max(0, i - windowSize + 1), i + 1);
		const correct = window.filter((a) => a.isCorrect).length;
		accuracies.push((correct / window.length) * 100);
	}

	return accuracies;
}

function oldCalculateTrend(values: number[]): "improving" | "stable" | "declining" {
	if (values.length < 2) {
		return "stable";
	}

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

	if (slope > 3) {
		return "improving";
	}
	if (slope < -3) {
		return "declining";
	}
	return "stable";
}
