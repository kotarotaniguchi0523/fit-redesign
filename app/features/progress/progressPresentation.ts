import type { ProgressEntry } from "./progress";

const QUESTION_ID_PATTERN = /^exam(\d+)-(\d{4})-q(\d+)$/;
const PROGRESS_DATE_TIME_FORMAT = new Intl.DateTimeFormat("ja-JP", {
	dateStyle: "medium",
	timeStyle: "short",
});

export function progressQuestionLink(
	entry: ProgressEntry,
	unitNames: Readonly<Record<string, string>>,
): Readonly<{ label: string; href: string }> {
	const match = QUESTION_ID_PATTERN.exec(entry.questionId);
	const year = match?.[2];
	return {
		label: match
			? `${unitNames[entry.unitId] ?? "小テスト"}・${year}年度・第${match[1]}回 問${match[3]}`
			: entry.questionId,
		href: year ? `/${entry.unitId}/${year}#question-${entry.questionId}` : "/",
	};
}

export function formatProgressDateTime(timestamp: number): string {
	return PROGRESS_DATE_TIME_FORMAT.format(timestamp);
}
