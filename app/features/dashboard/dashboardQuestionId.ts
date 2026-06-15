import { unitBasedTabs } from "../../data/units";
import type { ParsedQuestionId } from "./dashboardTypes";

// questionId → unitId マッピングを構築
export const questionToUnitMap: Map<string, string> = new Map(
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
export const QUESTIONS_PER_EXAM = 5;
export const unitExamCounts: Map<string, number> = Array.from(questionToUnitMap.values()).reduce(
	(counts, unitId) => counts.set(unitId, (counts.get(unitId) ?? 0) + 1),
	new Map<string, number>(),
);

const QUESTION_ID_RE = /^exam(\d+)-(\d{4})-q(\d+)$/;

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

// questionId → 単元の表示名（未割当・未知単元は空文字）。
export function unitNameOf(questionId: string): string {
	const unitId = mapQuestionToUnit(questionId);
	return unitId ? (unitMeta.get(unitId)?.name ?? "") : "";
}

// "exam2-2013-q1" → "符号理論 2013 Q1"（単元名 + 年度 + 設問番号）。
export function questionLabel(questionId: string): string {
	const unitName = unitNameOf(questionId);
	const parsed = parseQuestionId(questionId);
	if (!parsed) {
		return unitName || questionId;
	}
	return [unitName, parsed.year, `Q${parsed.questionNumber}`].filter(Boolean).join(" ");
}
