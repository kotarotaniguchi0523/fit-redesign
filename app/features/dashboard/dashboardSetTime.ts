import type { AnswerRecord } from "../../types/answer";
import { parseQuestionId, QUESTIONS_PER_EXAM, questionToUnitMap } from "./dashboardQuestionId";
import type { SetTime } from "./dashboardTypes";

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
export function aggregateSetTimes(answerHistory: Record<string, AnswerRecord[]>): SetTime[] {
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
