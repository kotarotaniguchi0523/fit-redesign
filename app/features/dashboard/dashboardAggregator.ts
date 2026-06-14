import { unitBasedTabs } from "../../data/units";
import type { AnswerRecord } from "../../types/answer";
import { questionScore } from "./masteryScore";

// questionId → unitId マッピングを構築
const questionToUnitMap: Map<string, string> = new Map(
	unitBasedTabs.flatMap((tab) =>
		tab.examMapping.flatMap((mapping) =>
			mapping.examNumbers.map((examNum) => [`exam${examNum}-${mapping.year}`, tab.id] as const),
		),
	),
);

// 単元メタ（id → 表示名/アイコン）と、単元ごとの全問題数（last-wins で割当たった examId 数 × 5）。
const unitMeta: Map<string, { name: string; icon: string }> = new Map(
	unitBasedTabs.map((tab) => [tab.id, { name: tab.name, icon: tab.icon }]),
);
const QUESTIONS_PER_EXAM = 5;
const unitExamCounts: Map<string, number> = Array.from(questionToUnitMap.values()).reduce(
	(counts, unitId) => counts.set(unitId, (counts.get(unitId) ?? 0) + 1),
	new Map<string, number>(),
);
// カバレッジ分母（全問題数）= D1 questions テーブルの行数。exam8-2013 の5問も含む。
// 注: 単元別 totalQuestions（examMapping 由来の examId×5）の合計とは一致しないことがある
// （共有 exam の last-wins・実問題が無い examMapping エントリのため）。分母の真実は D1 行数=180。
export const TOTAL_QUESTIONS = 180;
// 早とちり判定の閾値（秒）。これ未満×不正解が複数回で「早とちり」。
const HASTY_DURATION_SEC = 40;
// ランキングの足切り・件数（ユーザー決定: 1回だけの 0% が上位を独占するのを防ぐ）。
const WEAK_QUESTION_MIN_ATTEMPTS = 2; // 苦手問題: 2回以上解答した問題のみ
const WEAK_UNIT_MIN_ATTEMPTED = 2; // 弱点単元: 2問以上着手した単元のみ
const WEAK_QUESTIONS_LIMIT = 5;
const WEAK_UNITS_LIMIT = 3;

const QUESTION_ID_RE = /^exam(\d+)-(\d{4})-q(\d+)$/;

export interface ParsedQuestionId {
	examId: string; // "exam1-2013"
	examNumber: number;
	year: string;
	questionNumber: number;
}

// "exam1-2013-q1" を構成要素に分解する単一のパーサ（examId/年度/設問番号を一度に取る）。
export function parseQuestionId(questionId: string): ParsedQuestionId | null {
	const match = questionId.match(QUESTION_ID_RE);
	if (!match) {
		return null;
	}
	const [, examNumber, year, questionNumber] = match;
	return {
		examId: `exam${examNumber}-${year}`,
		examNumber: Number(examNumber),
		year,
		questionNumber: Number(questionNumber),
	};
}

export function mapQuestionToUnit(questionId: string): string | null {
	const parsed = parseQuestionId(questionId);
	return parsed ? (questionToUnitMap.get(parsed.examId) ?? null) : null;
}

// --- JST 固定の日付バケット ---
// created_at は epoch ms。Worker は UTC 実行のため JST(UTC+9) へシフトして getUTC* で日付を取り、
// ランタイムのローカル TZ に依存させない。日キー・週キーは文字列比較でソート可能な "YYYY-MM-DD"。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_WEEKS = 15; // ヒートマップは直近15週 × 7曜日
const HEATMAP_DAYS = HEATMAP_WEEKS * 7;
const DAILY_TREND_DAYS = 30; // 推移グラフ「日」= 直近30日
const WEEKLY_TREND_WEEKS = 12; // 推移グラフ「週」= 直近12週

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

// epoch ms → JST 日付キー "YYYY-MM-DD"
function jstDayKey(ms: number): string {
	const date = new Date(ms + JST_OFFSET_MS);
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

// epoch ms → その JST 週（月曜起点）の月曜日キー "YYYY-MM-DD"
function jstWeekStartKey(ms: number): string {
	return jstDayKey(ms - jstWeekdayMondayBased(ms) * DAY_MS);
}

// JST 日付キー "YYYY-MM-DD" → "M/D" 表示ラベル
function dayKeyToLabel(key: string): string {
	const parts = key.split("-");
	return `${Number(parts[1])}/${Number(parts[2])}`;
}

// その JST 日の 00:00 を指す epoch ms（ヒートマップの日列挙に使う）
function jstMidnightMs(ms: number): number {
	return Math.floor((ms + JST_OFFSET_MS) / DAY_MS) * DAY_MS - JST_OFFSET_MS;
}

// epoch ms → JST 日付の月曜起点曜日インデックス（月=0..日=6）。
function jstWeekdayMondayBased(ms: number): number {
	const sundayBased = new Date(ms + JST_OFFSET_MS).getUTCDay(); // 0=日..6=土
	return (sundayBased + 6) % 7;
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
		answers: { selectedLabel: string; isCorrect: boolean; createdAt: number }[];
	}[];
}

// 推移グラフの粒度別バケット（日/週）。X軸ラベル付きで chart.js に流す。
export interface PeriodStats {
	key: string; // ソート用 "YYYY-MM-DD"（日 or 週の月曜日）
	label: string; // 表示ラベル: 日 "6/11" / 週 "6/8〜"
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number; // 0-100
	avgDuration: number | null; // seconds
}

// 学習ヒートマップの1セル（直近15週×7曜日）。
export interface HeatmapCell {
	dateKey: string; // "YYYY-MM-DD"
	label: string; // "6/11"（title 属性用）
	count: number; // その日の回答数
	weekday: number; // 月曜起点の曜日(月=0..日=6)。集計層が epoch ms 基準で算出
}

// 単元の仕上がり（②仕上がりの内訳・③弱点単元 Top3 で使う）。
export interface UnitMastery {
	unitId: string;
	unitName: string;
	unitIcon: string;
	masteryRate: number; // 0-100 仕上がり率（着手問題の問題スコア平均）
	attempted: number; // 着手問題数
	totalQuestions: number; // 単元の全問題数
	linkYear: string; // 演習ページ代表年度＝examMapping 先頭
}

// 苦手問題（③苦手問題 Top5）。
export interface WeakQuestion {
	questionId: string;
	label: string; // 人間可読 "符号理論 2013 Q1"
	unitName: string;
	score: number; // 0-100 問題スコア
	hasty: boolean; // 早とちり注意（40秒未満×不正解が複数回）
	trapLabel: string | null; // ひっかかり選択肢（同一誤答ラベル2回以上）
}

// 演習カバレッジ（広さ）。
export interface Coverage {
	attempted: number; // 着手問題数（ユニーク）
	total: number; // 全問題数（180）
}

// 完走したセット（exam 単位5問）の通しタイム（②の単元行「前回の通しタイム」用）。
export interface SetTime {
	unitId: string;
	year: string;
	examNumber: number;
	totalSeconds: number; // 5問のラップ合計
	completedAt: number; // セット最終回答の created_at（単元内で最新セットを選ぶため）
}

export interface DashboardData {
	totalAnswered: number; // 回答済み問題数（ユニークな questionId）
	totalAttempts: number; // 総回答回数
	overallAccuracy: number; // 全体正答率（最新回答ベース）
	avgDuration: number | null;
	monthlyStats: MonthlyStats[];
	unitStats: UnitStats[];
	trend: "improving" | "stable" | "declining";
	dailyStats: PeriodStats[]; // 直近30日（JST）
	weeklyStats: PeriodStats[]; // 直近12週（JST・月曜起点）
	heatmap: HeatmapCell[]; // 直近15週=105日（0埋め・now 基準）
	todayCount: number; // 今日(JST)解いたユニーク問題数（目標リング分子）
	coverage: Coverage; // 着手/180
	unitMastery: UnitMastery[]; // 全単元の仕上がり（②）
	weakUnits: UnitMastery[]; // 弱点単元 Top3（③・2問以上着手の低い順）
	weakQuestions: WeakQuestion[]; // 苦手問題 Top5（③・2回以上解答の低い順）
	setTimes: SetTime[]; // 単元ごとの直近完走セットの通しタイム（②展開行）
	overallMastery: number | null; // 着手加重平均の仕上がり率(0-100)。着手0なら null
	masteryAttempted: number; // overallMastery の分母＝単元に写像できる着手問題数（表示「着手したN問」）
}

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

// questionId → 単元の表示名（未割当・未知単元は空文字）。
function unitNameOf(questionId: string): string {
	const unitId = mapQuestionToUnit(questionId);
	return unitId ? (unitMeta.get(unitId)?.name ?? "") : "";
}

// "exam2-2013-q1" → "符号理論 2013 Q1"（単元名 + 年度 + 設問番号）。
function questionLabel(questionId: string): string {
	const unitName = unitNameOf(questionId);
	const parsed = parseQuestionId(questionId);
	if (!parsed) {
		return unitName || questionId;
	}
	return [unitName, parsed.year, `Q${parsed.questionNumber}`].filter(Boolean).join(" ");
}

// 早とちり: 40秒未満で不正解が複数回（≥2）。
function isHasty(records: AnswerRecord[]): boolean {
	const hastyMisses = records.filter(
		(record) =>
			!record.isCorrect && record.duration != null && record.duration < HASTY_DURATION_SEC,
	).length;
	return hastyMisses >= 2;
}

// ひっかかり選択肢: 同一の誤答ラベルを2回以上選んでいればそのラベル（最多）、無ければ null。
function trapLabel(records: AnswerRecord[]): string | null {
	const wrongCounts = records
		.filter((record) => !record.isCorrect)
		.reduce(
			(counts, record) =>
				counts.set(record.selectedLabel, (counts.get(record.selectedLabel) ?? 0) + 1),
			new Map<string, number>(),
		);
	const repeated = Array.from(wrongCounts.entries())
		.filter(([, count]) => count >= 2)
		// 最多の誤答ラベル。同数なら label 昇順で決定的に選ぶ。
		.sort(([labelA, a], [labelB, b]) => b - a || labelA.localeCompare(labelB));
	return repeated.length > 0 ? repeated[0][0] : null;
}

// 着手問題数で加重した仕上がり率の平均（率）と、その分母＝着手問題数（mapped のみ）。
// ヒーローカード①「着手したN問の平均スコアX%」の N=attempted・X=rate を一度の走査で算出する。
// attempted は単元に写像できる着手問題のみ数える（coverage.attempted=全着手とは exam8-2013 等の
// 未写像問題で乖離しうるため、率の分母と表示Nを同一の mapped 基準に揃える）。
function computeMastery(unitMastery: UnitMastery[]): { rate: number | null; attempted: number } {
	const attempted = unitMastery.reduce((sum, unit) => sum + unit.attempted, 0);
	if (attempted === 0) {
		return { rate: null, attempted: 0 };
	}
	const weightedSum = unitMastery.reduce((sum, unit) => sum + unit.masteryRate * unit.attempted, 0);
	return { rate: Math.round(weightedSum / attempted), attempted };
}

interface WeaknessData {
	coverage: Coverage;
	unitMastery: UnitMastery[];
	weakUnits: UnitMastery[];
	weakQuestions: WeakQuestion[];
}

/**
 * 弱点診断（カバレッジ・単元別仕上がり率・弱点単元 Top3・苦手問題 Top5）を集計する。
 * 問題スコアは masteryScore の純関数を同一 feature 内で利用。ランキングの足切りは
 * 苦手問題=2回以上解答 / 弱点単元=2問以上着手（1回だけの 0% が上位を独占するのを防ぐ）。
 */
function aggregateWeakness(answerHistory: Record<string, AnswerRecord[]>): WeaknessData {
	const entries = Object.entries(answerHistory);
	// 問題スコアは問題ごとに1度だけ算出し、単元集計と苦手ランキングで再利用する（二重計算を避ける）。
	const scoreByQuestion = new Map(entries.map(([qid, records]) => [qid, questionScore(records)]));

	// 単元ごとの問題スコア合計・着手数（仕上がり率の分子/分母）。
	const unitScores = entries.reduce((accumulator, [questionId]) => {
		const unitId = mapQuestionToUnit(questionId);
		if (!unitId) {
			return accumulator;
		}
		const current = accumulator.get(unitId) ?? { scoreSum: 0, attempted: 0 };
		return accumulator.set(unitId, {
			scoreSum: current.scoreSum + (scoreByQuestion.get(questionId) ?? 0),
			attempted: current.attempted + 1,
		});
	}, new Map<string, { scoreSum: number; attempted: number }>());

	const unitMastery: UnitMastery[] = unitBasedTabs.map((tab) => {
		const score = unitScores.get(tab.id) ?? { scoreSum: 0, attempted: 0 };
		return {
			unitId: tab.id,
			unitName: tab.name,
			unitIcon: tab.icon,
			masteryRate: score.attempted > 0 ? Math.round((score.scoreSum / score.attempted) * 100) : 0,
			attempted: score.attempted,
			totalQuestions: (unitExamCounts.get(tab.id) ?? 0) * QUESTIONS_PER_EXAM,
			linkYear: tab.examMapping[0]?.year ?? "2013",
		};
	});

	const weakUnits = unitMastery
		.filter((unit) => unit.attempted >= WEAK_UNIT_MIN_ATTEMPTED)
		// 仕上がり率の低い順。同率なら unitId 昇順で決定的に。
		.sort((a, b) => a.masteryRate - b.masteryRate || a.unitId.localeCompare(b.unitId))
		.slice(0, WEAK_UNITS_LIMIT);

	const weakQuestions: WeakQuestion[] = entries
		.filter(([, records]) => records.length >= WEAK_QUESTION_MIN_ATTEMPTS)
		.map(([questionId, records]) => ({
			questionId,
			label: questionLabel(questionId),
			unitName: unitNameOf(questionId),
			score: Math.round((scoreByQuestion.get(questionId) ?? 0) * 100),
			hasty: isHasty(records),
			trapLabel: trapLabel(records),
		}))
		// 問題スコアの低い順。同点なら questionId 昇順で決定的に（入力順に依存させない）。
		.sort((a, b) => a.score - b.score || a.questionId.localeCompare(b.questionId))
		.slice(0, WEAK_QUESTIONS_LIMIT);

	return {
		coverage: { attempted: entries.length, total: TOTAL_QUESTIONS },
		unitMastery,
		weakUnits,
		weakQuestions,
	};
}

interface SetGroup {
	examId: string; // 最初に見た exam{N}-{year}
	singleExam: boolean; // セット内が単一 exam か（複数 exam が混ざれば false＝今日の道）
	year: string;
	examNumber: number;
	questionNumbers: Set<number>;
	durationSum: number;
	completedAt: number;
}

// 完走判定: 単一 exam・q1〜q{QUESTIONS_PER_EXAM} が漏れなく揃う（q6 等の範囲外も弾く）。
function isCompletedExamSet(group: SetGroup): boolean {
	return (
		group.singleExam &&
		group.questionNumbers.size === QUESTIONS_PER_EXAM &&
		Array.from({ length: QUESTIONS_PER_EXAM }, (_, index) => index + 1).every((number) =>
			group.questionNumbers.has(number),
		)
	);
}

/**
 * 完走したセット（exam{N}-{year} の q1〜q5 が同一 set_id に揃う）の通しタイムを集計する。
 * set_id が NULL の行・5問構成にならない set_id グループ（今日の道由来など）は対象外。
 * 単元ごとに最新（completedAt 最大）の1セットだけ返す（②の「前回の通しタイム」）。
 */
function aggregateSetTimes(answerHistory: Record<string, AnswerRecord[]>): SetTime[] {
	const bySet = Object.values(answerHistory)
		.flat()
		.reduce((groups, record) => {
			if (record.setId == null) {
				return groups;
			}
			const parsed = parseQuestionId(record.questionId);
			if (!parsed) {
				return groups;
			}
			const group = groups.get(record.setId) ?? {
				examId: parsed.examId,
				singleExam: true,
				year: parsed.year,
				examNumber: parsed.examNumber,
				questionNumbers: new Set<number>(),
				durationSum: 0,
				completedAt: 0,
			};
			group.singleExam = group.singleExam && parsed.examId === group.examId;
			group.questionNumbers.add(parsed.questionNumber);
			group.durationSum += record.duration ?? 0;
			group.completedAt = Math.max(group.completedAt, record.createdAt);
			return groups.set(record.setId, group);
		}, new Map<string, SetGroup>());

	// 完走セットを単元ごとに最新（completedAt 最大）だけ残す。
	const latestByUnit = Array.from(bySet.values())
		.filter(isCompletedExamSet)
		.reduce((byUnit, group) => {
			// 単元マップは examId 直引き（completion 済みなので examId は単一で確定）。
			const unitId = questionToUnitMap.get(group.examId) ?? null;
			if (!unitId) {
				return byUnit;
			}
			const setTime: SetTime = {
				unitId,
				year: group.year,
				examNumber: group.examNumber,
				totalSeconds: group.durationSum,
				completedAt: group.completedAt,
			};
			const existing = byUnit.get(unitId);
			if (!existing || setTime.completedAt > existing.completedAt) {
				byUnit.set(unitId, setTime);
			}
			return byUnit;
		}, new Map<string, SetTime>());

	return Array.from(latestByUnit.values());
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
