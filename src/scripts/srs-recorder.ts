import { QUESTION_GRADED_EVENT } from "../constants";
import type { QuestionGradedDetail } from "./srs";
import { recordGrade } from "./srs";

/**
 * 採点イベントを購読して SRS スケジュールを更新する。
 * 問題カードを描画するページ（[year], today/[unit]）で1度だけ import する。
 */
document.addEventListener(QUESTION_GRADED_EVENT, (event) => {
	const detail = (event as CustomEvent<QuestionGradedDetail>).detail;
	if (detail?.questionId) {
		recordGrade(detail.questionId, !!detail.isCorrect, Date.now());
	}
});
