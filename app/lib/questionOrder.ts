export function sortByQuestionId<Value extends Readonly<{ questionId: string }>>(
	values: readonly Value[],
): Value[] {
	return [...values].sort((left, right) => left.questionId.localeCompare(right.questionId));
}
