import type { ExamByYear, ExamNumber } from "../../types";
import { loadExams } from "./loader";

let _loadPromise: Promise<ExamByYear[]> | null = null;
let _byNumberPromise: Promise<Map<ExamNumber, ExamByYear>> | null = null;

export function getAllExams(): Promise<ExamByYear[]> {
	if (!_loadPromise) {
		_loadPromise = loadExams();
	}
	return _loadPromise;
}

function getExamsByNumber(): Promise<Map<ExamNumber, ExamByYear>> {
	if (!_byNumberPromise) {
		_byNumberPromise = getAllExams().then((exams) => new Map(exams.map((e) => [e.examNumber, e])));
	}
	return _byNumberPromise;
}

export async function getExamByNumber(examNumber: ExamNumber): Promise<ExamByYear | undefined> {
	const byNumber = await getExamsByNumber();
	return byNumber.get(examNumber);
}

/** 候補 exam の入力型。examNumber と当該年度の questionId 配列を持つ。 */
export type ExamCandidate = {
	examNumber: number;
	questionIds: string[];
};

/**
 * 候補 exam のうち、問題集合が他候補の部分集合になるもの（統合 exam に内包される原本 exam など）を
 * タブ表示から除外する。完全一致は番号が小さい方を残す。
 *
 * 集計の所有（questionToUnitMap）は examMapping 由来で別管理のため、ここでは表示候補のみ絞る。
 * 入力順を保持して返す。
 *
 * @param candidates - 候補 exam の配列（examNumber と questionIds の組）
 * @returns タブに表示すべき examNumber の配列（入力順を保持）
 */
export function selectVisibleExamNumbers(candidates: ExamCandidate[]): number[] {
	// 候補ごとの Set を1度だけ構築して O(N²) の重複 new Set を排除する。
	const setByExam = new Map(candidates.map((c) => [c.examNumber, new Set(c.questionIds)] as const));
	return candidates
		.filter((candidate) => {
			const candidateSet = setByExam.get(candidate.examNumber);
			const candidateSize = candidateSet?.size ?? 0;
			// 他の候補のいずれかに「自分の問題集合が含まれる」なら除外する。
			return !candidates.some((other) => {
				if (other.examNumber === candidate.examNumber) {
					return false;
				}
				const otherSet = setByExam.get(other.examNumber);
				if (!otherSet) {
					return false;
				}
				// candidate の全問題が other に含まれるか（部分集合判定）。
				const isSubset = candidate.questionIds.every((id) => otherSet.has(id));
				if (!isSubset) {
					return false;
				}
				// 真部分集合なら other が candidate を内包する → candidate を除外。
				// 完全一致（サイズ同一）なら番号が大きい方を除外（小さい方 = other を残す）。
				return otherSet.size > candidateSize || other.examNumber < candidate.examNumber;
			});
		})
		.map((candidate) => candidate.examNumber);
}
