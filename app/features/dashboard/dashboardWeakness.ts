import { unitBasedTabs } from "../../data/units";
import type { AnswerRecord } from "../../types/answer";
import {
	mapQuestionToUnit,
	QUESTIONS_PER_EXAM,
	questionLabel,
	unitExamCounts,
	unitNameOf,
} from "./dashboardQuestionId";
import {
	type Coverage,
	TOTAL_QUESTIONS,
	type UnitMastery,
	type WeakQuestion,
} from "./dashboardTypes";
import { questionScore } from "./masteryScore";

// 早とちり判定の閾値（秒）。これ未満×不正解が複数回で「早とちり」。
const HASTY_DURATION_SEC = 40;
// ランキングの足切り・件数（ユーザー決定: 1回だけの 0% が上位を独占するのを防ぐ）。
const WEAK_QUESTION_MIN_ATTEMPTS = 2; // 苦手問題: 2回以上解答した問題のみ
const WEAK_UNIT_MIN_ATTEMPTED = 2; // 弱点単元: 2問以上着手した単元のみ
const WEAK_QUESTIONS_LIMIT = 5;
const WEAK_UNITS_LIMIT = 3;

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
export function computeMastery(unitMastery: UnitMastery[]): {
	rate: number | null;
	attempted: number;
} {
	const attempted = unitMastery.reduce((sum, unit) => sum + unit.attempted, 0);
	if (attempted === 0) {
		return { rate: null, attempted: 0 };
	}
	const weightedSum = unitMastery.reduce((sum, unit) => sum + unit.masteryRate * unit.attempted, 0);
	return { rate: Math.round(weightedSum / attempted), attempted };
}

export interface WeaknessData {
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
export function aggregateWeakness(answerHistory: Record<string, AnswerRecord[]>): WeaknessData {
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
